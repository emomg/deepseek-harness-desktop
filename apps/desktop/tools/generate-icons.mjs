// 生成 Tauri 需要的图标：32/128/512 PNG + 32x32 ICO（深蓝渐变 + 白色圆环，无第三方依赖）
// 用法: node tools/generate-icons.mjs
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(import.meta.dirname, "..", "src-tauri", "icons");
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pixelFn(x, y, size) {
  const cx = (x + 0.5) / size - 0.5;
  const cy = (y + 0.5) / size - 0.5;
  const dist = Math.sqrt(cx * cx + cy * cy);
  // 对角渐变：深蓝 -> 蓝紫
  const t = Math.min(1, Math.max(0, (cx + 0.5) * 0.6 + (cy + 0.5) * 0.6));
  let r = Math.round(24 + 60 * t);
  let g = Math.round(70 + 60 * (1 - t));
  let b = Math.round(190 + 40 * (1 - t));
  let a = 255;
  // 白色圆环（外径 0.36，内径 0.27）
  if (dist > 0.27 && dist < 0.36) {
    r = 255; g = 255; b = 255;
  }
  return [r, g, b, a];
}

const png32 = encodePNG(32, pixelFn);
const png128 = encodePNG(128, pixelFn);
const png512 = encodePNG(512, pixelFn);

// ICO: ICONDIR + 1 entry + PNG(32x32)
function encodeICO(pngData) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 32; // width
  entry[1] = 32; // height
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bitcount
  entry.writeUInt32LE(pngData.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([dir, entry, pngData]);
}

fs.writeFileSync(path.join(outDir, "32x32.png"), png32);
fs.writeFileSync(path.join(outDir, "128x128.png"), png128);
fs.writeFileSync(path.join(outDir, "icon.png"), png512);
fs.writeFileSync(path.join(outDir, "icon.ico"), encodeICO(png32));
console.log("icons written to", outDir);
