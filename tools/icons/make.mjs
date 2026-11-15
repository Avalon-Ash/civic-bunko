// 產生主畫面圖示（原創八字臉貓）。零依賴：自己點陣化並編碼成 PNG。
// 用法：node tools/icons/make.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = resolve(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const C = { bg: hex('#ffc2cf'), fur: hex('#fffdf9'), patch: hex('#c9ad94'), ink: hex('#5a4636'), blush: hex('#ff9fb4') };

// 以 64×64 的座標畫貓，再縮放置中。
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const inTri = (x, y, [ax, ay], [bx, by], [cx, cy]) => {
  const s = (px, py, qx, qy) => (x - qx) * (py - qy) - (px - qx) * (y - qy);
  const d1 = s(ax, ay, bx, by), d2 = s(bx, by, cx, cy), d3 = s(cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const distSeg = (x, y, [ax, ay], [bx, by]) => {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
};
const EARS = [
  [[9, 30], [12, 5], [30, 18]],
  [[55, 30], [52, 5], [34, 18]],
];
const MOUTH = [[27, 46.5], [29.5, 48.6], [32, 46.5], [34.5, 48.6], [37, 46.5]];
const OUT = 1.6; // 外框粗細

function colorAt(x, y) {
  // 嘴、眼
  for (let i = 0; i < MOUTH.length - 1; i++) if (distSeg(x, y, MOUTH[i], MOUTH[i + 1]) < 0.9) return C.ink;
  if (inEllipse(x, y, 22.5, 40, 2.9, 2.9) || inEllipse(x, y, 41.5, 40, 2.9, 2.9)) return C.ink;
  const head = inEllipse(x, y, 32, 39, 26, 21);
  if (head) {
    if (!inEllipse(x, y, 32, 39, 26 - OUT, 21 - OUT)) return C.ink;
    if (inEllipse(x, y, 14.5, 46, 4.6, 3.1) || inEllipse(x, y, 49.5, 46, 4.6, 3.1)) return C.blush;
    // 八字花紋：中間留一道往下變寬的白
    const gap = 1.5 + Math.max(0, y - 18) * 0.62;
    if (y < 45 && Math.abs(x - 32) > gap) return C.patch;
    return C.fur;
  }
  for (const [a, b, c] of EARS) {
    if (inTri(x, y, a, b, c)) {
      const edge = Math.min(distSeg(x, y, a, b), distSeg(x, y, b, c));
      return edge < OUT ? C.ink : C.patch;
    }
  }
  return C.bg;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function render(size) {
  const SS = 4; // 超取樣
  const scale = (size * 0.8) / 64; // 貓佔 80%
  const ox = (size - 64 * scale) / 2, oy = (size - 64 * scale) / 2 + size * 0.03;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colorAt((px + (sx + 0.5) / SS - ox) / scale, (py + (sy + 0.5) / SS - oy) / scale);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      raw[o] = Math.round(r / SS / SS); raw[o + 1] = Math.round(g / SS / SS); raw[o + 2] = Math.round(b / SS / SS);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [180, 192, 512]) {
  const png = render(size);
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
  console.log(`icon-${size}.png ${png.length} bytes`);
}
