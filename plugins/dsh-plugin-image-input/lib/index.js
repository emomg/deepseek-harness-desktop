// dsh-plugin-image-input host half — 输入框粘贴/拖拽图片 → 视觉模型识图。
//
// 原生 DSH composer 已支持图片粘贴/拖拽（draft images），但纯文本模型会被
// apiProxy.sessions.prompt 的 admission 拒绝（MODEL_DOES_NOT_SUPPORT_IMAGES）。
// 本插件在 prompt 层桥接：
//   1. 拦截 prompt：当消息含 image part 且当前模型不支持 image 时，
//      保存图片到本地，替换为路径提示（[Image #N saved to ...]）；
//   2. 注册 vision 工具：模型对保存的路径（或任意本地路径/URL/data URI）
//      调用 OpenAI 兼容 /chat/completions，返回视觉模型描述。

import { createHash } from 'node:crypto'
import { mkdir, readFile, stat as statFile, writeFile } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'

export const name = 'dsh-plugin-image-input'
export const inject = ['tools', 'llm', 'systemPrompt']

const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp'
}

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------
function defaultConfig() {
  return {
    baseUrl: '',
    model: '',
    apiKeyEnv: '',
    maxImageBytes: 24 * 1024 * 1024,
    maxImages: 200,
    timeoutMs: 120000,
    maxTokens: 4096,
    saveDir: join(process.cwd(), '.dsh-image-input')
  }
}

function env(name) {
  const v = process.env[name]
  return v === undefined || v === '' ? undefined : v
}

/** 解析生效的视觉端点配置：插件行 config > 环境变量。 */
function resolveVisionConfig(config) {
  const baseUrl = config.baseUrl || env('IMAGE_VISION_BASE_URL') || ''
  const model = config.model || env('IMAGE_VISION_MODEL') || ''
  const apiKeyEnv = config.apiKeyEnv || env('IMAGE_VISION_API_KEY_ENV') || 'IMAGE_VISION_API_KEY'
  const apiKey = config.apiKey || env(apiKeyEnv) || ''
  return { ...config, baseUrl, model, apiKeyEnv, apiKey, ready: !!(baseUrl && model && apiKey) }
}

// ---------------------------------------------------------------------------
// 图片保存（粘贴准入）
// ---------------------------------------------------------------------------
const registry = new Map() // hash -> seq
let nextSeq = 1

function sanitizeSegment(s) {
  const v = String(s || 'default').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)
  return v || 'default'
}

async function savePastedImage(data, mediaType, saveDir, sessionId) {
  const ext = MIME_EXT[mediaType]
  if (!ext || !data || data.length === 0) return null
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length === 0 || bytes.length > 24 * 1024 * 1024) return null
  // 内容哈希去重（MD5 前缀即可，避免存储爆炸）
  const hash = createHash('md5').update(bytes).digest('hex').slice(0, 16)
  let seq = registry.get(hash)
  if (!seq) {
    seq = nextSeq++
    registry.set(hash, seq)
  }
  const dir = join(saveDir, sanitizeSegment(sessionId))
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `image${seq}${ext}`)
  try {
    await writeFile(filePath, bytes, { flag: 'wx' })
  } catch (err) {
    if (err?.code !== 'EEXIST') throw err
  }
  return { seq, filePath, hint: `[Image #${seq} saved to ${filePath}]` }
}

/** 当前会话生效的模型路由（用于判断是否支持 image 输入）。 */
function currentModelOf(agent, agentDefaultModel, picked) {
  if (picked !== undefined && picked.provider !== undefined && picked.model !== undefined) return picked
  const logged = agent?.session?.requestHeader?.()?.config
  if (logged !== undefined && logged.provider !== undefined && logged.model !== undefined) {
    return { provider: logged.provider, model: logged.model }
  }
  const options = agent?.options
  if (options !== undefined && options.provider !== undefined && options.model !== undefined) {
    return { provider: options.provider, model: options.model }
  }
  const selection = agentDefaultModel?.currentSelection?.()
  if (selection !== undefined && selection.provider !== undefined && selection.model !== undefined) {
    return { provider: selection.provider, model: selection.model }
  }
  return undefined
}

/**
 * Prompt admission override：把 image part 替换为本地路径提示，绕过纯文本
 * 模型 gate，并让模型知道用 vision 工具看图。
 */
function installPromptAdmission(ctx, getConfig) {
  const apiProxy = ctx.get('apiProxy')
  if (!apiProxy || !apiProxy.sessions || typeof apiProxy.sessions.prompt !== 'function') return () => {}
  const agents = ctx.get('agents')
  const agentDefaultModel = ctx.get('agentDefaultModel')
  const pickedBySession = new Map()

  const originalPrompt = apiProxy.sessions.prompt.bind(apiProxy.sessions)
  const originalSelectModel = typeof apiProxy.sessions.selectModel === 'function'
    ? apiProxy.sessions.selectModel.bind(apiProxy.sessions)
    : undefined

  if (originalSelectModel !== undefined) {
    apiProxy.sessions.selectModel = async (request) => {
      const result = await originalSelectModel(request)
      const payload = request?.payload
      if (payload?.provider !== undefined && payload?.model !== undefined && payload?.sessionId !== undefined) {
        pickedBySession.set(payload.sessionId, { provider: payload.provider, model: payload.model })
      }
      return result
    }
  }

  apiProxy.sessions.prompt = async (request) => {
    try {
      const payload = request?.payload
      const content = payload?.content
      if (!Array.isArray(content)) return originalPrompt(request)
      const imageParts = content.filter((part) => part?.type === 'image')
      if (imageParts.length === 0) return originalPrompt(request)

      const route = currentModelOf(
        agents?.get(payload.sessionId),
        agentDefaultModel,
        pickedBySession.get(payload.sessionId)
      )
      const llm = ctx.get('llm')
      if (route === undefined || llm === undefined) return originalPrompt(request)
      let imageCapable = false
      try {
        const info = await llm.resolveModelInfo(route.provider, route.model)
        imageCapable = info?.inputModalities !== undefined && info.inputModalities.includes('image')
      } catch {
        imageCapable = false
      }
      // 模型本身支持图片：走原生链路（图片会直接进模型上下文）。
      if (imageCapable) return originalPrompt(request)

      // 纯文本模型：保存图片 → 替换为路径提示。
      const config = getConfig()
      const replaced = []
      let savedCount = 0
      for (const part of content) {
        if (part?.type !== 'image') {
          replaced.push(part)
          continue
        }
        try {
          const saved = await savePastedImage(part.data, part.mediaType, config.saveDir, payload.sessionId)
          if (saved !== null) {
            savedCount += 1
            replaced.push({
              type: 'text',
              text: `${saved.hint}\nThe active model is text-only and cannot view this image directly. Call the \`vision\` tool with the exact path above to get a description.`
            })
          } else {
            replaced.push({
              type: 'text',
              text: '[A pasted image could not be stored by dsh-plugin-image-input: unsupported media type or empty data. Tell the user.]'
            })
          }
        } catch (err) {
          replaced.push({
            type: 'text',
            text: `[A pasted image could not be stored by dsh-plugin-image-input: ${err instanceof Error ? err.message : String(err)}. Tell the user.]`
          })
        }
      }
      if (savedCount === 0) return originalPrompt(request)
      return originalPrompt({ ...request, payload: { ...payload, content: replaced } })
    } catch (err) {
      return {
        rpcId: request?.rpcId,
        result: {
          ok: false,
          error: {
            code: 'attachment-error',
            message: err instanceof Error ? err.message : String(err)
          }
        }
      }
    }
  }

  return () => {
    apiProxy.sessions.prompt = originalPrompt
    if (originalSelectModel !== undefined) {
      apiProxy.sessions.selectModel = originalSelectModel
    }
    pickedBySession.clear()
  }
}

// ---------------------------------------------------------------------------
// 图片解析：本地路径 / http(s) URL / data URI → base64 + mime
// ---------------------------------------------------------------------------
const DATA_URI_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i

function mimeTypeForExtension(filePath) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp'
  }
  return map[extname(filePath).toLowerCase()]
}

async function resolveImage(source, { maxBytes, timeoutMs, signal }) {
  const trimmed = String(source).trim()
  if (trimmed.startsWith('data:')) {
    const match = DATA_URI_RE.exec(trimmed)
    if (match === null) throw new Error('invalid data URI: expected data:<media-type>;base64,<payload>')
    const mimeType = match[1].toLowerCase()
    if (!mimeType.startsWith('image/')) throw new Error(`unsupported data-URI media type "${mimeType}"`)
    const base64 = match[2].replace(/\s+/g, '')
    const byteLength = Buffer.from(base64, 'base64').byteLength
    if (byteLength > maxBytes) throw new Error(`data URI image is ${byteLength} bytes, exceeding the ${maxBytes}-byte limit`)
    return { mimeType, base64, byteLength, sourceKind: 'data-uri' }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const combined = signal === undefined ? timeoutSignal : AbortSignal.any([timeoutSignal, signal])
    let response
    try {
      response = await fetch(trimmed, { redirect: 'follow', signal: combined })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new Error(`failed to download image URL: ${trimmed}`)
    }
    if (!response.ok) throw new Error(`failed to download image URL (HTTP ${response.status}): ${trimmed}`)
    const contentType = response.headers.get('content-type')
    const mimeType = contentType !== null && contentType.startsWith('image/')
      ? contentType.split(';')[0].trim().toLowerCase()
      : mimeTypeForExtension(trimmed)
    if (mimeType === undefined) throw new Error(`could not determine the image type of "${trimmed}"`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw new Error(`image URL "${trimmed}" is ${bytes.byteLength} bytes, exceeding the ${maxBytes}-byte limit`)
    return { mimeType, base64: Buffer.from(bytes).toString('base64'), byteLength: bytes.byteLength, sourceKind: 'url' }
  }
  // 本地路径
  const absolute = resolve(trimmed)
  let info
  try {
    info = await statFile(absolute)
  } catch {
    throw new Error(`image file not found: ${absolute}`)
  }
  const mimeType = mimeTypeForExtension(absolute)
  if (mimeType === undefined) throw new Error(`unsupported image extension in "${absolute}"`)
  if (info.size > maxBytes) throw new Error(`image file "${absolute}" is ${info.size} bytes, exceeding the ${maxBytes}-byte limit`)
  const bytes = await readFile(absolute)
  return { mimeType, base64: bytes.toString('base64'), byteLength: bytes.byteLength, sourceKind: 'path' }
}

// ---------------------------------------------------------------------------
// vision 工具（OpenAI 兼容 /chat/completions）
// ---------------------------------------------------------------------------
function stripTrailingSlash(url) {
  return String(url).replace(/\/+$/, '')
}

function defaultPrompt(count) {
  if (count <= 1) return 'Please describe this image in detail.'
  return `These are ${count} images. Describe each image in detail, labeling every description with its image number and file name (Image 1, Image 2, ...).`
}

async function postJson({ url, headers, body, timeoutMs, signal }) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combined = signal === undefined ? timeoutSignal : AbortSignal.any([timeoutSignal, signal])
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: combined
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (error?.name === 'TimeoutError') throw new Error(`vision request timed out after ${timeoutMs} ms`)
    throw error
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const data = await response.json()
      const candidate = data?.error ?? data?.message
      if (typeof candidate === 'string') detail = candidate
      else if (typeof candidate?.message === 'string') detail = candidate.message
    } catch {
      // keep status text
    }
    throw new Error(`vision provider error: ${detail}`)
  }
  try {
    return await response.json()
  } catch {
    throw new Error('vision provider returned a non-JSON response')
  }
}

async function analyzeImages(config, paths, question, signal) {
  const list = Array.isArray(paths) ? paths.map((p) => String(p).trim()).filter(Boolean) : []
  if (list.length === 0) throw new Error('"paths" must be a non-empty array of image paths or http(s) URLs.')
  if (list.length > 10) throw new Error(`too many images: ${list.length} (max 10 per call).`)
  if (!config.ready) {
    throw new Error(
      'No vision backend configured for dsh-plugin-image-input. ' +
      `Set IMAGE_VISION_BASE_URL, IMAGE_VISION_MODEL and IMAGE_VISION_API_KEY (or plugin row config baseUrl/model/apiKeyEnv). ` +
      `Current: baseUrl=${config.baseUrl || '(missing)'}, model=${config.model || '(missing)'}, apiKey=${config.apiKey ? 'set' : 'MISSING'}.`
    )
  }
  const images = []
  const errors = []
  for (const raw of list) {
    const label = raw.split(/[\\/]/).pop() || raw
    try {
      const resolved = await resolveImage(raw, { maxBytes: config.maxImageBytes, timeoutMs: config.timeoutMs, signal })
      images.push({ ...resolved, label })
    } catch (error) {
      errors.push(`[${label}]: ${error.message}`)
    }
  }
  if (images.length === 0) {
    const reasons = errors.length > 0 ? `\n  ${errors.join('\n  ')}` : ''
    return `Error: none of the specified images could be read.${reasons}`
  }
  const content = [{ type: 'text', text: question || defaultPrompt(images.length) }]
  for (const image of images) {
    content.push({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } })
  }
  const result = await postJson({
    url: `${stripTrailingSlash(config.baseUrl)}/chat/completions`,
    headers: { authorization: `Bearer ${config.apiKey}` },
    body: {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [{ role: 'user', content }]
    },
    timeoutMs: config.timeoutMs,
    signal
  })
  const choices = result?.choices
  if (!Array.isArray(choices) || choices.length === 0) throw new Error('vision response contained no choices')
  const c = choices[0]?.message?.content
  let text = ''
  if (typeof c === 'string') text = c
  else if (Array.isArray(c)) text = c.filter((p) => p?.type === 'text' || typeof p?.text === 'string').map((p) => p.text).join('')
  if (text === '') text = 'No description returned.'
  if (errors.length === 0) return text
  return `${text}\n\n[Could not read ${errors.length} input(s):]\n  ${errors.join('\n  ')}`
}

function defineVisionTool(getConfig, toolName) {
  return {
    name: toolName,
    description: [
      'Analyze one or more images through an external vision-language model (VLM) and return a plain-text description.',
      'Use whenever the active model is text-only and cannot see an image directly: pass absolute local file paths or http(s) URLs of screenshots, photos, charts, diagrams, or document scans.',
      'MULTI-IMAGE BATCH: pass several paths in one call — they are analyzed in a single request and the result labels each description (max 10).',
      'Pasted images are auto-saved and their hint text carries the exact path to pass here.',
      'Backend (base URL, model, API key) is configured via plugin config or IMAGE_VISION_BASE_URL / IMAGE_VISION_MODEL / IMAGE_VISION_API_KEY env vars.'
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Absolute local file paths and/or http(s) URLs of the images to analyze (max 10 per call).'
        },
        question: {
          type: 'string',
          description: 'Optional specific question about the image(s).'
        }
      },
      required: ['paths']
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }]
    },
    timeoutMs: 120_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => {
      const paths = Array.isArray(args?.paths) ? args.paths : []
      return {
        card: 'generic',
        title: toolName,
        kind: 'read',
        rawInput: args,
        ...(paths.length > 0
          ? { locations: paths.filter((p) => typeof p === 'string' && !/^https?:\/\//i.test(p)).map((path) => ({ path })) }
          : {})
      }
    },
    async execute(args, exec) {
      const paths = Array.isArray(args?.paths) ? args.paths.map((p) => String(p).trim()).filter(Boolean) : []
      if (paths.length === 0) throw new Error('"paths" must be a non-empty array of image paths or http(s) URLs.')
      if (paths.length > 10) throw new Error(`too many images: ${paths.length} (max 10 per call).`)
      const config = resolveVisionConfig(getConfig())
      return analyzeImages(config, paths, args?.question, exec?.signal)
    }
  }
}

// ---------------------------------------------------------------------------
// 插件入口
// ---------------------------------------------------------------------------
export function apply(ctx, rowConfig = {}) {
  const config = { ...defaultConfig(), ...(rowConfig ?? {}) }
  const getConfig = () => resolveVisionConfig(config)

  ctx.systemPrompt?.section({
    name: 'dsh-image-input:instructions',
    order: 110,
    text: [
      'The active model may be text-only and CANNOT process images directly.',
      `When a user message contains an image, dsh-plugin-image-input saves it and replaces the image with a hint like "[Image #N saved to ...]".`,
      `To analyze the image, call the \`vision\` tool with that exact path. Do NOT claim you can see the image directly, and do NOT claim the image failed to load.`
    ].join('\n')
  })

  if (ctx.tools) {
    ctx.effect(() => ctx.tools.register(defineVisionTool(getConfig, 'vision')))
  }

  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/api/image-input/status',
        handler: (req, res) => {
          const c = getConfig()
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({
            ready: c.ready,
            baseUrl: c.baseUrl,
            model: c.model,
            apiKeySet: !!c.apiKey,
            maxImageBytes: c.maxImageBytes,
            maxTokens: c.maxTokens
          }))
        }
      })
    )
  }

  // apiProxy 是可选依赖：用 ctx.inject 延迟注入，等服务就绪后安装 prompt admission。
  // （apply 阶段直接 ctx.get('apiProxy') 可能拿到 undefined——Host 组合里 apiProxy
  //   由外层 fiber 提供，激活顺序不保证。）
  ctx.inject(['apiProxy'], (apiCtx) => {
    ctx.effect(() => installPromptAdmission(apiCtx, getConfig))
  })
}

export default { apply, inject, name }
