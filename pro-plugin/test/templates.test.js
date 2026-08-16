//! templates 测试：种子/CRUD/填充。
import { strict as assert } from "node:assert";
import { jsonDoc } from "../lib/store.js";
import * as templates from "../lib/templates.js";
import { tempDataDir } from "./helpers.js";

export async function run() {
  const t = await tempDataDir();
  try {
    const doc = jsonDoc(t.dir, "templates.json", { templates: [] });
    // 种子
    await templates.ensureSeeded(doc);
    const seeded = await templates.listTemplates(doc);
    assert.ok(seeded.length >= 4, "内置模板 >= 4");
    // 创建
    const created = await templates.createTemplate(doc, {
      name: "冒烟测试",
      prompt: "运行 {{cmd}} 并总结",
      variables: [{ key: "cmd", label: "命令", default: "npm test", required: false }],
    });
    assert.ok(created.id, "有 id");
    assert.equal(created.name, "冒烟测试");
    // 重复 id 报错
    await assert.rejects(() => templates.createTemplate(doc, { id: created.id, name: "x", prompt: "y" }));
    // 填充
    const filled = templates.fillTemplate(created, { cmd: "pnpm test" });
    assert.equal(filled, "运行 pnpm test 并总结");
    // 缺必填
    const required = await templates.createTemplate(doc, {
      name: "必填", prompt: "需要 {{x}}", variables: [{ key: "x", label: "X", required: true }],
    });
    assert.throws(() => templates.fillTemplate(required, {}), /缺少必填变量/);
    // 更新 + 删除
    const updated = await templates.updateTemplate(doc, created.id, { name: "改名" });
    assert.equal(updated.name, "改名");
    await templates.deleteTemplate(doc, created.id);
    assert.equal(await templates.getTemplate(doc, created.id), null);
    return "templates OK";
  } finally {
    await t.restore();
  }
}
