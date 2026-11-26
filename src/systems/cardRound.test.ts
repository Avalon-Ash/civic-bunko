// 「刷這張卡的題」回合（docs/plans/comic-cards.md §2.5、ADR 0022）：不在 RoundConfig 記卡片，存下來的回合和一般回合同形。
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dispatch } from '../core/commands';
import type { RoundConfig, StudyCard } from '../core/types';
import { createTestWorld, makeConfig, makeSeededRng, testPaperFiles } from '../testing/fixture';

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

test('開出只有這張卡的題的作答回合', () => {
  const world = createTestWorld();
  const linked = ids.slice(0, 3);
  world.cards = [card('c1', [...linked, 'no-such-question'])];
  dispatch(world, { type: 'startCardRound', cardId: 'c1' }, { rng: makeSeededRng(7) });
  assert.ok(world.round, '應該開出回合');
  assert.deepEqual([...world.round.queue].sort(), [...linked].sort());
  assert.equal(world.round.config.study, 'quiz');
  assert.equal(world.round.config.count, linked.length);
});

test('config 只用一般回合既有的欄位（不記卡片）', () => {
  const world = createTestWorld();
  world.cards = [card('c1', ids.slice(0, 2))];
  dispatch(world, { type: 'startCardRound', cardId: 'c1' }, { rng: makeSeededRng(7) });
  assert.ok(world.round);
  const known = new Set(Object.keys(makeConfig()) as Array<keyof RoundConfig>);
  for (const key of Object.keys(world.round.config)) {
    assert.ok(known.has(key as keyof RoundConfig), `RoundConfig 多了 ${key}`);
  }
  assert.equal(world.round.config.exam ?? null, null);
  assert.equal(world.round.config.topicIds, undefined);
});

test('卡片沒有題目、或卡片不存在：不開回合', () => {
  const world = createTestWorld();
  world.cards = [card('c1')];
  dispatch(world, { type: 'startCardRound', cardId: 'c1' });
  assert.equal(world.round, null);
  dispatch(world, { type: 'startCardRound', cardId: 'missing' });
  assert.equal(world.round, null);
});

test('刷這張卡的題不會改掉刷題頁記住的設定（lastRound）', () => {
  const world = createTestWorld();
  world.cards = [card('c1', ids.slice(0, 3))];
  const before = makeConfig({ ask: 'positive', count: 20 });
  dispatch(world, { type: 'startRound', config: before }, { rng: makeSeededRng(3) });
  const remembered = structuredClone(world.settings.lastRound);
  assert.ok(remembered);
  dispatch(world, { type: 'quitRound' });
  dispatch(world, { type: 'startCardRound', cardId: 'c1' }, { rng: makeSeededRng(7) });
  assert.ok(world.round);
  assert.deepEqual(world.settings.lastRound, remembered);
});
