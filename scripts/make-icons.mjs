#!/usr/bin/env node
// Renders the app mark (docs/11 §6: charcoal tile, three rising rounded steps grey → lavender → lime)
// to PNG without dependencies (zlib + a tiny PNG encoder, 4×4 supersampling).
//   node scripts/make-icons.mjs            → apps/web/public/icon-192.png, icon-512.png, icon-maskable.png
//   node scripts/make-icons.mjs <dir> ...  → same files into each <dir>
//   node scripts/make-icons.mjs --mobile   → apps/mobile/assets/icon.png, adaptive-icon.png, monochrome-icon.png
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHARCOAL = [0x26, 0x26, 0x26];
const STEPS = [
  // x, y, w, h, colour on a 48-unit grid (same geometry as the web LogoMark)
  [12, 26, 7, 10, [0x8a, 0x8a, 0x90]],
  [20.5, 20, 7, 16, [0xa9, 0xa3, 0xdb]],
  [29, 14, 7, 22, [0xcd, 0xe3, 0x7a]],
];

function inRoundRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/**
 * RGBA pixels. Modes:
 *  - tile: rounded charcoal tile with the mark
 *  - maskable: full-bleed background with the mark scaled into the 80 % safe zone
 *  - foreground: transparent, the three steps only, inside the central 66 % (Android adaptive icon)
 *  - mono: like foreground but solid white (Android 13 themed icon)
 */
function render(size, mode) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 4;
  const maskable = mode === "maskable";
  const layer = mode === "foreground" || mode === "mono";
  const scale = layer ? (size * 0.66) / 48 : maskable ? (size * 0.8) / 48 : size / 48;
  const off = layer ? size * 0.17 : maskable ? size * 0.1 : 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = (i + (si + 0.5) / SS - off) / scale;
          const y = (j + (sj + 0.5) / SS - off) / scale;
          if (layer) {
            const hit = STEPS.find(([sx, sy, sw, sh]) => inRoundRect(x, y, sx, sy, sw, sh, 3.5));
            if (!hit) continue;
            const col = mode === "mono" ? [255, 255, 255] : hit[4];
            r += col[0]; g += col[1]; b += col[2]; a += 255;
            continue;
          }
          const tile = maskable || inRoundRect(x, y, 0, 0, 48, 48, 14);
          if (!tile) continue;
          let c = CHARCOAL;
          for (const [sx, sy, sw, sh, col] of STEPS) if (inRoundRect(x, y, sx, sy, sw, sh, 3.5)) c = col;
          r += c[0]; g += c[1]; b += c[2]; a += 255;
        }
      }
      const n = SS * SS;
      const o = (j * size + i) * 4;
      const cov = a / n;
      px[o] = cov ? Math.round((r / n) * (255 / cov)) : 0;
      px[o + 1] = cov ? Math.round((g / n) * (255 / cov)) : 0;
      px[o + 2] = cov ? Math.round((b / n) * (255 / cov)) : 0;
      px[o + 3] = Math.round(cov);
    }
  }
  return px;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const args = process.argv.slice(2);
if (args.includes("--mobile")) {
  const dir = join(root, "apps/mobile/assets");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "icon.png"), png(1024, render(1024, "tile")));
  writeFileSync(join(dir, "adaptive-icon.png"), png(1024, render(1024, "foreground")));
  writeFileSync(join(dir, "monochrome-icon.png"), png(1024, render(1024, "mono")));
  console.log(`icons → ${dir}`);
  process.exit(0);
}
const dirs = args.length > 0 ? args : [join(root, "apps/web/public")];
for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "icon-192.png"), png(192, render(192, "tile")));
  writeFileSync(join(dir, "icon-512.png"), png(512, render(512, "tile")));
  writeFileSync(join(dir, "icon-maskable.png"), png(512, render(512, "maskable")));
  console.log(`icons → ${dir}`);
}
