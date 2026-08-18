//! dsh-files 核心测试：嗅探 / 解析 / 工具结构（自包含，用内存字节，不依赖工作区）
import { sniffFormat, sanitizeFileName, parseDocument } from "../lib/index.js";

export async function run() {
  const ok = (cond, label) => { if (!cond) throw new Error("FAIL " + label); };

  // ---- 内容嗅探 ----
  ok(sniffFormat(new TextEncoder().encode("%PDF-1.7 x")) === "pdf", "pdf sniff");
  ok(sniffFormat(new TextEncoder().encode("plain text")) === "text", "text sniff");
  ok(sniffFormat(new TextEncoder().encode("\uFEFFhello")) === "text", "utf16 sniff");

  // ---- 文件名消毒 ----
  ok(sanitizeFileName("a/b/../r.pdf") === "a_b_r.pdf", "path sanitize");
  ok(sanitizeFileName("") === "upload.bin", "empty fallback");

  // ---- 文本解析 ----
  const text = await parseDocument(new TextEncoder().encode("l1\nl2\n中文"), "text", {});
  ok(text === "l1\nl2\n中文", "text parse");

  return "sniff/sanitize/text";
}
