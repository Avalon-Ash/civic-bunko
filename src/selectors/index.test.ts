import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import {
  activeBank,
  askCounts,
  availableCount,
  bankTotals,
  currentQuestion,
  currentRoundConfig,
  dailyMissions,
  daysLeft,
  dueCount,
  getSettings,
  positiveCoverage,
  questionPaper,
  readView,
  roundSummary,
  savedRoundInfo,
  subjectStats,
  wrongCount,
} from './index';
import { weekStamps } from './daily';
import {
  createTestWorld,
  makeConfig,
  makeSeededRng,
  otherBank,
  testBank,
  testGroup,
  testPaperA,
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
      views: 0,
      streak: 0,
      lastPick: 'D',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: '2026-11-15',
    });
    // q-a2: correct and graduated
    world.progress.set('q-a2', {
      seen: 1,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'B',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: null,
    });
    // q-b1: wrong, not due yet
    world.progress.set('q-b1', {
      seen: 1,
      correct: 0,
      views: 0,
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

  it('provides activeBank, bankTotals, getSettings, currentRoundConfig, and questionPaper', () => {
    const world = createTestWorld();
    assert.equal(activeBank(world)?.id, testBank.id);

    const totalsBefore = bankTotals(world, testBank.id);
    assert.deepEqual(totalsBefore, { total: 5, seen: 0 });

    dispatch(world, { type: 'setTheme', theme: 'dark' });
    assert.equal(getSettings(world).theme, 'dark');
    assert.equal(currentRoundConfig(world), null);

    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ bankId: otherBank.id, count: 1, fast: true }) },
      { now: () => new Date('2026-11-15T10:00:00'), rng: makeSeededRng(2) },
    );
    assert.equal(activeBank(world)?.id, otherBank.id);
    assert.equal(currentRoundConfig(world)?.fast, true);

    dispatch(world, { type: 'answer', pick: 'B' }, { now: () => new Date('2026-11-15T10:01:00') });
    assert.deepEqual(bankTotals(world, otherBank.id), { total: 1, seen: 1 });
    assert.equal(questionPaper(world, testPaperA.id)?.subjectName, '測試科目甲');
    assert.equal(questionPaper(world, 'missing-paper'), null);
  });

  it('builds dailyMissions and weekStamps from world state', () => {
    const world = createTestWorld();
    const now = new Date('2026-11-18T12:00:00'); // Wednesday

    const missionsInitial = dailyMissions(world, testBank.id, now);
    assert.equal(missionsInitial.length, 3);
    assert.equal(missionsInitial[0]?.config.subjectKeys[0], 'subj-a');
    assert.equal(missionsInitial[1]?.config.subjectKeys[0], 'subj-b');
    assert.equal(missionsInitial[2]?.config.mode, 'mixed');

    world.progress.set('q-a1', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'B',
      lastAt: '2026-11-18T09:00:00',
      due: '2026-11-18',
    });
    world.dayLog.set('2026-11-18', 15);

    const missionsWithDue = dailyMissions(world, testBank.id, now);
    assert.equal(missionsWithDue[2]?.config.mode, 'due');
    assert.equal(missionsWithDue[2]?.available, 1);
    assert.ok(missionsWithDue.every((m) => m.config.study === 'quiz' && m.config.ask === 'positive'));

    const week = weekStamps(world, now);
    assert.equal(week.length, 7);
    assert.equal(week[0]?.label, '一');
    assert.equal(week[2]?.isToday, true);
    assert.equal(week[2]?.stamped, true);
    assert.equal(week[2]?.count, 15);
    assert.equal(week[3]?.stamped, false);
  });

  it('computes askCounts, positiveCoverage, and readView', () => {
    const world = createTestWorld();
    const qA3 = world.questions.get('q-a3')!;
    world.questions.set('q-a3', { ...qA3, stem: '下列敘述何者錯誤？' });
    const qB2 = world.questions.get('q-b2')!;
    world.questions.set('q-b2', { ...qB2, stem: '下列何者非屬行政處分？' });

    assert.deepEqual(askCounts(world, { bankId: testBank.id, subjectKeys: [] }), {
      positive: 3,
      negative: 2,
    });
    assert.deepEqual(askCounts(world, { bankId: testBank.id, subjectKeys: ['subj-a'] }), {
      positive: 2,
      negative: 1,
    });

    assert.equal(positiveCoverage(world, testBank.id, []), 0);

    // Mark one positive question viewed (q-a1) and one answered (q-b1), plus one negative viewed (q-a3)
    world.bus.emit({ type: 'viewed', id: 'q-a1', at: '2026-11-15T10:00:00.000Z' });
    world.bus.emit({
      type: 'answered',
      id: 'q-b1',
      pick: 'D',
      correct: true,
      at: '2026-11-15T10:01:00.000Z',
    });
    world.bus.emit({ type: 'viewed', id: 'q-a3', at: '2026-11-15T10:02:00.000Z' });

    // Positive questions in testBank: q-a1, q-a2, q-b1 -> 2/3 covered
    assert.equal(positiveCoverage(world, testBank.id, []), 2 / 3);
    // Positive questions in subj-a: q-a1, q-a2 -> 1/2 covered
    assert.equal(positiveCoverage(world, testBank.id, ['subj-a']), 0.5);

    assert.equal(readView(world), null);
    dispatch(
      world,
      {
        type: 'startRound',
        config: makeConfig({
          study: 'read',
          ask: 'all',
          subjectKeys: ['subj-a'],
          count: 3,
          passes: 2,
        }),
      },
      { now: () => new Date('2026-11-15T10:05:00'), rng: makeSeededRng(1) },
    );

    // currentQuestion is null in read mode, while readView returns full read metadata
    assert.equal(currentQuestion(world), null);
    const rv = readView(world);
    assert.ok(rv !== null);
    assert.equal(rv.pass, 1);
    assert.equal(rv.totalPasses, 2);
    assert.equal(rv.index, 0);
    assert.equal(rv.total, 3);
    if (rv.question.id === 'q-a3') {
      assert.equal(rv.askType, 'negative');
      assert.equal(rv.views, 1);
    }
  });

  it('returns savedRoundInfo for quiz and read saved rounds', () => {
    const world = createTestWorld();
    assert.equal(savedRoundInfo(world), null);

    world.savedRound = {
      config: makeConfig({ study: 'quiz', count: 20 }),
      queue: Array.from({ length: 20 }, (_, i) => `q-${i}`),
      index: 6,
      pick: null,
      results: [],
      combo: 0,
      finished: false,
      pass: 1,
    };
    assert.deepEqual(savedRoundInfo(world), {
      study: 'quiz',
      pass: 1,
      totalPasses: 3,
      current: 7,
      total: 20,
    });

    world.savedRound = {
      config: makeConfig({ study: 'read', passes: 3, count: 20 }),
      queue: Array.from({ length: 20 }, (_, i) => `q-${i}`),
      index: 6,
      pick: null,
      results: [],
      combo: 0,
      finished: false,
      pass: 2,
    };
    assert.deepEqual(savedRoundInfo(world), {
      study: 'read',
      pass: 2,
      totalPasses: 3,
      current: 7,
      total: 20,
    });
  });
});
