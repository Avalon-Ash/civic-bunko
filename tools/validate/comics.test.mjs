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
