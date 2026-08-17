# dsh-plugin-image-input

**DeepSeek Harness 图片输入插件**：composer 直接粘贴 / 拖拽图片，纯文本模型下自动桥接 **OpenAI 兼容**视觉 API 识图。

> 📦 本目录是插件的**源码分发包**（零运行时依赖，clone 即用）。

## 背景

原生 DSH composer 已支持图片粘贴 / 拖拽（draft images 预览、发送前编辑），但**只支持图片附件**，且纯文本模型（如 deepseek-v4-flash）会被 `apiProxy.sessions.prompt` 的 admission 拒绝（`MODEL_DOES_NOT_SUPPORT_IMAGES`）。本插件在 prompt 层桥接：

1. **粘贴准入**：即使当前主模型是纯文本，也能把图片粘贴进聊天框；图片保存到本地，替换成路径提示（`[Image #N saved to ...]`）。
2. **`vision` 工具**：agent 用这个路径（或任意本地路径 / URL / data URI）调用 `vision`，由你配置的 OpenAI 兼容视觉模型返回文字描述。

模型本身支持图片（声明 `image` 输入）时，走原生链路（图片直接进模型上下文），不干扰。

## 安装

```powershell
dsh plugin --profile web add link:<本目录>
# 重启 dsh web
```

## 配置视觉端点（OpenAI 兼容）

**方式 A：插件行 config（推荐）** — 编辑 `~/.dsh/profiles/web/cordis.patch.yml` 中 `dsh-image-input` 行的 config：

```yaml
- insert:
    - id: dsh-image-input
      name: 'dsh-plugin-image-input'
      config:
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'   # 例：通义 DashScope 兼容端点
        model: 'qwen-vl-plus'
        apiKeyEnv: 'DASHSCOPE_API_KEY'                                # 从环境变量读 key（不进配置文件）
```

**方式 B：环境变量**（无需改 patch）：

```powershell
$env:IMAGE_VISION_BASE_URL = 'https://api.openai.com/v1'
$env:IMAGE_VISION_MODEL    = 'gpt-4o-mini'
$env:IMAGE_VISION_API_KEY  = 'sk-...'
```

常见兼容端点速查：

| 服务 | baseUrl | model | apiKeyEnv |
|---|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | `OPENAI_API_KEY` |
| 通义 DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-vl-plus` | `DASHSCOPE_API_KEY` |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4v-flash` | `ZHIPU_API_KEY` |
| 本地 Ollama | `http://127.0.0.1:11434/v1` | `llava` | （留空） |
| vLLM / LM Studio | 你的端点 | 你的模型 | 你的 key |

未配置时 `vision` 工具会返回明确错误提示，粘贴 / 保存 / 路径提示功能仍可用。

## 使用

1. 粘贴（Ctrl+V）或拖拽图片到输入框——原生预览 rail 会显示图片；
2. 发送消息：纯文本模型下图片被自动保存并替换为路径提示；
3. agent 看到提示后调用 `vision` 工具 → 视觉模型返回描述（多图批量最多 10 张）。

## 配置项

| 字段 | 默认 | 说明 |
|---|---|---|
| `baseUrl` | `''` | OpenAI 兼容端点（不含 `/chat/completions` 后缀） |
| `model` | `''` | 视觉模型名 |
| `apiKeyEnv` | `''` | 存放 API key 的环境变量名；空则读 `IMAGE_VISION_API_KEY` |
| `maxImageBytes` | 25165824 | 单图字节上限 |
| `maxImages` | 200 | 本地保存的图片数上限（LRU） |
| `timeoutMs` | 120000 | 视觉请求超时 |
| `maxTokens` | 4096 | 视觉模型输出上限 |
| `saveDir` | `./.dsh-image-input` | 粘贴图片保存根目录（按会话分子目录） |

## 依赖

零运行时依赖（只用 Node 内置模块 + 全局 `fetch`）。MIT 许可。

## 测试

```powershell
cd dsh-plugin-image-input
node test\run-all.js   # core 套件（apply/vision/admission）
```
