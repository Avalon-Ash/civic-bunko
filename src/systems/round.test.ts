import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { getVersion } from '../core/store';
import type { Choice, RoundState } from '../core/types';
import { createTestWorld, makeConfig, makeSeededRng, testPaperA } from '../testing/fixture';

describe('round system', () => {
  const fixedNow = () => new Date('2026-11-15T14:00:00');

  it('prevents answering the same question twice and blocks next before answering', () => {
    const world = createTestWorld();
    const answeredEvents: Array<{ id: string; pick: string; correct: boolean }> = [];
    world.bus.on('answered', (e) => {
      answeredEvents.push({ id: e.id, pick: e.pick, correct: e.correct });
    });

    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now: fixedNow, rng: makeSeededRng(10) },
    );

    assert.ok(world.round !== null);
    const firstId = world.round.queue[0]!;
    const firstQ = world.questions.get(firstId)!;
    const rightChoice = firstQ.answer[0]!;
    const wrongChoice = rightChoice === 'A' ? 'D' : 'A';

    // next before answer is a no-op
    dispatch(world, { type: 'next' }, { now: fixedNow });
    assert.equal(world.round.index, 0);
    assert.equal(world.round.pick, null);

    // first answer records result
    dispatch(world, { type: 'answer', pick: wrongChoice }, { now: fixedNow });
    assert.equal(world.round.pick, wrongChoice);
    assert.equal(world.round.results.length, 1);
    assert.equal(answeredEvents.length, 1);

    // second answer on the same question is ignored
    dispatch(world, { type: 'answer', pick: rightChoice }, { now: fixedNow });
    assert.equal(world.round.pick, wrongChoice);
    assert.equal(world.round.results.length, 1);
    assert.equal(answeredEvents.length, 1);
  });

  it('tracks combo, accepts multiple answers on correction questions, and finishes round', () => {
    const world = createTestWorld();
    let finishedCount = 0;
    world.bus.on('roundFinished', () => {
      finishedCount += 1;
    });

    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(1) },
    );

    const queue = world.round!.queue;
    assert.equal(queue.length, 3);

    // Answer every question in queue: test q-a2 with both 'B' and 'C' across runs, here pick 'C' if q-a2
    for (let i = 0; i < queue.length; i += 1) {
      const qId = queue[i]!;
      if (qId === 'q-a2') {
        // correction question has answer ['B', 'C'] — pick the second choice 'C'
        dispatch(world, { type: 'answer', pick: 'C' }, { now: fixedNow });
      } else {
        const q = world.questions.get(qId)!;
        dispatch(world, { type: 'answer', pick: q.answer[0]! }, { now: fixedNow });
      }
      assert.equal(world.round!.combo, i + 1);
      dispatch(world, { type: 'next' }, { now: fixedNow });
    }

    assert.equal(world.round, null);
    assert.ok(world.lastRound !== null);
    assert.equal(world.lastRound.finished, true);
    assert.equal(world.lastRound.results.length, 3);
    assert.ok(world.lastRound.results.every((r) => r.correct));
    assert.equal(finishedCount, 1);

    // Also verify 'B' works on q-a2
    const world2 = createTestWorld();
    dispatch(
      world2,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    while (world2.round) {
      const qId = world2.round.queue[world2.round.index]!;
      const pick = qId === 'q-a2' ? 'B' : world2.questions.get(qId)!.answer[0]!;
      dispatch(world2, { type: 'answer', pick }, { now: fixedNow });
      dispatch(world2, { type: 'next' }, { now: fixedNow });
    }
    const q2Res = world2.lastRound!.results.find((r) => r.id === 'q-a2');
    assert.equal(q2Res?.correct, true);
  });

  it('resets combo on wrong answer and handles quitRound (0 answered vs partial)', () => {
    const world = createTestWorld();
    const getRound = () => world.round;
    const getLastRound = () => world.lastRound;
    let finishedEvents = 0;
    world.bus.on('roundFinished', () => {
      finishedEvents += 1;
    });

    // Quit with 0 answered: discard without event or overwriting lastRound
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(5) },
    );
    dispatch(world, { type: 'quitRound' }, { now: fixedNow });
    assert.equal(getRound(), null);
    assert.equal(getLastRound(), null);
    assert.equal(finishedEvents, 0);

    // Start again, answer 2 of 3 (1 right, 1 wrong), then quitRound
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(5) },
    );

    const activeRound = getRound();
    assert.ok(activeRound !== null);
    const firstId = activeRound.queue[0]!;
    const firstAns = world.questions.get(firstId)!.answer[0]!;
    dispatch(world, { type: 'answer', pick: firstAns }, { now: fixedNow });
    assert.equal(activeRound.combo, 1);

    dispatch(world, { type: 'next' }, { now: fixedNow });
    const secondId = activeRound.queue[1]!;
    const secondAns = world.questions.get(secondId)!.answer[0]!;
    const wrongPick = secondAns === 'D' ? 'A' : 'D';
    dispatch(world, { type: 'answer', pick: wrongPick }, { now: fixedNow });
    assert.equal(activeRound.combo, 0);

    dispatch(world, { type: 'quitRound' }, { now: fixedNow });
    assert.equal(getRound(), null);
    assert.equal(finishedEvents, 1);
    const savedRound = getLastRound();
    assert.ok(savedRound !== null);
    assert.equal(savedRound.results.length, 2);
    assert.deepEqual(savedRound.queue, [firstId, secondId]);

    // retryWrong starts a new round with only the wrong question and keeps config with updated count
    dispatch(world, { type: 'retryWrong' }, { now: fixedNow });
    const retriedRound = getRound();
    assert.ok(retriedRound !== null);
    assert.deepEqual(retriedRound.queue, [secondId]);
    assert.equal(retriedRound.config.count, 1);
    assert.deepEqual(retriedRound.config.subjectKeys, ['subj-a']);
  });

  it('runs read mode across multiple passes with reshuffling, ignores answer, and supports quizSameSet', () => {
    const world = createTestWorld();
    const viewedIds: string[] = [];
    const finishedPayloads: Array<{ resultsLength: number }> = [];
    world.bus.on('viewed', (e) => viewedIds.push(e.id));
    world.bus.on('roundFinished', (e) => finishedPayloads.push({ resultsLength: e.results.length }));

    dispatch(
      world,
      {
        type: 'startRound',
        config: makeConfig({ study: 'read', subjectKeys: ['subj-a'], count: 3, passes: 2 }),
      },
      { now: fixedNow, rng: makeSeededRng(10) },
    );

    assert.ok(world.round !== null);
    const pass1Queue = [...world.round.queue];
    assert.equal(pass1Queue.length, 3);
    assert.equal(world.round.pass, 1);

    // answer is ignored in read mode
    dispatch(world, { type: 'answer', pick: 'A' }, { now: fixedNow });
    assert.equal(world.round.pick, null);
    assert.equal(world.round.results.length, 0);

    // Advance through pass 1
    dispatch(world, { type: 'next' }, { now: fixedNow, rng: makeSeededRng(20) });
    assert.equal(world.round.index, 1);
    dispatch(world, { type: 'next' }, { now: fixedNow, rng: makeSeededRng(20) });
    assert.equal(world.round.index, 2);
    dispatch(world, { type: 'next' }, { now: fixedNow, rng: makeSeededRng(20) });

    // Now on pass 2, index 0, reshuffled with injected rng
    assert.ok(world.round !== null);
    assert.equal(world.round.pass, 2);
    assert.equal(world.round.index, 0);
    const pass2Queue = [...world.round.queue];
    assert.deepEqual(new Set(pass2Queue), new Set(pass1Queue));
    assert.notDeepEqual(pass2Queue, pass1Queue);

    // Finish pass 2
    for (let i = 0; i < 3; i += 1) {
      dispatch(world, { type: 'next' }, { now: fixedNow, rng: makeSeededRng(20) });
    }

    assert.equal(world.round, null);
    assert.ok(world.lastRound !== null);
    assert.equal(world.lastRound.finished, true);
    assert.equal(finishedPayloads.length, 1);
    assert.equal(finishedPayloads[0]?.resultsLength, 0);
    assert.deepEqual(viewedIds, [...pass1Queue, ...pass2Queue]);

    // quizSameSet launches a quiz round using the deduplicated, shuffled queue from lastRound
    const getRound = (): RoundState | null => world.round;
    dispatch(world, { type: 'quizSameSet' }, { now: fixedNow, rng: makeSeededRng(30) });
    const quizRound = getRound();
    assert.ok(quizRound !== null);
    assert.equal(quizRound.config.study, 'quiz');
    assert.deepEqual(quizRound.config.subjectKeys, ['subj-a']);
    assert.equal(quizRound.queue.length, 3);
    assert.deepEqual(new Set(quizRound.queue), new Set(pass1Queue));
  });

  it('discards read mode immediately on quitRound without emitting roundFinished', () => {
    const world = createTestWorld();
    let finished = 0;
    world.bus.on('roundFinished', () => {
      finished += 1;
    });

    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ study: 'read', subjectKeys: ['subj-a'], count: 3, passes: 2 }) },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    dispatch(world, { type: 'next' }, { now: fixedNow, rng: makeSeededRng(1) });
    dispatch(world, { type: 'quitRound' }, { now: fixedNow });

    assert.equal(world.round, null);
    assert.equal(world.lastRound, null);
    assert.equal(finished, 0);
  });

  it('resumes savedRound, discards savedRound, and clears savedRound on startRound', () => {
    const world = createTestWorld();
    let restoredCount = 0;
    world.bus.on('roundRestored', () => {
      restoredCount += 1;
    });

    world.savedRound = {
      config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }),
      queue: ['q-a1', 'q-a2'],
      index: 1,
      pick: null,
      results: [{ id: 'q-a1', pick: 'A', correct: true }],
      combo: 1,
      finished: false,
      pass: 1,
    };

    dispatch(world, { type: 'resumeRound' });
    assert.equal(restoredCount, 1);
    assert.equal(world.savedRound, null);
    assert.ok(world.round !== null);
    assert.equal(world.round.index, 1);

    // discardSavedRound clears savedRound without touching round
    world.round = null;
    world.savedRound = {
      config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }),
      queue: ['q-a1', 'q-a2'],
      index: 0,
      pick: null,
      results: [],
      combo: 0,
      finished: false,
      pass: 1,
    };
    dispatch(world, { type: 'discardSavedRound' });
    assert.equal(world.savedRound, null);

    // startRound also clears savedRound
    world.savedRound = {
      config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }),
      queue: ['q-a1', 'q-a2'],
      index: 0,
      pick: null,
      results: [],
      combo: 0,
      finished: false,
      pass: 1,
    };
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now: fixedNow, rng: makeSeededRng(7) },
    );
    assert.equal(world.savedRound, null);
    assert.ok(world.round !== null);
  });

  it('starts exam round ordered by question number without shuffling, sets startedAt, ignores count/mode/ask/study, and skips missing/empty papers', () => {
    const world = createTestWorld();
    const getRound = (): RoundState | null => world.round;
    // Reverse insertion order of testPaperA questions in world.questions to prove sorting by no
    const reversedA = [...world.questions.entries()].filter(([, q]) => q.paperId === testPaperA.id).reverse();
    for (const [id] of reversedA) {
      world.questions.delete(id);
    }
    for (const [id, q] of reversedA) {
      world.questions.set(id, q);
    }

    // Missing paper does not start a round
    dispatch(
      world,
      {
        type: 'startRound',
        config: makeConfig({ exam: { paperId: 'non-existent', minutes: 10 } }),
      },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    assert.equal(getRound(), null);

    // Enable shuffleOptions and pass read/negative/count=1: exam must ignore them and force quiz, full ok list by no, no optionOrder
    dispatch(world, { type: 'setShuffleOptions', on: true });
    dispatch(
      world,
      {
        type: 'startRound',
        config: makeConfig({
          count: 1,
          mode: 'wrong',
          ask: 'negative',
          study: 'read',
          exam: { paperId: testPaperA.id, minutes: 5 },
        }),
      },
      { now: fixedNow, rng: makeSeededRng(1) },
    );

    const examRound = getRound();
    assert.ok(examRound !== null);
    assert.deepEqual(examRound.queue, ['q-a1', 'q-a2', 'q-a3']);
    assert.equal(examRound.config.study, 'quiz');
    assert.equal(examRound.startedAt, fixedNow().toISOString());
    assert.equal(examRound.optionOrder, undefined);
  });

  it('preserves full exam queue on quitRound when answered, discards on 0 answered, and drops exam on retryWrong/quizSameSet', () => {
    const world = createTestWorld();
    const getRound = (): RoundState | null => world.round;
    const getLastRound = (): RoundState | null => world.lastRound;

    // Quit with 0 answered -> discarded
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 5 } }) },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    dispatch(world, { type: 'quitRound' }, { now: fixedNow });
    assert.equal(getRound(), null);
    assert.equal(getLastRound(), null);

    // Answer 2 of 3 via examPick/examGoto (q-a1 wrong, q-a2 right), then quitRound -> preserves full 3-question queue in lastRound
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 5 } }) },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    dispatch(world, { type: 'examPick', pick: 'D' }, { now: fixedNow }); // q-a1 answer is ['A']
    dispatch(world, { type: 'examGoto', index: 1 });
    dispatch(world, { type: 'examPick', pick: 'B' }, { now: fixedNow }); // q-a2 answer is ['B','C']
    dispatch(world, { type: 'quitRound' }, { now: fixedNow });

    assert.equal(getRound(), null);
    const finishedExam = getLastRound();
    assert.ok(finishedExam !== null);
    assert.deepEqual(finishedExam.queue, ['q-a1', 'q-a2', 'q-a3']);
    assert.equal(finishedExam.results.length, 2);

    // retryWrong produces normal round without exam
    dispatch(world, { type: 'setShuffleOptions', on: true });
    dispatch(world, { type: 'retryWrong' }, { now: fixedNow, rng: makeSeededRng(9) });
    const retried = getRound();
    assert.ok(retried !== null);
    assert.equal(retried.config.exam, undefined);
    assert.deepEqual(retried.queue, ['q-a1']);
    assert.ok(retried.optionOrder?.['q-a1'] !== undefined);

    // quizSameSet on an exam lastRound also drops exam
    dispatch(world, { type: 'quizSameSet' }, { now: fixedNow, rng: makeSeededRng(11) });
    const sameSet = getRound();
    assert.ok(sameSet !== null);
    assert.equal(sameSet.config.exam, undefined);
    assert.equal(sameSet.queue.length, 3);
    assert.ok(sameSet.optionOrder !== undefined);
  });

  it('supports examPick overwrite, examGoto clamping, ignores answer/next, and scores in queue order on quitRound', () => {
    const world = createTestWorld();
    const getRound = (): RoundState | null => world.round;
    const startTime = () => new Date('2026-11-16T09:00:00.000Z');
    const submitTime = () => new Date('2026-11-16T09:12:34.000Z');
    const answeredEvents: Array<{ id: string; pick: Choice; correct: boolean; at: string }> = [];
    const examFinishedEvents: Array<{
      paperId: string;
      at: string;
      total: number;
      answered: number;
      correct: number;
      score: number;
    }> = [];
    world.bus.on('answered', (e) => {
      answeredEvents.push({ id: e.id, pick: e.pick, correct: e.correct, at: e.at });
    });
    world.bus.on('examFinished', (e) => {
      examFinishedEvents.push({ ...e.record });
    });

    // Outside exam round, examPick and examGoto are no-ops
    dispatch(world, { type: 'examPick', pick: 'A' });
    dispatch(world, { type: 'examGoto', index: 1 });
    assert.equal(getRound(), null);

    // Start exam round on testPaperA (queue: ['q-a1', 'q-a2', 'q-a3'])
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 5 } }) },
      { now: startTime, rng: makeSeededRng(1) },
    );
    assert.deepEqual(getRound()?.examPicks, {});

    // answer and next do nothing in exam mode
    const verBeforeNoop = getVersion(world);
    dispatch(world, { type: 'answer', pick: 'A' }, { now: startTime });
    dispatch(world, { type: 'next' }, { now: startTime });
    assert.equal(getVersion(world), verBeforeNoop);
    assert.equal(getRound()?.index, 0);
    assert.equal(getRound()?.pick, null);
    assert.equal(getRound()?.results.length, 0);
    assert.equal(answeredEvents.length, 0);

    // examPick records pick without emitting answered or advancing, and bumps store
    const verBeforePick = getVersion(world);
    dispatch(world, { type: 'examPick', pick: 'D' });
    assert.ok(getVersion(world) > verBeforePick);
    assert.equal(getRound()?.index, 0);
    assert.equal(getRound()?.pick, 'D');
    assert.equal(getRound()?.examPicks?.['q-a1'], 'D');
    assert.equal(answeredEvents.length, 0);
    assert.equal(getRound()?.results.length, 0);

    // Overwrite pick on same question
    dispatch(world, { type: 'examPick', pick: 'A' }); // q-a1 right answer
    assert.equal(getRound()?.pick, 'A');
    assert.equal(getRound()?.examPicks?.['q-a1'], 'A');

    // examGoto clamps high and jumps to last question (index 2: q-a3), bumping store
    const verBeforeGoto = getVersion(world);
    dispatch(world, { type: 'examGoto', index: 99 });
    assert.ok(getVersion(world) > verBeforeGoto);
    assert.equal(getRound()?.index, 2);
    assert.equal(getRound()?.pick, null);

    // Pick on q-a3 (wrong: 'A', right is 'C')
    dispatch(world, { type: 'examPick', pick: 'A' });
    assert.equal(getRound()?.examPicks?.['q-a3'], 'A');

    // examGoto clamps low back to 0 and restores pick 'A'
    dispatch(world, { type: 'examGoto', index: -5 });
    assert.equal(getRound()?.index, 0);
    assert.equal(getRound()?.pick, 'A');

    // Submit via quitRound: emits answered in queue order (q-a1, then q-a3) with submitTime
    dispatch(world, { type: 'quitRound' }, { now: submitTime });
    assert.equal(getRound(), null);
    assert.deepEqual(answeredEvents, [
      { id: 'q-a1', pick: 'A', correct: true, at: '2026-11-16T09:12:34.000Z' },
      { id: 'q-a3', pick: 'A', correct: false, at: '2026-11-16T09:12:34.000Z' },
    ]);
    assert.deepEqual(examFinishedEvents, [
      {
        paperId: testPaperA.id,
        at: '2026-11-16T09:12:34.000Z',
        total: 3,
        answered: 2,
        correct: 1,
        score: Math.round((1 / 3) * 100),
      },
    ]);

    // Quit with empty examPicks does NOT emit examFinished
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 5 } }) },
      { now: startTime, rng: makeSeededRng(1) },
    );
    dispatch(world, { type: 'quitRound' }, { now: submitTime });
    assert.equal(examFinishedEvents.length, 1);
  });

  it('generates optionOrder permutations only for quiz rounds when shuffleOptions is enabled', () => {
    const isFourChoicePerm = (order: Choice[] | undefined): boolean => {
      if (!order || order.length !== 4) return false;
      return new Set(order).size === 4 && ['A', 'B', 'C', 'D'].every((c) => order.includes(c as Choice));
    };

    const world = createTestWorld();

    // Off by default -> no optionOrder
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(2) },
    );
    assert.equal(world.round?.optionOrder, undefined);

    // Turn on shuffleOptions
    dispatch(world, { type: 'setShuffleOptions', on: true });

    // Read mode -> still no optionOrder
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ study: 'read', subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(2) },
    );
    assert.equal(world.round?.optionOrder, undefined);

    // Quiz mode -> optionOrder generated for every question in queue
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ study: 'quiz', subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(3) },
    );
    const orders = world.round?.optionOrder;
    assert.ok(orders !== undefined);
    for (const id of world.round!.queue) {
      assert.equal(isFourChoicePerm(orders[id]), true);
    }
  });
});
