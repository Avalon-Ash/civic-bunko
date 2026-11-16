import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { EXAM_SECONDS_PER_QUESTION, EXAM_WARN_SECONDS } from '../core/constants/exam';
import type { Paper, PaperFile } from '../core/types';
import { createWorld } from '../core/world';
import { loadBank } from '../systems/bankLoader';
import { loadZh } from '../systems/zhLoader';
import {
  createTestWorld,
  makeConfig,
  makeSeededRng,
  testBank,
  testGroup,
  testPaperA,
  testPaperB,
  testQuestionsA,
  testQuestionsB,
} from '../testing/fixture';
import { examBest, examClock, examHistory, examPapers, examQuestionDetail, examResult, examSheet } from './exam';

describe('exam selectors', () => {
  it('lists examPapers ordered by subject then year desc, computes minutes, and excludes empty papers', () => {
    const world = createWorld();
    const olderPaperA: Paper = {
      ...testPaperA,
      id: '113-local4-subj-a',
      year: 113,
      exam: 'local4',
    };
    const emptyPaperB: Paper = {
      ...testPaperB,
      id: '114-general-subj-b',
      year: 114,
      exam: 'general',
    };
    const files: PaperFile[] = [
      // Insert subj-b before subj-a and 113 before 115 to verify sorting
      { paper: testPaperB, groups: [], questions: testQuestionsB, essays: [] },
      {
        paper: emptyPaperB,
        groups: [],
        questions: [
          {
            id: 'q-empty-bad',
            paperId: emptyPaperB.id,
            no: 1,
            stem: '待確認題目',
            options: ['A', 'B', 'C', 'D'],
            answer: ['A'],
            correction: null,
            groupId: null,
            parseStatus: 'needs_review',
          },
        ],
        essays: [],
      },
      {
        paper: olderPaperA,
        groups: [],
        questions: [
          {
            id: 'q-old-1',
            paperId: olderPaperA.id,
            no: 1,
            stem: '舊試題 1',
            options: ['A', 'B', 'C', 'D'],
            answer: ['A'],
            correction: null,
            groupId: null,
            parseStatus: 'ok',
          },
        ],
        essays: [],
      },
      { paper: testPaperA, groups: [], questions: testQuestionsA, essays: [] },
    ];

    loadBank(world, [testBank], files);
    const papers = examPapers(world, testBank.id);

    assert.equal(papers.length, 3);
    assert.deepEqual(
      papers.map((p) => p.paperId),
      [testPaperA.id, olderPaperA.id, testPaperB.id],
    );
    // testPaperA has 3 ok questions (q-a4-bad excluded)
    assert.equal(papers[0]?.count, 3);
    assert.equal(
      papers[0]?.minutes,
      Math.ceil((3 * EXAM_SECONDS_PER_QUESTION) / 60),
    );
    assert.equal(papers[2]?.count, 2);
  });

  it('computes examClock including warn threshold, wall-clock expiration, and null outside exam', () => {
    const world = createTestWorld();
    const startNow = () => new Date('2026-11-16T10:00:00.000Z');

    assert.equal(examClock(world, startNow()), null);

    // Non-exam round returns null
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now: startNow, rng: makeSeededRng(1) },
    );
    assert.equal(examClock(world, startNow()), null);

    // Exam round with 10 minutes (600 seconds)
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 10 } }) },
      { now: startNow, rng: makeSeededRng(1) },
    );

    const atStart = examClock(world, new Date('2026-11-16T10:00:00.000Z'));
    assert.deepEqual(atStart, {
      remainingSeconds: 600,
      totalSeconds: 600,
      warn: false,
      expired: false,
    });

    // At exactly EXAM_WARN_SECONDS remaining (600 - 300 = 300s elapsed -> 10:05:00)
    const warnMs = startNow().getTime() + (600 - EXAM_WARN_SECONDS) * 1000;
    const atWarn = examClock(world, new Date(warnMs));
    assert.deepEqual(atWarn, {
      remainingSeconds: EXAM_WARN_SECONDS,
      totalSeconds: 600,
      warn: true,
      expired: false,
    });

    // Past expiration (10:15:00 -> clamped to 0)
    const afterExpire = examClock(world, new Date('2026-11-16T10:15:00.000Z'));
    assert.deepEqual(afterExpire, {
      remainingSeconds: 0,
      totalSeconds: 600,
      warn: true,
      expired: true,
    });
  });

  it('computes examResult with full paper count as denominator and builds wrong list', () => {
    const world = createTestWorld();
    const now = () => new Date('2026-11-16T10:00:00.000Z');

    assert.equal(examResult(world), null);

    // Non-exam finished round -> examResult stays null
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 1 }) },
      { now, rng: makeSeededRng(1) },
    );
    const nonExamQ = world.questions.get(world.round!.queue[0]!)!;
    dispatch(world, { type: 'answer', pick: nonExamQ.answer[0]! }, { now });
    dispatch(world, { type: 'next' }, { now });
    assert.equal(examResult(world), null);

    // Exam round on testPaperA (3 ok questions): answer 1 right (q-a1), 1 wrong (q-a2), leave 1 unanswered (q-a3)
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 5 } }) },
      { now, rng: makeSeededRng(1) },
    );
    dispatch(world, { type: 'examPick', pick: 'A' }); // q-a1 right
    dispatch(world, { type: 'examGoto', index: 1 });
    dispatch(world, { type: 'examPick', pick: 'D' }); // q-a2 wrong (answer is ['B','C'])
    dispatch(world, { type: 'quitRound' }, { now });

    const res = examResult(world);
    assert.ok(res !== null);
    assert.equal(res.paperId, testPaperA.id);
    assert.equal(res.total, 3);
    assert.equal(res.answered, 2);
    assert.equal(res.correct, 1);
    assert.equal(res.score, Math.round((1 / 3) * 100));
    assert.deepEqual(res.wrong, [
      { id: 'q-a2', no: 2, pick: 'D', answer: ['B', 'C'] },
    ]);

    const detail = examQuestionDetail(world, 'q-a1');
    assert.equal(detail?.question.id, 'q-a1');
    assert.equal(detail?.enrich?.mnemonic, '測試口訣 1');
    assert.equal(examQuestionDetail(world, 'missing-q'), null);
  });

  it('computes examSheet for active exam rounds and null otherwise', () => {
    const world = createTestWorld();
    const now = () => new Date('2026-11-16T10:00:00.000Z');

    assert.equal(examSheet(world), null);

    // Non-exam round returns null
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now, rng: makeSeededRng(1) },
    );
    assert.equal(examSheet(world), null);

    // Exam round on testPaperA (q-a1 no=1, q-a2 no=2, q-a3 no=3)
    dispatch(
      world,
      { type: 'startRound', config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 5 } }) },
      { now, rng: makeSeededRng(1) },
    );
    dispatch(world, { type: 'examPick', pick: 'A' });
    dispatch(world, { type: 'examGoto', index: 2 });

    assert.deepEqual(examSheet(world), {
      index: 2,
      total: 3,
      answered: 1,
      items: [
        { index: 0, no: 1, picked: true, current: false },
        { index: 1, no: 2, picked: false, current: false },
        { index: 2, no: 3, picked: false, current: true },
      ],
    });
  });

  it('computes examHistory (newest-first, filtered, skips missing papers) and examBest', () => {
    const world = createTestWorld();
    assert.deepEqual(examHistory(world), []);
    assert.equal(examBest(world, testPaperA.id), null);

    world.bus.emit({
      type: 'examFinished',
      record: {
        paperId: testPaperA.id,
        at: '2026-11-16T08:00:00.000Z',
        total: 3,
        answered: 3,
        correct: 1,
        score: 33,
      },
    });
    world.bus.emit({
      type: 'examFinished',
      record: {
        paperId: 'deleted-paper-id',
        at: '2026-11-16T08:30:00.000Z',
        total: 10,
        answered: 10,
        correct: 10,
        score: 100,
      },
    });
    world.bus.emit({
      type: 'examFinished',
      record: {
        paperId: testPaperB.id,
        at: '2026-11-16T09:00:00.000Z',
        total: 2,
        answered: 2,
        correct: 2,
        score: 100,
      },
    });
    world.bus.emit({
      type: 'examFinished',
      record: {
        paperId: testPaperA.id,
        at: '2026-11-16T10:00:00.000Z',
        total: 3,
        answered: 3,
        correct: 3,
        score: 100,
      },
    });
    world.bus.emit({
      type: 'examFinished',
      record: {
        paperId: testPaperA.id,
        at: '2026-11-16T11:00:00.000Z',
        total: 3,
        answered: 3,
        correct: 2,
        score: 67,
      },
    });

    const all = examHistory(world);
    assert.equal(all.length, 4);
    assert.deepEqual(
      all.map((item) => ({ paperId: item.paperId, score: item.score, subjectName: item.subjectName, year: item.year, exam: item.exam })),
      [
        { paperId: testPaperA.id, score: 67, subjectName: '測試科目甲', year: 115, exam: 'general' },
        { paperId: testPaperA.id, score: 100, subjectName: '測試科目甲', year: 115, exam: 'general' },
        { paperId: testPaperB.id, score: 100, subjectName: '測試科目乙', year: 115, exam: 'general' },
        { paperId: testPaperA.id, score: 33, subjectName: '測試科目甲', year: 115, exam: 'general' },
      ],
    );

    const onlyA = examHistory(world, testPaperA.id);
    assert.deepEqual(onlyA.map((item) => item.score), [67, 100, 33]);
    assert.equal(examBest(world, testPaperA.id), 100);
    assert.equal(examBest(world, testPaperB.id), 100);
    assert.equal(examBest(world, 'unattempted-paper'), null);
  });

  it('includes zh and groupZh (or null when missing) in examQuestionDetail', () => {
    const world = createTestWorld();
    loadZh(world, [
      {
        paperId: testPaperA.id,
        groups: [
          {
            id: testGroup.id,
            segments: [{ en: 'Passage.', zh: '短文。' }],
            vocab: [],
          },
        ],
        items: [
          {
            id: 'q-a1',
            stem: '第一題中譯',
            options: { A: '甲', B: '乙', C: '丙', D: '丁' },
            vocab: [],
          },
        ],
      },
    ]);

    const withZh = examQuestionDetail(world, 'q-a1');
    assert.equal(withZh?.zh?.stem, '第一題中譯');
    assert.equal(withZh?.groupZh?.id, testGroup.id);

    const withoutZh = examQuestionDetail(world, 'q-a3');
    assert.equal(withoutZh?.zh, null);
    assert.equal(withoutZh?.groupZh, null);
  });
});
