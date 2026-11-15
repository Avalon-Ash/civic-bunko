import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import {
  availableCount,
  currentQuestion,
  daysLeft,
  dueCount,
  roundSummary,
  subjectStats,
  wrongCount,
} from './index';
import {
  createTestWorld,
  makeConfig,
  makeSeededRng,
  testBank,
  testGroup,
} from '../testing/fixture';

describe('selectors', () => {
  it('returns currentQuestion view and roundSummary across round lifecycle', () => {
    const world = createTestWorld();
    const now = () => new Date('2026-11-15T10:00:00');

    assert.equal(currentQuestion(world), null);
    assert.equal(roundSummary(world), null);

    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3 }) },
      { now, rng: makeSeededRng(1) },
    );

    const beforePick = currentQuestion(world);
    assert.ok(beforePick !== null);
    assert.equal(beforePick.index, 0);
    assert.equal(beforePick.total, 3);
    assert.equal(beforePick.pick, null);
    assert.equal(beforePick.isCorrect, null);
    assert.equal(beforePick.combo, 0);

    // Find q-a1 to check group and enrich wiring
    while (currentQuestion(world)?.question.id !== 'q-a1') {
      const q = currentQuestion(world)!.question;
      dispatch(world, { type: 'answer', pick: q.answer[0]! }, { now });
      dispatch(world, { type: 'next' }, { now });
    }

    const qA1Before = currentQuestion(world)!;
    assert.deepEqual(qA1Before.group, testGroup);
    assert.equal(qA1Before.enrich?.mnemonic, '測試口訣 1');

    dispatch(world, { type: 'answer', pick: 'B' }, { now });
    const qA1After = currentQuestion(world)!;
    assert.equal(qA1After.pick, 'B');
    assert.equal(qA1After.isCorrect, false);
    assert.equal(qA1After.combo, 0);

    // Finish remaining questions
    dispatch(world, { type: 'next' }, { now });
    while (world.round) {
      const q = currentQuestion(world)!.question;
      dispatch(world, { type: 'answer', pick: q.answer[0]! }, { now });
      dispatch(world, { type: 'next' }, { now });
    }

    assert.equal(currentQuestion(world), null);
    const summary = roundSummary(world);
    assert.ok(summary !== null);
    assert.equal(summary.total, 3);
    assert.equal(summary.correct, 2);
    assert.deepEqual(summary.wrongIds, ['q-a1']);
  });

  it('computes subjectStats, dueCount, wrongCount, and availableCount', () => {
    const world = createTestWorld();
    const now = new Date('2026-11-15T12:00:00');

    // q-a1: wrong and due
    world.progress.set('q-a1', {
      seen: 2,
      correct: 1,
      streak: 0,
      lastPick: 'D',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: '2026-11-15',
    });
    // q-a2: correct and graduated
    world.progress.set('q-a2', {
      seen: 1,
      correct: 1,
      streak: 1,
      lastPick: 'B',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: null,
    });
    // q-b1: wrong, not due yet
    world.progress.set('q-b1', {
      seen: 1,
      correct: 0,
      streak: 0,
      lastPick: 'A',
      lastAt: '2026-11-15T10:00:00.000Z',
      due: '2026-11-16',
    });

    const stats = subjectStats(world, testBank.id);
    assert.equal(stats.length, 2);
    // subj-a has 3 ok questions (q-a4-bad excluded)
    assert.deepEqual(stats[0], {
      key: 'subj-a',
      name: '測試科目甲',
      short: '甲科',
      total: 3,
      seen: 2,
      correctRate: 2 / 3,
    });
    assert.deepEqual(stats[1], {
      key: 'subj-b',
      name: '測試科目乙',
      short: '乙科',
      total: 2,
      seen: 1,
      correctRate: 0,
    });

    assert.equal(dueCount(world, testBank.id, now), 1);
    assert.equal(wrongCount(world, testBank.id), 2);
    assert.equal(availableCount(world, makeConfig({ mode: 'mixed' }), now), 5);
    assert.equal(availableCount(world, makeConfig({ mode: 'new' }), now), 2);
    assert.equal(availableCount(world, makeConfig({ mode: 'wrong' }), now), 2);
    assert.equal(availableCount(world, makeConfig({ mode: 'due' }), now), 1);
    assert.equal(
      availableCount(world, makeConfig({ subjectKeys: ['subj-b'], mode: 'wrong' }), now),
      1,
    );
  });

  it('computes daysLeft using local date and clamps past dates to 0', () => {
    assert.equal(daysLeft(testBank, new Date('2026-11-15T23:59:00')), 20);
    assert.equal(daysLeft(testBank, new Date('2026-12-05T00:01:00')), 0);
    assert.equal(daysLeft(testBank, new Date('2026-12-05T23:59:00')), 0);
    assert.equal(daysLeft(testBank, new Date('2026-12-06T08:00:00')), 0);
  });
});
