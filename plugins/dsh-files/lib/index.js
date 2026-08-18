// dsh-files host half — 回形针上传 PDF/Word/Excel/TXT + read_document 工具。
//
// 能力：
//   1. POST /api/files/upload   保存上传文件到会话工作区 .dsh-filess/<sessionId>/
//   2. DELETE /api/files/upload 删除已上传文件（按 digest 前缀定位）
//   3. read_document 工具       让 agent 直接读文本/PDF/DOCX/XLSX（走 ctx.fs，继承沙箱）
//
// 安全模型（对齐官方 dsh-files-button 契约）：loopback-only + same-origin/same-site、
// 文件名消毒、大小上限、可选扩展名白名单、会话隔离、TTL 清扫、sha256 去重。

import { createHash } from 'node:crypto'
import { mkdir, readdir, rmdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export const name = 'dsh-files'
export const inject = ['webServer', 'sessions', 'tools', 'systemPrompt']

const MEBIBYTE = 1024 * 1024
const DAY_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// 配置（默认值与 cordis.patch.yml 同步）
// ---------------------------------------------------------------------------
function defaultConfig() {
  return {
    maxFileBytes: 24 * MEBIBYTE,
    readLimit: 800,
    sheetRowLimit: 200,
    maxSheets: 5,
    maxOutputChars: 50000,
    uploadMaxBytes: 24 * MEBIBYTE,
    allowedExtensions: [],
    uploadTtlMs: 7 * DAY_MS,
    sweepIntervalMs: 60 * 60 * 1000,
    maxConcurrentUploads: 4,
    uploadDir: join(process.cwd(), '.dsh-uploads')
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`dsh-files: ${label} must be a positive integer`)
}

// ---------------------------------------------------------------------------
// 解析库加载（插件经 pnpm link 安装时自身 node_modules 可能缺失：
// 先试插件自身，再试 profile node_modules，最后试 DSH_HOME）
// ---------------------------------------------------------------------------
function profileModules() {
  const anchor = process.env.DSH_PROFILE_DIR
    || (process.env.DSH_HOME ? join(process.env.DSH_HOME, 'profiles', 'web') : join(homedir(), '.dsh', 'profiles', 'web'))
  return join(anchor, 'node_modules')
}

function pluginModules() {
  const here = import.meta.dirname ?? '.'
  return join(here, '..', 'node_modules')
}

function loadLib(name) {
  const candidates = [pluginModules(), profileModules()]
  for (const root of candidates) {
    try {
      const require = createRequire(join(root, 'noop.js'))
      return require(name)
    } catch {
      // try next root
    }
  }
  throw new Error(`dsh-files: cannot resolve "${name}" (looked in ${candidates.join(', ')})`)
}

async function loadPdfJs() {
  const candidates = [
    join(pluginModules(), 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'),
    join(profileModules(), 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'),
    join(profileModules(), 'pdfjs-dist', 'build', 'pdf.mjs')
  ]
  for (const c of candidates) {
    try {
      return await import(pathToFileURL(c).href)
    } catch {
      // try next
    }
  }
  throw new Error('dsh-files: cannot resolve pdfjs-dist (legacy build)')
}

// ---------------------------------------------------------------------------
// 内容嗅探（不信任扩展名）：pdf / docx / xlsx / text
// ---------------------------------------------------------------------------
const SNIFF_BYTES = 8192

function zipMemberNames(bytes) {
  const len = bytes.length
  if (len < 22) return null
  const eocdMax = Math.min(len, 22 + 65535)
  let eocd = -1
  for (let i = len - eocdMax; i + 22 <= len; i++) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const readU16 = (off) => bytes[off] | (bytes[off + 1] << 8)
  const readU32 = (off) => (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16)) + bytes[off + 3] * 0x1000000
  const count = readU16(eocd + 10)
  const cdOffset = readU32(eocd + 16)
  const MAX_MEMBERS = 4096
  if (count === 0 || count > MAX_MEMBERS || cdOffset + 46 > len) return null
  const names = []
  let off = cdOffset
  for (let i = 0; i < count; i++) {
    if (off + 46 > len) return null
    if (!(bytes[off] === 0x50 && bytes[off + 1] === 0x4b && bytes[off + 2] === 0x01 && bytes[off + 3] === 0x02)) return null
    const nameLen = readU16(off + 28)
    const extraLen = readU16(off + 30)
    const commentLen = readU16(off + 32)
    if (off + 46 + nameLen > len) return null
    let s = ''
    for (let j = 0; j < nameLen; j++) s += String.fromCharCode(bytes[off + 46 + j])
    names.push(s)
    off += 46 + nameLen + extraLen + commentLen
  }
  return names
}

function looksLikeUtf8(bytes) {
  const n = Math.min(bytes.length, SNIFF_BYTES)
  if (n === 0) return true
  let i = 0
  while (i < n) {
    const b = bytes[i]
    if (b === 0) return false
    if (b < 0x80) i += 1
    else if ((b & 0xe0) === 0xc0) {
      if (i + 1 >= n || (bytes[i + 1] & 0xc0) !== 0x80) return false
      i += 2
    } else if ((b & 0xf0) === 0xe0) {
      if (i + 2 >= n || (bytes[i + 1] & 0xc0) !== 0x80 || (bytes[i + 2] & 0xc0) !== 0x80) return false
      i += 3
    } else if ((b & 0xf8) === 0xf0) {
      if (i + 3 >= n || (bytes[i + 1] & 0xc0) !== 0x80 || (bytes[i + 2] & 0xc0) !== 0x80 || (bytes[i + 3] & 0xc0) !== 0x80) return false
      i += 4
    } else return false
  }
  return true
}

function looksLikeGb18030(bytes) {
  const n = Math.min(bytes.length, SNIFF_BYTES)
  if (n < 4) return false
  let hasHigh = false
  for (let i = 0; i < n; i++) {
    if (bytes[i] >= 0x80) { hasHigh = true; break }
  }
  if (!hasHigh) return false
  try {
    const dec = new TextDecoder('gb18030', { fatal: true }).decode(bytes.subarray(0, n))
    let printable = 0
    for (const ch of dec) {
      const code = ch.codePointAt(0) ?? 0
      if (code >= 0x20 && code !== 0x7f) printable++
    }
    return printable / Math.max(dec.length, 1) > 0.9
  } catch {
    return false
  }
}

export function sniffFormat(bytes, hint) {
  const n = Math.min(bytes.length, SNIFF_BYTES)
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return 'text'
  if (n >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'pdf'
  if (n >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const names = zipMemberNames(bytes)
    if (names !== null) {
      if (names.some((x) => x.startsWith('word/'))) return 'docx'
      if (names.some((x) => x.startsWith('xl/'))) return 'xlsx'
    }
    return null
  }
  if (looksLikeUtf8(bytes)) return 'text'
  if (looksLikeGb18030(bytes)) return 'text'
  if (hint === 'pdf' || hint === 'docx' || hint === 'xlsx' || hint === 'text') return hint
  return null
}

function formatFromExtension(name) {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  const ext = name.slice(dot + 1).toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'xlsx') return 'xlsx'
  if (['txt', 'md', 'csv', 'json', 'log', 'yml', 'yaml', 'toml', 'ini'].includes(ext)) return 'text'
  return null
}

// ---------------------------------------------------------------------------
// 解析：text / pdf / docx / xlsx → 行文本
// ---------------------------------------------------------------------------
function decodeText(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('gb18030', { fatal: true }).decode(bytes)
  }
}

async function parsePdf(bytes) {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // Node 无 web worker；这些选项让 legacy build 自包含。
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true
  }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((it) => it.str || '').join(' ') + '\n'
    } catch {
      // skip unreadable page
    }
  }
  await doc.destroy()
  const trimmed = text.trim()
  return trimmed === '' ? '[PDF 未提取到文本层（可能是扫描件）。请用 read_image 或视觉工具处理。]' : trimmed
}

async function parseDocx(bytes) {
  const mammoth = loadLib('mammoth')
  const tmp = join(process.env.TEMP || process.env.TMP || '/tmp', `dsh-files-docx-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`)
  await writeFile(tmp, bytes)
  try {
    const r = await mammoth.extractRawText({ path: tmp })
    return (r.value || '').trim()
  } finally {
    await unlink(tmp).catch(() => {})
  }
}

async function parseXlsx(bytes, options) {
  const { sheetRowLimit, maxSheets } = options
  const xlsx = loadLib('read-excel-file/node')
  const tmp = join(process.env.TEMP || process.env.TMP || '/tmp', `dsh-files-xlsx-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`)
  await writeFile(tmp, bytes)
  try {
    const readXlsxFile = xlsx.default ?? xlsx
    const readSheetNames = xlsx.readSheetNames
    let sheetNames
    try {
      sheetNames = typeof readSheetNames === 'function' ? await readSheetNames(tmp) : [1]
    } catch {
      sheetNames = [1]
    }
    const sheets = (sheetNames.length > 0 ? sheetNames : [1]).slice(0, maxSheets)
    const parts = []
    let truncated = false
    for (const sheet of sheets) {
      const rows = await readXlsxFile(tmp, { sheet })
      const kept = rows.slice(0, sheetRowLimit)
      if (rows.length > kept.length) truncated = true
      parts.push(`### Sheet: ${String(sheet)}\n` + rowsToText(kept))
    }
    if (sheetNames.length > sheets.length) {
      parts.push(`… 另有 ${sheetNames.length - sheets.length} 个 sheet 未读取（上限 ${maxSheets}）`)
      truncated = true
    }
    if (truncated) parts.push(`… 已截断：每个 sheet 仅保留前 ${sheetRowLimit} 行`)
    return parts.join('\n\n').trim()
  } finally {
    await unlink(tmp).catch(() => {})
  }
}

function rowsToText(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          if (value === null || value === undefined) return ''
          if (value instanceof Date) return value.toISOString().slice(0, 10)
          return String(value)
        })
        .join('\t')
        .replace(/\s+$/, '')
    )
    .join('\n')
}

export async function parseDocument(bytes, format, options) {
  switch (format) {
    case 'pdf': return parsePdf(bytes)
    case 'docx': return parseDocx(bytes)
    case 'xlsx': return parseXlsx(bytes, options)
    case 'text': return decodeText(bytes)
    default: throw new Error(`unsupported format "${format}"`)
  }
}

function windowLines(text, offset, limit, maxChars = Infinity) {
  const normalized = text.replace(/\r\n/g, '\n')
  const endsWithNewline = normalized.endsWith('\n')
  const all = normalized.split('\n')
  if (endsWithNewline && all.length > 0) all.pop()
  const totalLines = all.length
  const start = Math.max(0, offset - 1)
  const end = Math.min(totalLines, start + limit)
  const lines = []
  let budget = maxChars
  for (let i = start; i < end; i++) {
    const raw = all[i]
    if (raw.length > budget) {
      lines.push({ number: i + 1, text: `${raw.slice(0, Math.max(0, budget))}…[truncated, ${raw.length} chars]` })
      break
    }
    lines.push({ number: i + 1, text: raw })
    budget -= raw.length
  }
  const shown = lines.length
  const hidden = end - start - shown
  if (hidden > 0 && lines.length > 0) {
    lines[lines.length - 1] = {
      ...lines[lines.length - 1],
      text: `${lines[lines.length - 1].text}\n…[${hidden} more lines not shown — character budget reached; use offset/limit to page]`
    }
  }
  return { totalLines, lines }
}

// ---------------------------------------------------------------------------
// 上传 HTTP 面
// ---------------------------------------------------------------------------
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i

function networkGuard(req) {
  const host = String(req.headers?.host ?? '')
  if (!LOOPBACK_HOST.test(host)) return 'forbidden: non-loopback host'
  const origin = req.headers?.origin
  if (origin !== undefined) {
    const scheme = req.socket?.encrypted ? 'https' : 'http'
    if (origin !== `${scheme}://${host}`) return 'forbidden: cross-origin'
  }
  const secFetchSite = req.headers?.['sec-fetch-site']
  if (secFetchSite !== undefined && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return 'forbidden: cross-site'
  }
  return null
}

export function sanitizeFileName(raw) {
  const cleaned = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '')
  const segments = cleaned.split(/[\\/]/).filter((s) => s !== '' && s !== '.' && s !== '..')
  const joined = segments.join('_').replace(/^\.+/, '').trim()
  const dot = joined.lastIndexOf('.')
  const ext = dot > 0 && dot < joined.length - 1 ? joined.slice(dot) : ''
  const stem = dot > 0 ? joined.slice(0, dot) : joined
  if (/^\.+$/.test(stem)) return 'upload.bin'
  const MAX_BYTES = 120
  const extBytes = Buffer.byteLength(ext)
  let bytes = 0
  let cut = stem.length
  for (let i = 0; i < stem.length; i++) {
    const code = stem.codePointAt(i) ?? 0
    const width = code > 0xffff ? 4 : code > 0x7ff ? 3 : code > 0x7f ? 2 : 1
    if (bytes + width > MAX_BYTES - extBytes) { cut = i; break }
    bytes += width
  }
  const name = stem.slice(0, cut) + ext
  return name === '' ? 'upload.bin' : name
}

export function sanitizeSessionId(id) {
  const cleaned = String(id ?? '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80)
  return cleaned === '' ? 'anonymous' : cleaned
}

async function fileWithPrefixExists(dir, prefix) {
  try {
    const entries = await readdir(dir)
    return entries.some((entry) => entry.startsWith(prefix))
  } catch {
    return false
  }
}

function createUploadHandler(config, sessionCwd) {
  let inflight = 0
  const { uploadMaxBytes, allowedExtensions, maxConcurrentUploads, uploadDir } = config

  async function storageDirFor(req) {
    const raw = req.headers['x-session-id']
    const sessionId = typeof raw === 'string' ? sanitizeSessionId(raw) : 'anonymous'
    if (sessionCwd !== undefined) {
      const cwd = await sessionCwd(sessionId)
      if (cwd === undefined) return null
      return { dir: join(cwd, '.dsh-filess', sessionId), sessionId }
    }
    return { dir: join(uploadDir, '.dsh-filess', sessionId), sessionId }
  }

  async function handlePost(req, res) {
    const storage = await storageDirFor(req)
    if (storage === null) {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unknown session' }))
      return
    }
    if (inflight >= maxConcurrentUploads) {
      res.writeHead(429, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'too many concurrent uploads' }))
      return
    }
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > uploadMaxBytes) {
      res.writeHead(413, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'payload too large' }))
      return
    }
    inflight += 1
    try {
      const chunks = []
      let total = 0
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += buf.length
        if (total > uploadMaxBytes) {
          res.writeHead(413, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: 'payload too large' }))
          return
        }
        chunks.push(buf)
      }
      if (total === 0) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'empty upload' }))
        return
      }
      let rawName = 'upload.bin'
      try {
        const header = String(req.headers['x-file-name'] ?? '')
        if (header !== '') rawName = decodeURIComponent(header)
      } catch {
        // fall through
      }
      const name = sanitizeFileName(rawName)
      const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
        res.writeHead(415, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: `extension ".${ext}" not allowed` }))
        return
      }
      const data = Buffer.concat(chunks)
      await mkdir(storage.dir, { recursive: true })
      const digest = createHash('sha256').update(data).digest('hex').slice(0, 12)
      const dest = join(storage.dir, `${digest}-${name}`)
      let path = dest
      let deduplicated = false
      if (!(await fileWithPrefixExists(storage.dir, digest))) {
        try {
          await writeFile(dest, data, { flag: 'wx' })
        } catch (err) {
          if (err?.code === 'EEXIST') deduplicated = true
          else throw err
        }
      } else {
        deduplicated = true
        const entries = await readdir(storage.dir)
        const existing = entries.find((entry) => entry.startsWith(digest))
        if (existing !== undefined) path = join(storage.dir, existing)
      }
      const sniffedFormat = sniffFormat(data)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        path,
        name,
        bytes: data.length,
        sessionId: storage.sessionId,
        sniffedFormat,
        ...(deduplicated ? { deduplicated: true } : {})
      }))
    } catch (err) {
      console.error('[dsh-files] upload persist failed:', err)
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'write failed' }))
    } finally {
      inflight -= 1
    }
  }

  async function handleDelete(req, res) {
    const storage = await storageDirFor(req)
    if (storage === null) {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unknown session' }))
      return
    }
    const url = new URL(req.url ?? '', 'http://localhost')
    const target = decodeURIComponent(url.searchParams.get('path') ?? '')
    if (target === '') {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'missing path' }))
      return
    }
    const root = resolve(storage.dir)
    const resolved = resolve(target)
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'path outside session upload dir' }))
      return
    }
    try {
      await unlink(resolved)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ removed: true }))
    } catch {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    }
  }

  return async (req, res) => {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.writeHead(405, { allow: 'POST, DELETE' })
      res.end('method not allowed')
      return
    }
    const denied = networkGuard(req)
    if (denied !== null) {
      res.writeHead(403)
      res.end(denied)
      return
    }
    if (req.method === 'DELETE') {
      await handleDelete(req, res)
      return
    }
    await handlePost(req, res)
  }
}

function createSweeper(root, ttlMs, intervalMs) {
  if (intervalMs <= 0) return () => undefined
  const timer = setInterval(() => {
    void sweep(root, ttlMs).catch((err) => console.error('[dsh-files] upload sweep failed:', err))
  }, intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}

async function sweep(root, ttlMs) {
  const cutoff = Date.now() - ttlMs
  let removedFiles = 0
  let removedDirs = 0
  const base = join(root, '.dsh-filess')
  let sessions
  try {
    sessions = await readdir(base)
  } catch {
    return { removedFiles: 0, removedDirs: 0 }
  }
  for (const session of sessions) {
    const dir = join(base, session)
    let info
    try {
      info = await stat(dir)
    } catch {
      continue
    }
    if (!info.isDirectory()) continue
    let files
    try {
      files = await readdir(dir)
    } catch {
      continue
    }
    for (const file of files) {
      const path = join(dir, file)
      try {
        const fileInfo = await stat(path)
        if (fileInfo.mtimeMs < cutoff) {
          await unlink(path)
          removedFiles += 1
        }
      } catch {
        // raced
      }
    }
    try {
      const remaining = await readdir(dir)
      if (remaining.length === 0) {
        await rmdir(dir)
        removedDirs += 1
      }
    } catch {
      // ignore
    }
  }
  return { removedFiles, removedDirs }
}

// ---------------------------------------------------------------------------
// read_document 工具
// ---------------------------------------------------------------------------
function defineReadDocumentTool(ctx, config) {
  return {
    name: 'read_document',
    description: '读取文本 / PDF / DOCX / XLSX 文档（read 工具处理不了的二进制文档）；行号分页 offset/limit；XLSX 用 list_sheets 先列工作表、sheet=N 读指定表。',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '文档路径，由文件系统后端解析（上传的文件路径在消息里给出）。'
        },
        format: {
          type: 'string',
          enum: ['auto', 'pdf', 'docx', 'xlsx', 'text'],
          description: '格式覆盖；内容嗅探优先于该提示。'
        },
        offset: {
          type: 'number',
          description: '起始行（1 基）。默认 1。'
        },
        limit: {
          type: 'number',
          description: `最多返回行数。默认 ${config.readLimit}。`
        },
        sheet: {
          type: 'number',
          description: '要完整读取的工作表（1 基，仅 XLSX）。'
        },
        list_sheets: {
          type: 'boolean',
          description: '仅列出工作簿的工作表名（仅 XLSX）。'
        }
      },
      required: ['file_path']
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string' },
          format: { type: 'string', enum: ['pdf', 'docx', 'xlsx', 'text'] },
          offset: { type: 'integer' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                number: { type: 'integer' },
                text: { type: 'string' }
              },
              required: ['number', 'text']
            }
          },
          totalLines: { type: 'integer' }
        },
        required: ['path', 'format', 'offset', 'lines', 'totalLines']
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: [
            `### document ${value.path} (${value.format}) — offset ${value.offset}, ${value.lines.length}/${value.totalLines} lines`,
            value.lines.map((l) => l.text).join('\n')
          ].join('\n')
        }
      ]
    },
    isConcurrencySafe: () => true,
    timeoutMs: 120_000,
    async execute(args, exec) {
      const input = parseArgs(args, config)
      const fs = ctx.get('fs')
      if (fs === undefined) throw new Error('dsh-files: fs service unavailable')
      const cwd = exec?.agent?.session?.header?.cwd
      const target = await fs.resolve(input.filePath, {
        ...(cwd !== undefined ? { cwd } : {}),
        signal: exec?.signal
      })
      const info = await fs.stat(target, exec?.signal)
      if (info === undefined) throw new Error(`cannot read "${input.filePath}": not found`)
      if (info.type !== 'file') throw new Error(`cannot read "${input.filePath}": not a regular file`)
      if (info.size !== undefined && info.size > config.maxFileBytes) {
        throw new Error(`cannot read "${input.filePath}": file is ${info.size} bytes, over the ${config.maxFileBytes} byte limit`)
      }
      const bytes = await fs.readBytes(target, exec?.signal, config.maxFileBytes)
      const hint = input.format === 'auto' ? (formatFromExtension(input.filePath) ?? undefined) : input.format
      const format = input.format === 'auto'
        ? (sniffFormat(bytes, hint) ?? 'text')
        : input.format
      if ((input.sheet !== undefined || input.listSheets) && format !== 'xlsx') {
        throw new Error(`sheet/list_sheets 参数仅支持 XLSX 文件（检测到格式：${format}）`)
      }
      let text
      if (format === 'xlsx' && input.listSheets) {
        const xlsx = loadLib('read-excel-file/node')
        const tmp = join(process.env.TEMP || process.env.TMP || '/tmp', `dsh-files-xlsx-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`)
        await writeFile(tmp, Buffer.from(bytes))
        try {
          const readSheetNames = xlsx.readSheetNames
          const names = typeof readSheetNames === 'function' ? await readSheetNames(tmp) : []
          text = names.length > 0 ? names.map((n, i) => `${i + 1}. ${n}`).join('\n') : '[空工作簿]'
        } finally {
          await unlink(tmp).catch(() => {})
        }
      } else {
        text = await parseDocument(bytes, format, {
          sheetRowLimit: config.sheetRowLimit,
          maxSheets: config.maxSheets,
          sheet: input.sheet
        })
      }
      const window = windowLines(text, input.offset, input.limit, config.maxOutputChars)
      return {
        path: input.filePath,
        format,
        offset: input.offset,
        lines: window.lines,
        totalLines: window.totalLines
      }
    },
    presentCall(args) {
      return {
        card: 'generic',
        title: `Read document ${args.file_path}`,
        kind: 'read',
        locations: [{ path: args.file_path }]
      }
    }
  }
}

function parseArgs(args, config) {
  if (typeof args.file_path !== 'string' || args.file_path.trim() === '') {
    throw new Error('file_path must be a non-empty string')
  }
  const filePath = args.file_path.trim()
  const offset = typeof args.offset === 'number' ? args.offset : 1
  if (!Number.isInteger(offset) || offset < 1) throw new Error('offset must be a positive integer')
  const limit = typeof args.limit === 'number' ? args.limit : config.readLimit
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer')
  if (limit > config.readLimit) throw new Error(`limit must be less than or equal to ${config.readLimit}`)
  const format = args.format === undefined ? 'auto' : args.format
  if (typeof format !== 'string' || !['auto', 'pdf', 'docx', 'xlsx', 'text'].includes(format)) {
    throw new Error(`unsupported format "${String(format)}"`)
  }
  const sheet = typeof args.sheet === 'number' ? args.sheet : undefined
  if (sheet !== undefined && (!Number.isInteger(sheet) || sheet < 1)) {
    throw new Error('sheet must be a positive integer')
  }
  const listSheets = args.list_sheets === true
  if (listSheets && sheet !== undefined) {
    throw new Error('list_sheets and sheet are mutually exclusive')
  }
  return { filePath, offset, limit, format, sheet, listSheets }
}

// ---------------------------------------------------------------------------
// 插件入口
// ---------------------------------------------------------------------------
export { defineReadDocumentTool }
export function apply(ctx, rowConfig = {}) {
  const config = { ...defaultConfig(), ...(rowConfig ?? {}) }
  for (const label of [
    'maxFileBytes', 'readLimit', 'sheetRowLimit', 'maxSheets', 'maxOutputChars',
    'uploadMaxBytes', 'uploadTtlMs', 'sweepIntervalMs', 'maxConcurrentUploads'
  ]) {
    assertPositiveInteger(config[label], label)
  }
  if (!Array.isArray(config.allowedExtensions)) config.allowedExtensions = []

  ctx.systemPrompt?.section({
    name: 'tool:read-document',
    order: 110,
    text: 'read_document 可读取 read 工具处理不了的 PDF/DOCX/XLSX（以及文本）。上传的附件路径可用它读取；大文档用 offset/limit 分页，XLSX 先 list_sheets 再 sheet=N。'
  })

  if (ctx.tools) {
    ctx.effect(() => ctx.tools.register(defineReadDocumentTool(ctx, config)))
  }

  const sessionCwd = (sessionId) => {
    const session = ctx.sessions?.get(sessionId)
    return session?.header?.cwd
  }

  if (ctx.webServer) {
    ctx.effect(() =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/api/files',
        handler: createUploadHandler(config, sessionCwd)
      })
    )
  }

  const disposeSweeper = createSweeper(config.uploadDir, config.uploadTtlMs, config.sweepIntervalMs)
  ctx.on('dispose', disposeSweeper)
}

export default { apply, inject, name }
