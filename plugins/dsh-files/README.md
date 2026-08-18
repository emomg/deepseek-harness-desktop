# dsh-files

**DeepSeek Harness 回形针文件上传插件**：composer 回形针按钮 + 整页拖拽上传 PDF / Word / Excel / TXT，按会话隔离存储，`read_document` 工具让 agent 直接读文档。

> 📦 本目录是插件的**源码分发包**（不含 `node_modules`）。依赖解析库需先 `npm install`，见下方「依赖」。

## 功能

- 📎 **回形针按钮**：composer 工具行左侧，选择文件上传（多选）
- 🖱️ **整页拖拽**：把文件拖到窗口任意位置 → 遮罩提示"松开以上传文件" → 松开即上传
- 🗂️ **附件卡片**：按真实字节嗅探格式着色的角标（PDF 红 / DOC 蓝 / XLS 绿 / TXT 灰），伪装扩展名不按扩展名显示；显示文件名与大小，可移除
- 📄 **`read_document` 工具**：agent 读取文本 / PDF / DOCX / XLSX，走 `ctx.fs`（继承沙箱与观察策略）
  - 内容嗅探不信任扩展名（PDF 头 / ZIP 中央目录 / UTF-8 / UTF-16 / GB18030 字节判定）
  - 行号 + `offset`/`limit` 分页；XLSX `list_sheets` 先列工作表、`sheet=N` 读指定表
  - 大小预检、输出字符预算截断
- 🔒 **安全**：loopback-only + same-origin/same-site 校验、文件名消毒（去路径段/控制字符/超长截断按 UTF-8 字节）、大小上限、sha256 内容去重、会话隔离存储、TTL 清扫

## 安装

```powershell
# 1. 安装依赖解析库（mammoth / pdfjs-dist / read-excel-file / jszip）
cd dsh-files
npm install

# 2. 安装插件（自动追加 bundle + 链接到 profile）
dsh plugin --profile web add link:<本目录>

# 3. 确认组合层包含 dsh-files
dsh --profile web --dump-config | Select-String dsh-files

# 4. 重启 dsh web（桌面端：托盘 → 退出 → 重新打开）
```

## 使用

1. 点 composer 工具栏的回形针按钮，或把文件拖到窗口任意位置；
2. 文件上传后路径自动插入输入框，附件卡片显示在输入框上方；
3. 发送消息后，agent 可用 `read_document <路径>` 读取文档——大文档按需分页。

## 存储位置

- 文件存到 `<会话工作区>/.dsh-filess/<sessionId>/`（agent 的 fs 一定能解析，会话间隔离）
- 超过 7 天未引用的文件由清扫器自动删除（可配置）

## 配置

插件行 config（`cordis.patch.yml`）可覆盖默认值：

| 字段 | 默认 | 说明 |
|---|---|---|
| `maxFileBytes` | 25165824 (24MB) | 单次文档读取字节上限 |
| `readLimit` | 800 | `read_document` 单次返回行数上限 |
| `sheetRowLimit` | 200 | 每个工作表保留行数 |
| `maxSheets` | 5 | 读取的工作表数上限 |
| `maxOutputChars` | 50000 | 单次输出字符预算 |
| `uploadMaxBytes` | 25165824 | 单文件上传上限 |
| `allowedExtensions` | `[]` | 扩展名白名单；空 = 全部允许 |
| `uploadTtlMs` | 604800000 (7天) | 未引用文件保留时长 |
| `sweepIntervalMs` | 3600000 (1h) | 清扫周期；0 = 关闭 |
| `uploadDir` | `./.dsh-uploads` | 无会话服务时的兜底存储根 |

## 依赖

| 包 | 用途 | 体积 |
|---|---|---|
| `mammoth` | DOCX 文本提取 | ~2MB |
| `pdfjs-dist` | PDF 文本提取（legacy build） | ~36MB |
| `read-excel-file` | XLSX 单元格读取 | ~1MB |
| `jszip` | 测试用 fixture 生成 | ~0.7MB |

均为维护中、纯 JS / 预构建，无原生编译。MIT 许可。

## 测试

```powershell
cd dsh-files
node test\run-all.js   # core + parse 两套
```
