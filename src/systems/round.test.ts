import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import type { RoundState } from '../core/types';
import { createTestWorld, makeConfig, makeSeededRng } from '../testing/fixture';

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
});
