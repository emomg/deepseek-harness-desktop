//! dsh-files 无头测试入口：node test/run-all.js
//! 依赖：需先在插件目录执行 npm install（mammoth/pdfjs-dist/read-excel-file）
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const files = (await fs.readdir(here)).filter((f) => f.endsWith(".test.js")).sort();
let pass = 0;
const failed = [];
for (const f of files) {
  const mod = await import("./" + f);
  try {
    const label = await mod.run();
    console.log("  ✓ " + f + "  →  " + label);
    pass++;
  } catch (e) {
    console.error("  ✗ " + f + "  →  " + (e?.stack ?? e));
    failed.push(f);
  }
}
console.log("");
console.log(failed.length === 0
  ? "ALL TESTS PASSED (" + pass + "/" + files.length + ")"
  : "FAILED: " + failed.join(", ") + "  (" + (files.length - failed.length) + "/" + files.length + " passed)");
process.exit(failed.length === 0 ? 0 : 1);
