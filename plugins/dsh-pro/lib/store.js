//! @dsh-pro/core · store：数据目录下的 JSON 文件存储（原子写，损坏容错）。
//! 所有 Pro 状态（模板/摘要/评审）都存在这里，不写进 DSH 会话日志。

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

/** 数据目录：DSH_PRO_DATA_DIR 可覆盖；默认 %LOCALAPPDATA%\DeepSeek Harness Pro\data。 */
export function dataDir() {
  const override = process.env.DSH_PRO_DATA_DIR;
  if (override && override.trim()) return path.resolve(override);
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, "DeepSeek Harness Pro", "data");
}

/** 生成短 id（时间戳 + 随机）。 */
export function newId(prefix) {
  const t = Date.now().toString(36);
  const r = crypto.randomBytes(4).toString("hex");
  return (prefix ? prefix + "-" : "") + t + r;
}

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, "utf8");
    const value = JSON.parse(raw);
    return value ?? null;
  } catch {
    return null;
  }
}

/** 原子写：先写临时文件再改名，避免半写损坏。 */
export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + "." + Math.random().toString(36).slice(2) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/** 数据目录下一个具名 JSON 文档的读写句柄。 */
export function jsonDoc(dir, name, fallback) {
  const file = path.join(dir, name);
  return {
    file,
    async load() {
      const value = await readJson(file);
      return value ?? fallback;
    },
    async save(value) {
      await writeJson(file, value);
      return value;
    },
  };
}

/** 会话目录编码：D:\dsh -> --D-dsh--（与 dsh 会话存储一致，供跨会话定位）。 */
export function encodeWorkspaceDir(workspacePath) {
  const segs = path.resolve(workspacePath).split(/[\\/:]+/).filter(Boolean);
  return "--" + segs.join("-") + "--";
}
