//! @dsh-pro/core · templates：任务模板库。
//! 模板 = { id, name, description, prompt, variables:[{key,label,default,required}], tags }。
//! prompt 内用 {{key}} 引用变量；首次运行时播种内置模板。

import { jsonDoc, newId, dataDir } from "./store.js";

/** 模板库文档句柄（与 index.js 同文件，供其它模块按需读取）。 */
export function templatesDoc() {
  return jsonDoc(dataDir(), "templates.json", { templates: [] });
}

const DEFAULT_TEMPLATES = [
  {
    id: "tpl-fix-test",
    name: "修这个测试",
    description: "针对失败的测试定位原因并修复",
    tags: ["测试"],
    variables: [
      { key: "target", label: "测试/文件（可留空）", default: "", required: false },
    ],
    prompt: "请修复这个测试：{{target}}\n\n步骤：\n1. 先运行测试复现失败，读取完整报错；\n2. 定位根因（代码 bug 还是测试本身问题）；\n3. 修复后运行相关测试验证通过；\n4. 总结根因与修复方式。",
  },
  {
    id: "tpl-pr-desc",
    name: "写 PR 描述",
    description: "根据当前改动生成 PR 描述与 commit message",
    tags: ["GitHub"],
    variables: [
      { key: "feature", label: "本次改动内容", default: "", required: true },
    ],
    prompt: "基于当前工作区改动，生成：\n1. 一句话 PR 标题；\n2. PR 描述（背景、改动、验证方式、影响面）；\n3. 3-5 条结构化 commit message 候选。\n\n本次改动：{{feature}}",
  },
  {
    id: "tpl-review",
    name: "代码评审",
    description: "对指定改动/文件做代码评审",
    tags: ["评审"],
    variables: [
      { key: "target", label: "评审范围（文件/提交/改动）", default: "工作区所有未提交改动", required: false },
    ],
    prompt: "请评审以下范围：{{target}}\n\n评审维度：正确性、边界与错误处理、可读性、性能、安全。对每个问题给出严重级别（P0-P2）与具体修改建议。最后给出总体结论（通过/需修改）。",
  },
  {
    id: "tpl-review-task",
    name: "评审：测试+安全",
    description: "跑一遍测试 + 安全检查，输出通过/需修改结论",
    tags: ["评审", "测试", "安全"],
    variables: [
      { key: "testCmd", label: "测试命令", default: "npm test", required: false },
      { key: "securityCmd", label: "安全命令", default: "npm audit", required: false },
    ],
    prompt: "请对当前工作区做一次评审（跑测试 + 安全检查）：\n1. 测试：优先运行 {{testCmd}}；若无此命令，先探索项目实际测试方式（package.json scripts、测试目录、语言对应的测试框架）再运行，记录通过/失败、失败项与原因。\n2. 安全：优先运行 {{securityCmd}} 检查依赖漏洞；再人工检查：密钥/凭据泄露（搜索 API_KEY、password=、token、-----BEGIN PRIVATE KEY----- 等常见模式）、危险代码模式（eval、shell 命令拼接、硬编码口令、不安全的反序列化）。\n3. 汇总：给出总体结论（通过/需修改）、问题清单（按严重级别 P0-P2）、每个问题的定位（文件与行号）与修复建议。\n\n报告要具体：命令输出摘要 + 发现的问题。",
  },
  {
    id: "tpl-run-summary",
    name: "跑一遍并总结",
    description: "运行测试/构建并总结结果",
    tags: ["验证"],
    variables: [
      { key: "command", label: "要运行的命令", default: "", required: false },
    ],
    prompt: "请执行项目验证：{{command}}\n\n要求：\n1. 运行并等待结果；\n2. 失败时定位并尝试修复；\n3. 最后总结：通过/失败、失败项、耗时、后续建议。",
  },
];

/** 种子：仅当模板库为空时写入内置模板。 */
export async function ensureSeeded(doc) {
  const data = await doc.load();
  if (!Array.isArray(data.templates) || data.templates.length === 0) {
    data.templates = DEFAULT_TEMPLATES.map((t) => ({ ...t, prompt: t.prompt, createdAt: Date.now() }));
    await doc.save(data);
  }
  return data;
}

export async function listTemplates(doc) {
  const data = await ensureSeeded(doc);
  return data.templates;
}

export async function getTemplate(doc, id) {
  const data = await ensureSeeded(doc);
  return data.templates.find((t) => t.id === id) ?? null;
}

export async function createTemplate(doc, input) {
  const data = await ensureSeeded(doc);
  const name = String(input?.name ?? "").trim();
  const prompt = String(input?.prompt ?? "").trim();
  if (!name || !prompt) throw new Error("模板名称与内容(prompt)不能为空");
  const tpl = {
    id: input.id && /^[a-zA-Z0-9-]{1,64}$/.test(input.id) ? input.id : newId("tpl"),
    name,
    description: String(input?.description ?? "").trim(),
    prompt,
    variables: Array.isArray(input?.variables)
      ? input.variables.map((v) => ({
          key: String(v?.key ?? "").trim(),
          label: String(v?.label ?? v?.key ?? "").trim(),
          default: String(v?.default ?? ""),
          required: v?.required === true,
        })).filter((v) => v.key)
      : [],
    tags: Array.isArray(input?.tags) ? input.tags.map(String) : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (data.templates.some((t) => t.id === tpl.id)) throw new Error("模板 id 已存在: " + tpl.id);
  data.templates.push(tpl);
  await doc.save(data);
  return tpl;
}

export async function updateTemplate(doc, id, input) {
  const data = await ensureSeeded(doc);
  const tpl = data.templates.find((t) => t.id === id);
  if (!tpl) throw new Error("模板不存在: " + id);
  if (input?.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new Error("模板名称不能为空");
    tpl.name = name;
  }
  if (input?.description !== undefined) tpl.description = String(input.description ?? "").trim();
  if (input?.prompt !== undefined) {
    const prompt = String(input.prompt ?? "").trim();
    if (!prompt) throw new Error("模板内容不能为空");
    tpl.prompt = prompt;
  }
  if (Array.isArray(input?.variables)) {
    tpl.variables = input.variables.map((v) => ({
      key: String(v?.key ?? "").trim(),
      label: String(v?.label ?? v?.key ?? "").trim(),
      default: String(v?.default ?? ""),
      required: v?.required === true,
    })).filter((v) => v.key);
  }
  if (Array.isArray(input?.tags)) tpl.tags = input.tags.map(String);
  tpl.updatedAt = Date.now();
  await doc.save(data);
  return tpl;
}

export async function deleteTemplate(doc, id) {
  const data = await ensureSeeded(doc);
  const before = data.templates.length;
  data.templates = data.templates.filter((t) => t.id !== id);
  if (data.templates.length === before) throw new Error("模板不存在: " + id);
  await doc.save(data);
  return true;
}

/** 变量填充：{{key}} -> 值；缺省用 default；必需且缺失时抛出。 */
export function fillTemplate(tpl, values = {}) {
  let text = tpl.prompt;
  const missing = [];
  for (const v of tpl.variables ?? []) {
    const raw = values[v.key];
    const value = raw !== undefined && raw !== null && String(raw).trim() !== ""
      ? String(raw)
      : v.default ?? "";
    if (value.trim() === "" && v.required) missing.push(v.label || v.key);
    text = text.split("{{" + v.key + "}}").join(value);
  }
  if (missing.length) throw new Error("缺少必填变量: " + missing.join("、"));
  return text;
}
