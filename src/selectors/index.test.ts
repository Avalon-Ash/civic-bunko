import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import {
  activeBank,
  askCounts,
  availableCount,
  bankTotals,
  bilingualOn,
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
import { loadZh } from '../systems/zhLoader';
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

  it('returns optionOrder in currentQuestion and preserves shuffleOptions in getSettings', () => {
    const world = createTestWorld();
    const now = () => new Date('2026-11-15T10:00:00');

    assert.equal(getSettings(world).shuffleOptions, undefined);
    dispatch(world, { type: 'setShuffleOptions', on: true });
    assert.equal(getSettings(world).shuffleOptions, true);

    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now, rng: makeSeededRng(5) },
    );

    const view = currentQuestion(world);
    assert.ok(view !== null);
    assert.equal(view.optionOrder.length, 4);
    assert.deepEqual(new Set(view.optionOrder), new Set(['A', 'B', 'C', 'D']));
    assert.deepEqual(view.optionOrder, world.round!.optionOrder![view.question.id]);

    // When shuffleOptions is false, optionOrder defaults to ['A', 'B', 'C', 'D']
    dispatch(world, { type: 'setShuffleOptions', on: false });
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now, rng: makeSeededRng(5) },
    );
    const defaultView = currentQuestion(world);
    assert.deepEqual(defaultView?.optionOrder, ['A', 'B', 'C', 'D']);
  });

  it('defaults bilingualOn to true, reflects setBilingual, and returns zh/groupZh in currentQuestion and readView', () => {
    const world = createTestWorld();
    const now = () => new Date('2026-11-16T10:00:00');

    assert.equal(bilingualOn(world), true);
    assert.equal(getSettings(world).bilingual, undefined);

    dispatch(world, { type: 'setBilingual', on: false });
    assert.equal(bilingualOn(world), false);
    assert.equal(getSettings(world).bilingual, false);

    dispatch(world, { type: 'setBilingual', on: true });
    assert.equal(bilingualOn(world), true);

    loadZh(world, [
      {
        paperId: testPaperA.id,
        groups: [
          {
            id: testGroup.id,
            segments: [{ en: 'Test group.', zh: '測試題組翻譯。' }],
            vocab: [{ en: 'test', zh: '測試' }],
          },
        ],
        items: [
          {
            id: 'q-a1',
            stem: '第一題中譯',
            options: { A: '選項A', B: '選項B', C: '選項C', D: '選項D' },
            vocab: [{ en: 'item', zh: '項目' }],
          },
        ],
      },
    ]);

    // Quiz mode: check present and absent zh/groupZh
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3, ask: 'all' }) },
      { now, rng: makeSeededRng(1) },
    );

    const seenQuiz = new Map<string, ReturnType<typeof currentQuestion>>();
    while (world.round) {
      const view = currentQuestion(world)!;
      seenQuiz.set(view.question.id, view);
      dispatch(world, { type: 'answer', pick: view.question.answer[0]! }, { now });
      dispatch(world, { type: 'next' }, { now });
    }

    assert.equal(seenQuiz.get('q-a1')?.zh?.stem, '第一題中譯');
    assert.equal(seenQuiz.get('q-a1')?.groupZh?.id, testGroup.id);
    assert.equal(seenQuiz.get('q-a2')?.zh, null);
    assert.equal(seenQuiz.get('q-a2')?.groupZh?.id, testGroup.id);
    assert.equal(seenQuiz.get('q-a3')?.zh, null);
    assert.equal(seenQuiz.get('q-a3')?.groupZh, null);

    // Read mode: check present and absent zh/groupZh
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ study: 'read', subjectKeys: ['subj-a'], count: 3, ask: 'all', passes: 1 }) },
      { now, rng: makeSeededRng(2) },
    );

    const seenRead = new Map<string, ReturnType<typeof readView>>();
    while (world.round) {
      const view = readView(world)!;
      seenRead.set(view.question.id, view);
      dispatch(world, { type: 'next' }, { now });
    }

    assert.equal(seenRead.get('q-a1')?.zh?.stem, '第一題中譯');
    assert.equal(seenRead.get('q-a1')?.groupZh?.id, testGroup.id);
    assert.equal(seenRead.get('q-a3')?.zh, null);
    assert.equal(seenRead.get('q-a3')?.groupZh, null);
  });
});
