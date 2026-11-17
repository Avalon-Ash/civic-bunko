// 驗收腳本（主代理維護，執行代理不得修改）。逐包檢查 data/packs/*。
// 檢查各內容包 enrich/<PaperId>.json：形狀、字數上限、標記、法條引用、考點分類。
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LAWS_DIR, listPacks, packPaths } from '../paths.mjs';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const len = (s) => [...String(s)].length;

const LIMIT = { mnemonic: 40, trap: 30, plain: 60, why: 50, step: 12, title: 10, point: 16, lawChanged: 80 };
const NEGATIVE_ASK = /何者(?:有誤|錯誤|不正確|為非|非屬|不屬|不是|不在|不包括|不得|不適用|不符|無法|不能|不須|不必|未)|下列(?:敘述)?何者.{0,12}(?:錯誤|不正確)|非屬|不屬於|不包括/;
const CHOICES = ['A', 'B', 'C', 'D'];

const packs = listPacks();
if (packs.length === 0) {
  console.error('ERROR 找不到任何內容包（data/packs/*/pack.json）');
  process.exit(1);
}

const lawIndex = new Map(readJson(join(LAWS_DIR, 'index.json')).laws.map((l) => [l.name, l.pcode]));
const lawCache = new Map();
const hasArticle = (law, article) => {
  const pcode = lawIndex.get(law);
  if (!pcode) return false;
  if (!lawCache.has(pcode)) lawCache.set(pcode, new Set(readJson(join(LAWS_DIR, `${pcode}.json`)).articles.map((a) => a.no)));
  return lawCache.get(pcode).has(String(article));
};

let hasError = false;

for (const packId of packs) {
  const paths = packPaths(packId);
  const errors = [];
  const err = (m) => errors.push(m);

  const topics = new Map(readJson(paths.topicsFile).topics.map((t) => [t.id, t.subjectKey]));
  const dir = paths.enrichDir;
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  let items = 0;
  let lowConfidence = 0;
  let lawChanged = 0;
  for (const name of files) {
    const f = readJson(join(dir, name));
    const paperId = name.replace(/\.json$/, '');
    if (f.paperId !== paperId) err(`${name} paperId 不符檔名`);
    const officialPath = join(paths.officialDir, `${paperId}.json`);
    if (!existsSync(officialPath)) { err(`${name} 沒有對應的官方試卷`); continue; }
    if (typeof f.model !== 'string' || !f.model || typeof f.generatedAt !== 'string') err(`${name} 缺 model 或 generatedAt`);
    const paper = readJson(officialPath);
    const byId = new Map(paper.questions.map((q) => [q.id, q]));
    const seen = new Set();
    for (const it of Array.isArray(f.items) ? f.items : []) {
      const tag = it.id;
      const q = byId.get(it.id);
      if (!q) { err(`${tag} 不是這份試卷的題目`); continue; }
      if (seen.has(it.id)) err(`${tag} 重複`);
      seen.add(it.id);
      items++;
      if (!['high', 'low'].includes(it.confidence)) err(`${tag} confidence 必須是 high 或 low`);
      if (it.confidence === 'low') lowConfidence++;
      if (it.reviewed !== false && it.reviewed !== true) err(`${tag} 缺 reviewed`);
      if (!Array.isArray(it.topic) || it.topic.length < 1 || it.topic.length > 2) err(`${tag} topic 要 1–2 個`);
      for (const t of it.topic ?? []) if (topics.get(t) !== paper.paper.subjectKey) err(`${tag} topic「${t}」不存在或不屬於本科`);
      for (const k of ['mnemonic', 'trap']) {
        if (typeof it[k] !== 'string' || !it[k].trim()) err(`${tag} 缺 ${k}`);
        else if (len(it[k]) > LIMIT[k]) err(`${tag} ${k} ${len(it[k])} 字，上限 ${LIMIT[k]}`);
      }
      if (it.plain !== null && (typeof it.plain !== 'string' || len(it.plain) > LIMIT.plain)) err(`${tag} plain 超過 ${LIMIT.plain} 字或型別不對`);
      if (it.lawChanged !== null) {
        if (typeof it.lawChanged !== 'string' || len(it.lawChanged) > LIMIT.lawChanged) err(`${tag} lawChanged 超過 ${LIMIT.lawChanged} 字或型別不對`);
        else lawChanged++;
      }
      const marks = Array.isArray(it.marks) ? it.marks : (err(`${tag} marks 必須是陣列`), []);
      for (const m of marks) {
        if (!['red', 'blue'].includes(m.color)) err(`${tag} 標記顏色不合法`);
        if (typeof m.text !== 'string' || !m.text || !q.stem.includes(m.text)) err(`${tag} 標記「${m.text}」不是題幹裡的原文`);
      }
      if (marks.filter((m) => m.color === 'blue').length > 3) err(`${tag} 藍標超過 3 個`);
      if (NEGATIVE_ASK.test(q.stem) && !marks.some((m) => m.color === 'red')) err(`${tag} 題幹是反向問法，缺紅標`);
      for (const c of CHOICES) {
        const o = it.options?.[c];
        if (!o || typeof o.why !== 'string' || !o.why.trim()) { err(`${tag} 選項 ${c} 缺 why`); continue; }
        if (len(o.why) > LIMIT.why) err(`${tag} 選項 ${c} why ${len(o.why)} 字，上限 ${LIMIT.why}`);
        if (o.lawRef !== null) {
          if (!o.lawRef || !hasArticle(o.lawRef.law, o.lawRef.article)) err(`${tag} 選項 ${c} 引用「${o.lawRef?.law} 第 ${o.lawRef?.article} 條」在 data/laws 查不到`);
        }
      }
      const v = it.visual;
      if (v !== null) {
        if (v?.kind === 'flow') {
          if (!Array.isArray(v.lanes) || v.lanes.length < 1 || v.lanes.length > 3) err(`${tag} flow 要 1–3 列`);
          for (const lane of v.lanes ?? []) {
            if (!Array.isArray(lane.steps) || lane.steps.length < 2 || lane.steps.length > 4) err(`${tag} flow 每列 2–4 步`);
            for (const s of lane.steps ?? []) {
              if (!['plain', 'hot', 'key'].includes(s.tone)) err(`${tag} flow 步驟 tone 不合法`);
              if (typeof s.text !== 'string' || !s.text || len(s.text) > LIMIT.step) err(`${tag} flow 步驟文字要 1–${LIMIT.step} 字`);
            }
          }
        } else if (v?.kind === 'versus') {
          for (const side of [v.left, v.right]) {
            if (!side || typeof side.title !== 'string' || len(side.title) > LIMIT.title) { err(`${tag} versus 標題超過 ${LIMIT.title} 字或缺少`); continue; }
            if (!Array.isArray(side.points) || side.points.length < 1 || side.points.length > 3) err(`${tag} versus 每邊 1–3 點`);
            for (const p of side.points ?? []) if (typeof p !== 'string' || len(p) > LIMIT.point) err(`${tag} versus 每點上限 ${LIMIT.point} 字`);
          }
        } else err(`${tag} visual.kind 只能是 flow 或 versus`);
      }
    }
    const missing = paper.questions.filter((q) => q.parseStatus === 'ok' && !seen.has(q.id)).length;
    if (missing) err(`${name} 還有 ${missing} 題沒有加工`);
  }
  for (const m of errors) console.error(`ERROR [${packId}] ${m}`);
  console.log(`[${packId}] enrich files=${files.length} items=${items} low_confidence=${lowConfidence} law_changed=${lawChanged} ERROR=${errors.length}`);
  if (errors.length > 0) hasError = true;
}

process.exit(hasError ? 1 : 0);
