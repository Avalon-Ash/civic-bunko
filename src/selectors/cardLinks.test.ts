// 卡片↔官方題的連結（docs/plans/comic-cards.md §2.4、ADR 0022）。fixture 從測試題庫的正本取題號，不寫死。
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { StudyCard } from '../core/types';
import { createTestWorld, testPaperFiles } from '../testing/fixture';
import { cardQuestionIds, cardsForQuestion } from './cardLinks';

const ids = testPaperFiles.flatMap((f) => f.questions.map((q) => q.id));

function card(id: string, questions?: string[]): StudyCard {
  return {
    id,
    kind: 'concept',
    subjectKey: null,
    title: id,
    hook: '一句話',
    visual: null,
    faces: [{ heading: '重點', lines: ['一行'] }],
    lawRefs: [],
    essay: null,
    ...(questions ? { questions } : {}),
  };
}

function worldWith(cards: StudyCard[]) {
  const world = createTestWorld();
  world.cards = cards;
  return world;
}

test('正向：這張卡的題只留題庫裡存在的、去掉重複，照卡片寫的順序', () => {
  const [a, b] = ids;
  assert.ok(a && b);
  const world = worldWith([card('c1', [b, 'no-such-question', a, b])]);
  assert.deepEqual(cardQuestionIds(world, 'c1'), [b, a]);
});

test('卡片沒有 questions、或卡片不存在：正向是空的', () => {
  const world = worldWith([card('c1')]);
  assert.deepEqual(cardQuestionIds(world, 'c1'), []);
  assert.deepEqual(cardQuestionIds(world, 'missing'), []);
});

test('反向：這題掛在哪幾張卡上，照卡片順序', () => {
  const [a, b] = ids;
  assert.ok(a && b);
  const world = worldWith([card('c1', [a]), card('c2', [b]), card('c3', [a, b])]);
  assert.deepEqual(
    cardsForQuestion(world, a).map((c) => c.id),
    ['c1', 'c3'],
  );
  assert.deepEqual(cardsForQuestion(world, 'no-such-question'), []);
});

test('正向與反向互為反函數', () => {
  const world = worldWith([card('c1', ids.slice(0, 3)), card('c2', ids.slice(2, 5)), card('c3')]);
  for (const c of world.cards) {
    for (const q of cardQuestionIds(world, c.id)) {
      assert.ok(cardsForQuestion(world, q).some((x) => x.id === c.id), `${q} 反查不到 ${c.id}`);
    }
  }
  for (const q of ids) {
    for (const c of cardsForQuestion(world, q)) {
      assert.ok(cardQuestionIds(world, c.id).includes(q), `${c.id} 正查不到 ${q}`);
    }
  }
});
