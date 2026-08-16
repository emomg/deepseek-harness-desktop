//! 共享测试工具：临时数据目录、fake session、fake req/res。
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** 建一个临时 DSH_PRO_DATA_DIR 并返回清理函数。 */
export async function tempDataDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dsh-pro-test-"));
  const prev = process.env.DSH_PRO_DATA_DIR;
  process.env.DSH_PRO_DATA_DIR = dir;
  return {
    dir,
    async restore() {
      if (prev === undefined) delete process.env.DSH_PRO_DATA_DIR;
      else process.env.DSH_PRO_DATA_DIR = prev;
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/** 一个 live 会话的 fake（events/deriveMessages/header）。 */
export function fakeSession({ id = "s1", seq = 100, title = "测试会话", events = [], messages = [], cwd = "C:\\proj" } = {}) {
  return {
    id,
    seq,
    title,
    header: { createdAt: 1000, cwd, version: 1, id },
    events,
    deriveMessages: () => messages,
  };
}

export function fakeReq(method, url, body) {
  const raw = body !== undefined ? JSON.stringify(body) : null;
  const req = { method, url, _raw: raw };
  req.on = (ev, cb) => {
    if (ev === "data" && raw) cb(Buffer.from(raw));
    if (ev === "end") cb();
  };
  return req;
}

export function fakeRes() {
  const out = { code: 0, body: null };
  return {
    writeHead(code) { out.code = code; },
    end(body) { out.body = body ? JSON.parse(body) : null; },
    result() { return out; },
  };
}

/** fake llm stream + fake dsh-llm kit（供 summarize 测试）。 */
export function fakeLlmKit(text) {
  const llm = {
    async *stream() {
      yield { type: "text-delta", text };
    },
  };
  const kit = {
    createUserMessage: (m) => ({ role: "user", content: m.content, source: m.source }),
    BlockAssembler: class {
      constructor() { this.parts = []; }
      push(chunk) { if (chunk && chunk.type === "text-delta") this.parts.push(chunk.text); }
      get finish() { return null; }
      blocks() { return [{ type: "text", text: this.parts.join("") }]; }
    },
  };
  return { llm, kit };
}
