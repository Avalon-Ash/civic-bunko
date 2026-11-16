// 驗證 data/zh/**（英文題的中譯與單字表）：每一題英文題都有中譯、題組逐句對照拼回去等於官方原文。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, 'data/zh');
const CHOICES = ['A', 'B', 'C', 'D'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const isEnglish = (s) => (s.match(/[A-Za-z]/g) ?? []).length > s.length * 0.4;
const hasChinese = (s) => /[一-鿿]/.test(s);

let errors = 0;
let items = 0;
let segments = 0;
const err = (where, msg) => {
  errors += 1;
  console.error(`ERROR ${where}: ${msg}`);
};

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort() : [];
for (const file of files) {
  const zh = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const officialPath = path.join(ROOT, 'data/official', file);
  if (!fs.existsSync(officialPath)) {
    err(file, '沒有對應的官方試卷');
    continue;
  }
  const official = JSON.parse(fs.readFileSync(officialPath, 'utf8'));
  if (zh.paperId !== official.paper.id) err(file, 'paperId 與官方試卷不符');

  const groupById = new Map(official.groups.map((g) => [g.id, g]));
  const seenGroups = new Set();
  for (const g of zh.groups) {
    const src = groupById.get(g.id);
    if (!src) {
      err(g.id, '官方試卷沒有這個題組');
      continue;
    }
    seenGroups.add(g.id);
    if (norm(g.segments.map((s) => s.en).join(' ')) !== norm(src.text)) {
      err(g.id, '逐句英文拼回去與官方原文不同');
    }
    for (const [i, s] of g.segments.entries()) {
      segments += 1;
      if (typeof s.zh !== 'string' || !hasChinese(s.zh)) err(g.id, `第 ${i + 1} 句沒有中譯`);
    }
    for (const v of g.vocab) {
      if (!v.en || !v.zh) err(g.id, '單字表有空欄位');
    }
  }

  const zhById = new Map(zh.items.map((it) => [it.id, it]));
  if (zhById.size !== zh.items.length) err(file, '題目 ID 重複');
  for (const q of official.questions) {
    const needs = isEnglish(q.stem) || (q.groupId && groupById.has(q.groupId) && isEnglish(groupById.get(q.groupId).text));
    const it = zhById.get(q.id);
    if (!needs) {
      if (it) err(q.id, '不是英文題卻有中譯');
      continue;
    }
    if (!it) {
      err(q.id, '英文題沒有中譯');
      continue;
    }
    items += 1;
    if (q.groupId && !seenGroups.has(q.groupId)) err(q.id, '所屬題組沒有逐句對照');
    if (isEnglish(q.stem)) {
      if (typeof it.stem !== 'string' || !hasChinese(it.stem)) err(q.id, '題幹沒有中譯');
      else if (q.stem.includes('_____') !== it.stem.includes('＿＿')) err(q.id, '空格標記與原文不一致');
    } else if (it.stem !== null) {
      err(q.id, '題幹不是英文，stem 應為 null');
    }
    for (const c of CHOICES) {
      if (typeof it.options?.[c] !== 'string' || !hasChinese(it.options[c])) err(q.id, `選項 ${c} 沒有中譯`);
    }
    if (!Array.isArray(it.vocab)) err(q.id, 'vocab 不是陣列');
    else for (const v of it.vocab) if (!v.en || !v.zh) err(q.id, '單字表有空欄位');
  }
  for (const id of zhById.keys()) {
    if (!official.questions.some((q) => q.id === id)) err(id, '官方試卷沒有這一題');
  }
}

console.log(`zh files=${files.length} items=${items} segments=${segments} ERROR=${errors}`);
if (errors > 0) process.exit(1);
