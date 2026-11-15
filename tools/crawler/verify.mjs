// 驗收腳本（主代理維護，執行代理不得修改）。
// 檢查 data/raw/manifest.json 與實際下載的 PDF 是否完整、可追溯。
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const targets = JSON.parse(readFileSync(resolve(root, 'tools/crawler/targets.json'), 'utf8'));
const manifestPath = resolve(root, 'data/raw/manifest.json');
const errors = [];
const fail = (m) => errors.push(m);

if (!existsSync(manifestPath)) {
  console.error('ERROR data/raw/manifest.json 不存在');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.files)) fail('manifest.files 必須是陣列');
const files = Array.isArray(manifest.files) ? manifest.files : [];

const REQUIRED = ['examCode', 'year', 'exam', 'classCode', 'classLabel', 'subjectKey', 'subjectCode', 'subjectName', 'type', 'url', 'file', 'sha256', 'bytes', 'downloadedAt'];
const seen = new Set();
for (const f of files) {
  const tag = `${f.examCode}/${f.subjectKey}/${f.type}`;
  for (const k of REQUIRED) if (f[k] === undefined || f[k] === null || f[k] === '') fail(`${tag} 缺欄位 ${k}`);
  if (!['Q', 'S', 'M'].includes(f.type)) fail(`${tag} type 不合法`);
  if (seen.has(tag)) fail(`${tag} 重複`);
  seen.add(tag);
  const expectUrl = `${targets.baseUrl}wHandExamQandA_File.ashx?t=${f.type}&code=${f.examCode}&c=${f.classCode}&s=${f.subjectCode}&q=1`;
  if (f.url !== expectUrl) fail(`${tag} url 與欄位不一致`);
  if (typeof f.classLabel !== 'string' || !f.classLabel.includes(targets.classMatch.className)) fail(`${tag} classLabel 不是${targets.classMatch.className}`);
  const p = resolve(root, String(f.file));
  if (!p.startsWith(resolve(root, 'data/raw'))) { fail(`${tag} file 不在 data/raw 內`); continue; }
  if (!existsSync(p)) { fail(`${tag} 檔案不存在 ${f.file}`); continue; }
  const buf = readFileSync(p);
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') fail(`${tag} 不是 PDF`);
  if (buf.length !== f.bytes) fail(`${tag} bytes 不符`);
  if (createHash('sha256').update(buf).digest('hex') !== f.sha256) fail(`${tag} sha256 不符`);
}

for (const e of targets.exams) {
  const mine = files.filter((f) => f.examCode === e.code);
  const labels = new Set(mine.map((f) => f.classLabel));
  if (labels.size > 1) fail(`${e.code} 混入多個類科：${[...labels].join('、')}`);
  for (const l of labels) if (!String(l).includes(e.levelIncludes)) fail(`${e.code} 類科等級不含「${e.levelIncludes}」：${l}`);
  for (const s of targets.subjects) {
    const sub = mine.filter((f) => f.subjectKey === s.key);
    if (!sub.some((f) => f.type === 'Q')) fail(`${e.code} ${s.key} 缺試題`);
    if (!sub.some((f) => f.type === 'S')) fail(`${e.code} ${s.key} 缺答案`);
    for (const f of sub) if (!String(f.subjectName).startsWith(s.startsWith)) fail(`${e.code} ${s.key} 科目名稱不符：${f.subjectName}`);
  }
}
// 已實測的事實：115 年普考行政法與法學知識都有更正答案。
for (const k of ['admin-law', 'law-english']) {
  if (!files.some((f) => f.examCode === '115080' && f.subjectKey === k && f.type === 'M')) fail(`115080 ${k} 應有更正答案`);
}

const count = (t) => files.filter((f) => f.type === t).length;
console.log(`files=${files.length} Q=${count('Q')} S=${count('S')} M=${count('M')} ERROR=${errors.length}`);
for (const m of errors) console.error('ERROR ' + m);
process.exit(errors.length ? 1 : 0);
