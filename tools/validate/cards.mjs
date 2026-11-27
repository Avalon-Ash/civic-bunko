// 卡片驗收：node --import tsx tools/validate/cards.mjs（npm run validate）
// 字數上限只在 src/core/constants/cards.ts，這裡直接讀它。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { LAWS_DIR, listPacks, packPaths } from '../paths.mjs';
import {
  CARD_FACE_LINES_MAX,
  CARD_FACES_MAX,
  CARD_HEADING_MAX,
  CARD_HOOK_MAX,
  CARD_LINE_MAX,
  CARD_TITLE_MAX,
  CARD_VISUAL_TEXT_MAX,
} from '../../src/core/constants/cards.ts';

const LIMIT = {
  title: CARD_TITLE_MAX,
  hook: CARD_HOOK_MAX,
  heading: CARD_HEADING_MAX,
  line: CARD_LINE_MAX,
  faceLines: CARD_FACE_LINES_MAX,
  faces: CARD_FACES_MAX,
  visualText: CARD_VISUAL_TEXT_MAX,
};
const KINDS = new Set(['concept', 'newlaw', 'essay']);
const TONES = new Set(['plain', 'hot', 'key']);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const len = (s) => [...s].length;

const packs = listPacks();
if (packs.length === 0) {
  console.error('ERROR 找不到任何內容包（data/packs/*/pack.json）');
  process.exit(1);
}

const lawIndex = read(join(LAWS_DIR, 'index.json'));
const lawByName = new Map(lawIndex.laws.map((l) => [l.name, l.pcode]));
const lawArticles = new Map();
const hasArticle = (law, article) => {
  const pcode = lawByName.get(law);
  if (!pcode) return false;
  if (!lawArticles.has(pcode)) lawArticles.set(pcode, new Set(read(join(LAWS_DIR, `${pcode}.json`)).articles.map((a) => a.no)));
  return lawArticles.get(pcode).has(article);
};

const globalCardIds = new Map();
let hasError = false;

for (const packId of packs) {
  const paths = packPaths(packId);
  const pack = read(paths.packFile);
  const subjects = new Set((pack.subjects ?? []).map((s) => s.key));

  const errors = [];
  const ids = new Set();
  const essays = new Set();
  let cardCount = 0;
  const dir = paths.cardsDir;
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];

  for (const f of files) {
    const file = read(join(dir, f));
    const err = (id, msg) => errors.push(`${f} ${id}: ${msg}`);
    if (file.deck !== f.replace(/\.json$/, '')) err('-', `deck「${file.deck}」與檔名不符`);
    if (typeof file.title !== 'string' || !file.title) err('-', '缺 title');
    if (!Array.isArray(file.cards) || file.cards.length === 0) {
      err('-', 'cards 是空的');
      continue;
    }
    for (const c of file.cards) {
      cardCount += 1;
      const id = typeof c.id === 'string' ? c.id : '(無 id)';
      if (!/^[a-z0-9-]+$/.test(id)) err(id, 'id 只能用小寫英數與連字號');
      if (ids.has(id)) err(id, 'id 重複');
      else if (globalCardIds.has(id)) err(id, `id 與內容包 ${globalCardIds.get(id)} 重複`);
      else globalCardIds.set(id, packId);
      ids.add(id);
      if (!KINDS.has(c.kind)) err(id, `kind 不合法：${c.kind}`);
      if (c.subjectKey !== null && !subjects.has(c.subjectKey)) err(id, `subjectKey 不在 pack.json：${c.subjectKey}`);
      for (const [key, max] of [['title', LIMIT.title], ['hook', LIMIT.hook]]) {
        if (typeof c[key] !== 'string' || !c[key].trim()) err(id, `缺 ${key}`);
        else if (len(c[key]) > max) err(id, `${key} ${len(c[key])} 字，上限 ${max}`);
      }
      if (!Array.isArray(c.faces) || c.faces.length === 0 || c.faces.length > LIMIT.faces) {
        err(id, `faces 要 1–${LIMIT.faces} 面`);
      } else {
        c.faces.forEach((face, i) => {
          if (typeof face.heading !== 'string' || !face.heading.trim()) err(id, `第 ${i + 1} 面缺 heading`);
          else if (len(face.heading) > LIMIT.heading) err(id, `第 ${i + 1} 面 heading ${len(face.heading)} 字，上限 ${LIMIT.heading}`);
          if (!Array.isArray(face.lines) || face.lines.length === 0 || face.lines.length > LIMIT.faceLines) {
            err(id, `第 ${i + 1} 面要 1–${LIMIT.faceLines} 行`);
            return;
          }
          face.lines.forEach((line, j) => {
            if (typeof line !== 'string' || !line.trim()) err(id, `第 ${i + 1} 面第 ${j + 1} 行是空的`);
            else if (len(line) > LIMIT.line) err(id, `第 ${i + 1} 面第 ${j + 1} 行 ${len(line)} 字，上限 ${LIMIT.line}`);
          });
        });
      }
      if (c.visual !== null) {
        const v = c.visual;
        const texts = [];
        if (v?.kind === 'flow' && Array.isArray(v.lanes) && v.lanes.length > 0) {
          for (const lane of v.lanes) {
            if (!Array.isArray(lane.steps) || lane.steps.length < 2 || lane.steps.length > 5) err(id, 'flow 每列要 2–5 步');
            for (const s of lane.steps ?? []) {
              if (!TONES.has(s.tone)) err(id, `tone 不合法：${s.tone}`);
              texts.push(s.text);
            }
          }
        } else if (v?.kind === 'versus' && v.left && v.right) {
          for (const side of [v.left, v.right]) {
            texts.push(side.title);
            if (!Array.isArray(side.points) || side.points.length === 0 || side.points.length > 3) err(id, 'versus 每邊要 1–3 點');
            texts.push(...(side.points ?? []));
          }
        } else {
          err(id, 'visual 形狀不合法');
        }
        for (const t of texts) {
          if (typeof t !== 'string' || !t.trim()) err(id, 'visual 有空字串');
          else if (len(t) > LIMIT.visualText) err(id, `visual 文字「${t}」${len(t)} 字，上限 ${LIMIT.visualText}`);
        }
      }
      if (!Array.isArray(c.lawRefs)) err(id, 'lawRefs 要是陣列');
      else for (const r of c.lawRefs) if (!hasArticle(r.law, r.article)) err(id, `法條查不到：${r.law} 第 ${r.article} 條`);
      if ('essayText' in c) err(id, '卡片檔不得寫 essayText（由官方層填入）');
      if (c.kind === 'essay') {
        const p = c.essay;
        const officialPath = p ? join(paths.officialDir, `${p.paperId}.json`) : null;
        if (!p || !officialPath || !existsSync(officialPath)) err(id, '申論卡的 essay 指不到官方試卷');
        else if (!read(officialPath).essays.some((e) => e.no === p.no)) err(id, `官方試卷 ${p.paperId} 沒有申論第 ${p.no} 題`);
        else {
          const key = `${p.paperId}#${p.no}`;
          if (essays.has(key)) err(id, `同一題申論有兩張卡：${key}`);
          essays.add(key);
        }
      } else if (c.essay !== null) {
        err(id, '非申論卡的 essay 必須是 null');
      }
    }
  }

  for (const e of errors) console.error(`ERROR [${packId}] ${e}`);
  console.log(`[${packId}] cards files=${files.length} cards=${cardCount} essays=${essays.size} ERROR=${errors.length}`);
  if (errors.length > 0) hasError = true;
}

process.exit(hasError ? 1 : 0);
