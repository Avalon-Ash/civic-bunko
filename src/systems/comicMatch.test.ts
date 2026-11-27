// 連連看（docs/plans/level-mode.md §2、ADR 0023）：由漫畫資料機械產生，判對錯比說明的字串。
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { COMIC_SCENES } from '../core/constants/comic';
import type { ComicPanel, ComicSceneId, StudyCard } from '../core/types';
import { makeSeededRng } from '../testing/fixture';
import { comicPanelText } from './comic';
import { comicMatchSet, isComicMatch } from './comicMatch';

const scene = Object.keys(COMIC_SCENES)[0] as ComicSceneId;

function panel(face: number, line: number): ComicPanel {
  return { scene, actors: [], props: [], text: { from: 'line', face, line } };
}

function card(panels: ComicPanel[], lines = ['甲', '乙', '丙', '丁', '甲']): StudyCard {
  return {
    id: 'c1',
    kind: 'concept',
    subjectKey: null,
    title: 't',
    hook: 'h',
    visual: null,
    faces: [{ heading: '面', lines }],
    lawRefs: [],
    essay: null,
    comic: { layout: 'story', panels },
  };
}

const four = card([panel(0, 0), panel(0, 1), panel(0, 2), panel(0, 3)]);

test('左邊照漫畫的順序列出每一格；右邊是每一句說明各一次', () => {
  const set = comicMatchSet(four, makeSeededRng(1));
  assert.ok(set);
  assert.deepEqual(set.left, [0, 1, 2, 3]);
  assert.deepEqual([...set.right].sort(), ['丁', '丙', '乙', '甲']);
});

test('同一個亂數種子結果相同；右邊不會剛好和左邊同順序', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const a = comicMatchSet(four, makeSeededRng(seed));
    const b = comicMatchSet(four, makeSeededRng(seed));
    assert.deepEqual(a, b);
    const inOrder = a!.left.map((i) => comicPanelText(four, four.comic!.panels[i]!)!.text);
    assert.notDeepEqual(a!.right, inOrder, `seed ${seed} 右邊沒有打亂`);
  }
});

test('判對錯比字串：自己的說明對、別格的錯；兩格字相同時互通', () => {
  assert.equal(isComicMatch(four, 1, '乙'), true);
  assert.equal(isComicMatch(four, 1, '甲'), false);
  const dup = card([panel(0, 0), panel(0, 1), panel(0, 4)]);
  const set = comicMatchSet(dup, makeSeededRng(3));
  assert.deepEqual([...set!.right].sort(), ['乙', '甲'], '相同的字只列一次');
  assert.equal(isComicMatch(dup, 0, '甲'), true);
  assert.equal(isComicMatch(dup, 2, '甲'), true);
});

test('指不到原文的格子不列；不同的說明不到兩句就不出題', () => {
  const broken = card([panel(0, 0), panel(0, 1), panel(9, 0)]);
  assert.deepEqual(comicMatchSet(broken, makeSeededRng(1))!.left, [0, 1]);
  assert.equal(isComicMatch(broken, 2, '甲'), false);
  assert.equal(comicMatchSet(card([panel(0, 0), panel(0, 4)]), makeSeededRng(1)), null);
  assert.equal(comicMatchSet({ ...four, comic: undefined }, makeSeededRng(1)), null);
});
