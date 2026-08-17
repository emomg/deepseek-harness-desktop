//! dsh-plugin-image-input 核心测试：apply 结构 + vision 工具 + 准入桥接
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply as imageApply } from "../lib/index.js";

export async function run() {
  const ok = (cond, label) => { if (!cond) throw new Error("FAIL " + label); };

  // ---- apply 结构 ----
  const calls = [];
  const ctx = {
    get(name) {
      if (name === "webServer") return { register: (r) => { calls.push(["route", r.path]); return () => {}; } };
      return undefined;
    },
    inject(names, fn) {
      fn({
        get(name) {
          if (name === "apiProxy") return { sessions: { prompt: async () => ({}), selectModel: async () => ({}) } };
          if (name === "llm") return { resolveModelInfo: async () => ({ inputModalities: [] }) };
          if (name === "agents") return { get: () => undefined };
          if (name === "agentDefaultModel") return { currentSelection: () => ({ provider: "p", model: "m" }) };
          return undefined;
        }
      });
    },
    systemPrompt: { section: () => {} },
    tools: { register: (def) => { if (def.name === "vision") calls.push(["vision", typeof def.execute]); return () => {}; } },
    effect: (fn) => fn(),
    on: () => {}
  };
  imageApply(ctx, {});
  ok(calls.some(([k]) => k === "vision"), "vision tool registered");
  ok(calls.some(([k, p]) => k === "route" && p === "/api/image-input/status"), "status route registered");

  // ---- 准入桥接：纯文本模型收到 image part → 保存并替换 ----
  const saveDir = await mkdtemp(join(tmpdir(), "dsh-image-input-test-"));
  let replacedContent = null;
  const apiProxy = {
    sessions: {
      async prompt(request) { replacedContent = request?.payload?.content; return { result: { ok: true } }; },
      async selectModel() { return { result: { ok: true } }; }
    }
  };
  const bridgeCtx = {
    inject(names, fn) {
      fn({
        get(name) {
          if (name === "apiProxy") return apiProxy;
          if (name === "llm") return { resolveModelInfo: async () => ({ inputModalities: [] }) };
          if (name === "agents") return { get: () => undefined };
          if (name === "agentDefaultModel") return { currentSelection: () => ({ provider: "deepseek-official", model: "deepseek-v4-flash" }) };
          return undefined;
        }
      });
    },
    get() { return undefined; },
    systemPrompt: { section: () => {} },
    tools: { register: () => () => {} },
    effect: (fn) => fn(),
    on: () => {}
  };
  imageApply(bridgeCtx, { saveDir });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]).toString("base64");
  await apiProxy.sessions.prompt({
    rpcId: "r1",
    payload: {
      sessionId: "sess-1",
      content: [{ type: "text", text: "看图" }, { type: "image", mediaType: "image/png", data: png }]
    }
  });
  ok(Array.isArray(replacedContent), "content replaced");
  ok(replacedContent[1]?.type === "text" && replacedContent[1].text.includes("[Image #"), "image → path hint");
  ok(replacedContent[1].text.includes("vision"), "hint mentions vision");

  await rm(saveDir, { recursive: true, force: true });
  return "apply/vision/admission";
}
