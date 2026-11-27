// 四格漫畫資料的驗證（npm test 用 node --import tsx 跑，直接讀引擎的詞彙表，沒有第二份清單）。
// docs/plans/comic-cards.md §7、ADR 0020。
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { comicProblems, comicPanelText } from '../../src/systems/comic.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const packsDir = join(root, 'data', 'packs');

function allCards() {
  const out = [];
  for (const pack of readdirSync(packsDir)) {
    const dir = join(packsDir, pack, 'cards');
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const f of files) {
      for (const card of JSON.parse(readFileSync(join(dir, f), 'utf8')).cards) out.push({ pack, file: f, card });
    }
  }
  return out;
}

const withComic = allCards().filter(({ card }) => card.comic);

test('至少有一張卡有漫畫（樣張）', () => {
  assert.ok(withComic.length > 0);
});

test('每張卡的漫畫：版型、構圖、角色、道具都在詞彙表裡，字都指得到原文，舉牌是原文的一部分', () => {
  for (const { pack, file, card } of withComic) {
    assert.deepEqual(comicProblems(card), [], `${pack}/${file} ${card.id}`);
  }
});

test('每一格都畫得出一句話', () => {
  for (const { card } of withComic) {
    for (const panel of card.comic.panels) {
      const view = comicPanelText(card, panel);
      assert.ok(view && view.text.length > 0, `${card.id} 有一格沒有字`);
    }
  }
});

test('壞資料會被抓到：指不到的指標、不是子字串的舉牌、不在清單的道具', () => {
  const { card } = withComic[0];
  const bad = structuredClone(card);
  bad.comic.panels[0].text = { from: 'line', face: 99, line: 0 };
  assert.ok(comicProblems(bad).some((p) => p.includes('指不到')));
  const bad2 = structuredClone(card);
  bad2.comic.panels[0].sign = '卡片沒有的字';
  assert.ok(comicProblems(bad2).some((p) => p.includes('舉牌')));
  const bad3 = structuredClone(card);
  bad3.comic.panels[0].props = ['no-such-prop'];
  assert.ok(comicProblems(bad3).some((p) => p.includes('道具')));
});

test('卡片的 questions：每個題號都在該包的官方題庫裡、不重複', () => {
  for (const pack of readdirSync(packsDir)) {
    const officialDir = join(packsDir, pack, 'official');
    let files = [];
    try {
      files = readdirSync(officialDir).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    const known = new Set(files.flatMap((f) => (JSON.parse(readFileSync(join(officialDir, f), 'utf8')).questions ?? []).map((q) => q.id)));
    for (const { card } of allCards().filter((c) => c.pack === pack && c.card.questions)) {
      assert.equal(new Set(card.questions).size, card.questions.length, `${card.id} 的 questions 有重複`);
      for (const id of card.questions) assert.ok(known.has(id), `${card.id} 掛了不存在的題 ${id}`);
    }
  }
});

test('格子的標籤（誰、哪一項）：指不到原文會被抓到；排排站每一格都要有標籤', () => {
  const { card } = withComic[0];
  const bad = structuredClone(card);
  bad.comic.panels[0].label = { from: 'heading', face: 99 };
  assert.ok(comicProblems(bad).some((p) => p.includes('標籤')));
  const lineup = structuredClone(card);
  lineup.comic = { layout: 'lineup', panels: lineup.comic.panels.slice(0, 2).map(({ label, ...p }) => p) };
  assert.ok(comicProblems(lineup).some((p) => p.includes('標籤')));
  lineup.comic.panels = lineup.comic.panels.map((p) => ({ ...p, label: { from: 'heading', face: 0 } }));
  assert.deepEqual(comicProblems(lineup), []);
  assert.equal(comicPanelText(lineup, lineup.comic.panels[0]).label, card.faces[0].heading);
});
