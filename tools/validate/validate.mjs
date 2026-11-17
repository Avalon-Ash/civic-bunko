// 驗收腳本（主代理維護，執行代理不得修改）。逐包檢查 data/packs/*。
// 檢查各內容包 official/** 是否完整、可追溯到 data/raw/manifest.json，且形狀符合 src/core/types.ts。
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { listPacks, packPaths, RAW_DIR, ROOT } from '../paths.mjs';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const NEEDS_REVIEW_MAX_RATIO = 0.05;
const CHOICES = ['A', 'B', 'C', 'D'];
const BAD_CHARS = /[-�]/;
const HEADER_LEAK = /考\s*試\s*別|等\s*_*\s*別：|類\s*_*\s*科：|科\s*_*\s*目：|本科目共|禁止使用電子計算器|特\s*種\s*考\s*試|不予計分|本試題為|乙、測驗|甲、申論|作文部分|座號/;

async function declaredMcqCount(file) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(resolve(ROOT, file))), verbosity: 0 }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    text += tc.items.map((it) => it.str).join('');
  }
  const m = text.replace(/\s/g, '').match(/單選題數[:：](\d+)題/);
  return m ? Number(m[1]) : null;
}

const packs = listPacks();
if (packs.length === 0) {
  console.error('ERROR 找不到任何內容包（data/packs/*/pack.json）');
  process.exit(1);
}

const manifest = readJson(join(RAW_DIR, 'manifest.json'));
const manifestByPaper = new Map();
for (const f of manifest.files) {
  const id = `${f.year}-${f.exam}-${f.subjectKey}`;
  if (!manifestByPaper.has(id)) {
    manifestByPaper.set(id, { exam: f.exam, subjectKey: f.subjectKey });
  }
  manifestByPaper.get(id)[f.type] = f;
}

const goldenDir = join(ROOT, 'tools/validate/golden');
const goldenFiles = (existsSync(goldenDir) ? readdirSync(goldenDir) : [])
  .filter((name) => name.endsWith('.json'))
  .map((name) => readJson(join(goldenDir, name)));

const globalPaperIds = new Map();
const globalQuestionIds = new Map();
let hasError = false;

for (const packId of packs) {
  const paths = packPaths(packId);
  const errors = [];
  const warns = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warns.push(m);

  const pack = readJson(paths.packFile);
  const subjectKeys = new Set((pack.subjects ?? []).map((s) => s.key));
  const examKeys = Array.isArray(pack.exams) ? new Set(pack.exams.map((e) => e.key)) : null;

  if (!existsSync(paths.officialIndex)) {
    err(`[${packId}] official/index.json 不存在`);
    for (const m of errors) console.error('ERROR ' + m);
    console.log(`[${packId}] papers=0 questions=0 needs_review=0 ERROR=${errors.length} WARN=${warns.length}`);
    hasError = true;
    continue;
  }
  const index = readJson(paths.officialIndex);

  const expected = new Map();
  for (const [paperId, src] of manifestByPaper) {
    if (subjectKeys.has(src.subjectKey) && (!examKeys || examKeys.has(src.exam))) {
      expected.set(paperId, src);
    }
  }

  let totalQ = 0;
  let totalReview = 0;
  const seenIds = new Set();
  for (const [paperId, src] of expected) {
    if (globalPaperIds.has(paperId)) {
      err(`${paperId} 試卷 ID 與內容包 ${globalPaperIds.get(paperId)} 重複`);
    } else {
      globalPaperIds.set(paperId, packId);
    }

    const p = join(paths.officialDir, `${paperId}.json`);
    if (!existsSync(p)) { err(`${paperId} 缺 official/${paperId}.json`); continue; }
    const file = readJson(p);
    const { paper, questions, groups, essays } = file;
    if (!paper || !Array.isArray(questions) || !Array.isArray(groups) || !Array.isArray(essays)) { err(`${paperId} 檔案形狀不符 PaperFile`); continue; }
    if (paper.id !== paperId) err(`${paperId} paper.id 不符`);
    if (paper.bankId !== pack.id) err(`${paperId} bankId 未登記在 pack.json`);
    if (!subjectKeys.has(paper.subjectKey)) err(`${paperId} subjectKey 未登記`);
    for (const [k, t] of [['q', 'Q'], ['s', 'S']]) {
      if (paper.sources?.[k]?.sha256 !== src[t]?.sha256) err(`${paperId} sources.${k}.sha256 與 manifest 不符`);
    }
    if (src.M ? paper.sources?.m?.sha256 !== src.M.sha256 : paper.sources?.m !== null) err(`${paperId} sources.m 與 manifest 不符`);

    const declared = await declaredMcqCount(src.S.file);
    if (declared === null) err(`${paperId} 讀不到答案 PDF 的單選題數`);
    if (paper.mcqCount !== declared) err(`${paperId} mcqCount=${paper.mcqCount}，答案 PDF 宣告 ${declared}`);
    if (questions.length !== declared) err(`${paperId} 題數 ${questions.length}，應為 ${declared}`);

    const groupIds = new Set(groups.map((g) => g.id));
    let review = 0;
    questions.forEach((q, i) => {
      const tag = `${paperId} 第 ${q.no} 題`;
      if (q.no !== i + 1) err(`${tag} 題號不連續（位置 ${i + 1}）`);
      const wantId = `${paperId}-q${String(q.no).padStart(2, '0')}`;
      if (q.id !== wantId) err(`${tag} id 應為 ${wantId}`);
      if (seenIds.has(q.id)) err(`${tag} id 重複`);
      else if (globalQuestionIds.has(q.id)) err(`${tag} id 與內容包 ${globalQuestionIds.get(q.id)} 重複`);
      else globalQuestionIds.set(q.id, packId);
      seenIds.add(q.id);
      if (q.paperId !== paperId) err(`${tag} paperId 不符`);
      if (!Array.isArray(q.answer) || q.answer.length === 0 || q.answer.some((a) => !CHOICES.includes(a))) err(`${tag} answer 不合法`);
      if (q.groupId !== null && !groupIds.has(q.groupId)) err(`${tag} groupId 不存在`);
      if (q.parseStatus === 'needs_review') { review++; return; }
      if (q.parseStatus !== 'ok') err(`${tag} parseStatus 不合法`);
      if (typeof q.stem !== 'string' || q.stem.trim().length < 4) err(`${tag} 題幹過短`);
      if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => typeof o !== 'string' || !o.trim())) err(`${tag} 選項不是四個非空字串`);
      else if (new Set(q.options.map((o) => o.trim())).size !== 4) warn(`${tag} 有重複選項`);
      for (const s of [q.stem, ...(q.options ?? [])]) if (BAD_CHARS.test(String(s))) { err(`${tag} 含自訂字元或亂碼`); break; }
      if (/^\s*\d+\s*$/.test(q.stem) || /第\s*\d+\s*頁|頁次/.test(q.stem)) err(`${tag} 題幹混入頁碼`);
      if (HEADER_LEAK.test([q.stem, ...q.options].join(''))) err(`${tag} 混入試卷表頭或注意事項`);
    });
    if (src.M && !questions.some((q) => q.correction)) err(`${paperId} 有更正答案 PDF，但沒有任何題目帶 correction`);
    if (!src.M && questions.some((q) => q.correction)) err(`${paperId} 沒有更正答案 PDF，卻有題目帶 correction`);
    if (declared && review / declared > NEEDS_REVIEW_MAX_RATIO) err(`${paperId} needs_review ${review} 題，超過 ${NEEDS_REVIEW_MAX_RATIO * 100}%`);
    const idx = index.papers?.find((x) => x.id === paperId);
    if (!idx) err(`${paperId} 不在 index.json`);
    else if (idx.mcqCount !== questions.length || idx.needsReview !== review || idx.essayCount !== essays.length) err(`${paperId} index.json 的數字與檔案不符`);
    totalQ += questions.length;
    totalReview += review;
  }
  for (const x of index.papers ?? []) {
    if (!expected.has(x.id)) {
      err(`index.json 多了 ${x.id}`);
      if (globalPaperIds.has(x.id) && globalPaperIds.get(x.id) !== packId) {
        err(`${x.id} 試卷 ID 與內容包 ${globalPaperIds.get(x.id)} 重複`);
      } else {
        globalPaperIds.set(x.id, packId);
      }
    }
  }

  // 黃金答案：人工確認過的答案表，解析結果必須完全一致。
  for (const g of goldenFiles) {
    const p = join(paths.officialDir, `${g.paperId}.json`);
    if (!existsSync(p)) continue;
    const byNo = new Map(readJson(p).questions.map((q) => [q.no, q]));
    for (const [no, ans] of Object.entries(g.answers)) {
      const got = [...(byNo.get(Number(no))?.answer ?? [])].sort().join('');
      if (got !== [...ans].sort().join('')) err(`${g.paperId} 第 ${no} 題答案 ${got || '(無)'}，黃金答案 ${ans}`);
    }
  }

  for (const m of warns) console.error(`WARN [${packId}] ${m}`);
  for (const m of errors) console.error(`ERROR [${packId}] ${m}`);
  console.log(`[${packId}] papers=${expected.size} questions=${totalQ} needs_review=${totalReview} ERROR=${errors.length} WARN=${warns.length}`);
  if (errors.length > 0) hasError = true;
}

// 下載紀錄裡的每一份試卷都必須屬於某個內容包；沒有任何包認領就是漏了（改成逐包檢查前，這種情況會報「缺檔」）
const unclaimed = [...manifestByPaper.keys()].filter((paperId) => !globalPaperIds.has(paperId));
for (const paperId of unclaimed) console.error(`ERROR ${paperId} 在 data/raw/manifest.json 裡，但沒有任何內容包收它`);
if (unclaimed.length > 0) hasError = true;

process.exit(hasError ? 1 : 0);
