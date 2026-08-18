//! dsh-files 文档解析测试（需要 mammoth/read-excel-file/pdfjs-dist：
//! 先在插件目录 npm install）
import { createRequire } from "node:module";
import { join } from "node:path";
import { sniffFormat, parseDocument, defineReadDocumentTool } from "../lib/index.js";

export async function run() {
  const ok = (cond, label) => { if (!cond) throw new Error("FAIL " + label); };
  const require = createRequire(join(import.meta.dirname, "..", "noop.js"));

  // ---- 生成最小 DOCX / XLSX ----
  const JSZip = require("jszip");
  const docxBuf = await buildDocx(JSZip);
  const xlsxBuf = await buildXlsx(JSZip);

  ok(sniffFormat(new Uint8Array(docxBuf)) === "docx", "docx sniff");
  ok(sniffFormat(new Uint8Array(xlsxBuf)) === "xlsx", "xlsx sniff");

  const docxText = await parseDocument(new Uint8Array(docxBuf), "docx", { sheetRowLimit: 200, maxSheets: 5 });
  ok(docxText.includes("Hello dsh-files"), "docx text");
  ok(docxText.includes("中文"), "docx chinese");

  const xlsxText = await parseDocument(new Uint8Array(xlsxBuf), "xlsx", { sheetRowLimit: 200, maxSheets: 5 });
  ok(xlsxText.includes("苹果") && xlsxText.includes("42"), "xlsx cells");
  ok(xlsxText.includes("Sheet2"), "xlsx multi-sheet");

  // ---- read_document 工具结构 ----
  const fsMock = {
    async resolve(p) { return { targetKey: p, displayPath: p }; },
    async stat() { return { version: "v1", type: "file", size: 10 }; },
    async readBytes(t) { return new TextEncoder().encode("line1\nline2\nline3"); }
  };
  const tool = defineReadDocumentTool({ get: (n) => (n === "fs" ? fsMock : undefined), emit() {} }, {
    readLimit: 800, maxFileBytes: 1 << 24, sheetRowLimit: 200, maxSheets: 5, maxOutputChars: 50000
  });
  ok(tool.name === "read_document", "tool name");
  ok(typeof tool.execute === "function", "tool execute");

  return "docx/xlsx/read_document";
}

async function buildDocx(JSZip) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello dsh-files</w:t></w:r></w:p><w:p><w:r><w:t>第二段 中文</w:t></w:r></w:p></w:body></w:document>');
  return await zip.generateAsync({ type: "nodebuffer" });
}

async function buildXlsx(JSZip) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file("xl/workbook.xml", '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/><sheet name="Sheet2" sheetId="2" r:id="rId2"/></sheets></workbook>');
  zip.file("xl/_rels/workbook.xml.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>');
  zip.file("xl/worksheets/sheet1.xml", '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Value</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>苹果</t></is></c><c r="B2"><v>42</v></c></row></sheetData></worksheet>');
  zip.file("xl/worksheets/sheet2.xml", '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>SecondSheet</t></is></c></row></sheetData></worksheet>');
  return await zip.generateAsync({ type: "nodebuffer" });
}
