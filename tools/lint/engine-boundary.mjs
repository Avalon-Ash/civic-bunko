// 韁繩（主代理維護）：引擎（src/**）不得認識任何一個內容包。
// 1. 讀 data/packs/*/pack.json，把 id、科目 key／名稱／短名、考試別 key／顯示名稱當成禁用字面值，
//    在 src/**/*.ts(x)（排除 *.test.ts(x)、src/testing/**）的字串字面值裡出現就報錯（註解先去掉）。
// 2. 只有 src/data/** 可以引用專案根目錄 data/ 底下的檔案。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packsDir = join(root, 'data/packs');
const BS = String.fromCharCode(92);
const rel = (p) => p.slice(root.length + 1).split(sep).join('/');

// ── 禁用字面值 ─────────────────────────────────────────────
const banned = new Map(); // 字面值 → 來源說明
const ban = (value, from) => {
  if (typeof value === 'string' && value.length > 0 && !banned.has(value)) banned.set(value, from);
};
let packCount = 0;
if (existsSync(packsDir)) {
  for (const name of readdirSync(packsDir).sort()) {
    const f = join(packsDir, name, 'pack.json');
    if (!existsSync(f)) continue;
    packCount++;
    const pack = JSON.parse(readFileSync(f, 'utf8'));
    const tag = `pack ${pack.id ?? name}`;
    ban(pack.id, `${tag} id`);
    ban(name, `${tag} 資料夾名`);
    for (const s of pack.subjects ?? []) {
      ban(s.key, `${tag} 科目 key`);
      ban(s.name, `${tag} 科目名稱`);
      ban(s.short, `${tag} 科目短名`);
    }
    for (const e of pack.exams ?? []) {
      ban(e.key, `${tag} 考試別 key`);
      ban(e.label, `${tag} 考試別名稱`);
    }
  }
}

// ── 去註解並取出字串字面值 ─────────────────────────────────
/** 回傳 [{ line, text }]：每個字串字面值（含樣板字串的靜態片段）與所在行。註解被略過。 */
function stringLiterals(src) {
  const out = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const startLine = line;
      let text = '';
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === BS) { text += src[i + 1] ?? ''; i += 2; continue; }
        text += src[i++];
      }
      i++;
      out.push({ line: startLine, text });
      continue;
    }
    if (c === '`') {
      i++;
      let text = '';
      let startLine = line;
      while (i < n && src[i] !== '`') {
        if (src[i] === BS) { text += src[i + 1] ?? ''; i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          out.push({ line: startLine, text });
          text = '';
          // 略過插值運算式（簡化：配對大括號；內部字串另外掃）
          let depth = 1;
          i += 2;
          const exprStart = i;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            if (src[i] === '\n') line++;
            i++;
          }
          for (const lit of stringLiterals(src.slice(exprStart, i - 1))) out.push({ line: line - (src.slice(exprStart, i - 1).split('\n').length - 1) + lit.line - 1, text: lit.text });
          startLine = line;
          continue;
        }
        if (src[i] === '\n') line++;
        text += src[i++];
      }
      i++;
      out.push({ line: startLine, text });
      continue;
    }
    // 正規表達式字面值與除法難以區分；不含引號時不影響掃描，直接略過
    i++;
  }
  return out;
}

// ── 掃描 ───────────────────────────────────────────────────
const hits = [];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name)) files.push(p);
  }
};
const srcDir = join(root, 'src');
if (existsSync(srcDir)) walk(srcDir);

for (const p of files) {
  const r = rel(p);
  if (/\.test\.tsx?$/.test(r) || r.startsWith('src/testing/')) continue;
  const inDataLayer = r.startsWith('src/data/');
  for (const { line, text } of stringLiterals(readFileSync(p, 'utf8'))) {
    if (!inDataLayer) {
      for (const [value, from] of banned) {
        if (text.includes(value)) hits.push(`${r}:${line} 引擎出現內容包字面值「${value}」（${from}）`);
      }
      const resolved = /^\.{1,2}\//.test(text) ? resolve(dirname(p), text) : null;
      // 相對路徑看解析後落點；其餘（glob、絕對寫法）看有沒有 data/packs、data/laws、data/raw
      const intoData = resolved
        ? resolved === join(root, 'data') || resolved.startsWith(join(root, 'data') + sep)
        : /(^|\/)data\/(packs|laws|raw)(\/|$)/.test(text);
      if (intoData) hits.push(`${r}:${line} 只有 src/data/** 可以引用 data/ 底下的檔案（「${text}」）`);
    }
  }
}

for (const h of hits) console.error('ERROR ' + h);
console.log(`engine-boundary packs=${packCount} banned=${banned.size} files=${files.length} ERROR=${hits.length}`);
process.exit(hits.length ? 1 : 0);
