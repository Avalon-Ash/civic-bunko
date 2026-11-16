import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WEAK_MIN_ANSWERED, WEAK_ROUND_COUNT, WEAK_TOP_N } from '../core/constants/weak';
import type { Enrich, OfficialQuestion, Paper, PaperFile, SourceFile, TopicInfo } from '../core/types';
import { createWorld, type World } from '../core/world';
import { loadBank, loadTopicList } from '../systems/bankLoader';
import { otherBank, testBank } from '../testing/fixture';
import { topicStats, weakRoundConfig, weakSummary, weakTopics } from './weak';

const dummySource: SourceFile = {
  url: 'https://example.invalid/test.pdf',
  file: 'test.pdf',
  sha256: '0000000000000000',
};

function makeEnrichItem(id: string, topic: string[]): Enrich {
  return {
    id,
    topic,
    mnemonic: '口訣',
    trap: '陷阱',
    plain: null,
    marks: [],
    options: {
      A: { why: '解析 A', lawRef: null },
      B: { why: '解析 B', lawRef: null },
      C: { why: '解析 C', lawRef: null },
      D: { why: '解析 D', lawRef: null },
    },
    visual: null,
    lawChanged: null,
    confidence: 'high',
    reviewed: false,
  };
}

function makeRichWorld(questionCount = 24): World {
  const world = createWorld();
  const paperA: Paper = {
    id: '115-general-subj-a',
    bankId: testBank.id,
    year: 115,
    exam: 'general',
    subjectKey: 'subj-a',
    subjectName: '測試科目甲',
    examCode: 'T01',
    mcqCount: questionCount,
    sources: { q: dummySource, s: dummySource, m: null },
  };
  const paperX: Paper = {
    id: '115-local4-subj-x',
    bankId: otherBank.id,
    year: 115,
    exam: 'local4',
    subjectKey: 'subj-x',
    subjectName: '測試科目丙',
    examCode: 'T99',
    mcqCount: 1,
    sources: { q: dummySource, s: dummySource, m: null },
  };

  const questionsA: OfficialQuestion[] = Array.from({ length: questionCount }, (_, idx) => ({
    id: `q-${idx + 1}`,
    paperId: paperA.id,
    no: idx + 1,
    stem: `測試題 ${idx + 1}`,
    options: ['A', 'B', 'C', 'D'],
    answer: ['A'],
    correction: null,
    groupId: null,
    parseStatus: 'ok',
  }));
  questionsA.push({
    id: 'q-bad',
    paperId: paperA.id,
    no: questionCount + 1,
    stem: '待確認題目',
    options: ['A', 'B', 'C', 'D'],
    answer: ['A'],
    correction: null,
    groupId: null,
    parseStatus: 'needs_review',
  });

  const questionsX: OfficialQuestion[] = [
    {
      id: 'q-other-1',
      paperId: paperX.id,
      no: 1,
      stem: '其他題庫題目',
      options: ['A', 'B', 'C', 'D'],
      answer: ['A'],
      correction: null,
      groupId: null,
      parseStatus: 'ok',
    },
  ];

  const files: PaperFile[] = [
    { paper: paperA, groups: [], questions: questionsA, essays: [] },
    { paper: paperX, groups: [], questions: questionsX, essays: [] },
  ];

  loadBank(world, [testBank, otherBank], files);
  return world;
}

describe('weak selectors & loadTopicList', () => {
  it('loadTopicList copies topics into world.topics', () => {
    const world = createWorld();
    const input: TopicInfo[] = [
      { id: 't-1', subjectKey: 'subj-a', name: '考點一' },
    ];
    loadTopicList(world, input);
    input.push({ id: 't-2', subjectKey: 'subj-b', name: '考點二' });
    input[0]!.name = '被修改';

    assert.equal(world.topics.length, 1);
    assert.equal(world.topics[0]?.name, '考點一');
  });

  it('computes topicStats accurately across multi-topic questions, skips unknown topics and needs_review', () => {
    const world = makeRichWorld(5);
    loadTopicList(world, [
      { id: 't-a', subjectKey: 'subj-a', name: '考點甲' },
      { id: 't-b', subjectKey: 'subj-b', name: '考點乙' },
    ]);

    // q-1 has two known topics; answered 3 times, correct 1 time, currently wrong (streak 0)
    world.enrich.set('q-1', makeEnrichItem('q-1', ['t-a', 't-b']));
    world.progress.set('q-1', {
      seen: 3,
      correct: 1,
      views: 0,
      streak: 0,
      lastPick: 'B',
      lastAt: '2026-11-16T10:00:00.000Z',
      due: '2026-11-17',
    });

    // q-2 has t-a and an unknown topic; answered 1 time, correct 1 time (streak 1)
    world.enrich.set('q-2', makeEnrichItem('q-2', ['t-a', 't-unknown']));
    world.progress.set('q-2', {
      seen: 1,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'A',
      lastAt: '2026-11-16T10:05:00.000Z',
      due: null,
    });

    // q-3 has t-b; only viewed in read mode (seen === 0), should NOT count as answered
    world.enrich.set('q-3', makeEnrichItem('q-3', ['t-b']));
    world.progress.set('q-3', {
      seen: 0,
      correct: 0,
      views: 2,
      streak: 0,
      lastPick: null,
      lastAt: '2026-11-16T10:10:00.000Z',
      due: null,
    });

    // q-4 has t-b; never seen
    world.enrich.set('q-4', makeEnrichItem('q-4', ['t-b']));

    // q-bad (needs_review) and q-other-1 (otherBank) must be excluded
    world.enrich.set('q-bad', makeEnrichItem('q-bad', ['t-a']));
    world.enrich.set('q-other-1', makeEnrichItem('q-other-1', ['t-a']));

    const stats = topicStats(world, testBank.id);
    assert.deepEqual(stats, [
      {
        id: 't-a',
        name: '考點甲',
        subjectKey: 'subj-a',
        subjectShort: '甲科',
        total: 2,
        answered: 2,
        attempts: 4,
        wrongAttempts: 2,
        wrongNow: 1,
        wrongRate: 0.5,
      },
      {
        id: 't-b',
        name: '考點乙',
        subjectKey: 'subj-b',
        subjectShort: '乙科',
        total: 3,
        answered: 1,
        attempts: 3,
        wrongAttempts: 2,
        wrongNow: 1,
        wrongRate: 2 / 3,
      },
    ]);

    // Unanswered topic gives wrongRate = 0
    const worldEmpty = makeRichWorld(1);
    loadTopicList(worldEmpty, [{ id: 't-a', subjectKey: 'subj-a', name: '考點甲' }]);
    worldEmpty.enrich.set('q-1', makeEnrichItem('q-1', ['t-a']));
    assert.equal(topicStats(worldEmpty, testBank.id)[0]?.wrongRate, 0);
  });

  it('filters weakTopics by WEAK_MIN_ANSWERED and wrongAttempts > 0, sorts by wrongRate -> wrongNow -> id, and caps at WEAK_TOP_N', () => {
    assert.equal(WEAK_MIN_ANSWERED, 3);
    assert.equal(WEAK_TOP_N, 5);

    const world = makeRichWorld(24);
    const topics: TopicInfo[] = [
      { id: 't-below-min', subjectKey: 'subj-a', name: '未達門檻' },
      { id: 't-no-wrong', subjectKey: 'subj-a', name: '全對考點' },
      { id: 't-tie-b', subjectKey: 'subj-a', name: '同分B' },
      { id: 't-tie-a', subjectKey: 'subj-a', name: '同分A' },
      { id: 't-more-now', subjectKey: 'subj-a', name: '上次錯較多' },
      { id: 't-top', subjectKey: 'subj-b', name: '最高錯率' },
      { id: 't-mid', subjectKey: 'subj-a', name: '中等錯率' },
      { id: 't-low', subjectKey: 'subj-a', name: '較低錯率' },
    ];
    loadTopicList(world, topics);

    const setProg = (qId: string, topicId: string, seen: number, correct: number, streak: number) => {
      world.enrich.set(qId, makeEnrichItem(qId, [topicId]));
      world.progress.set(qId, {
        seen,
        correct,
        views: 0,
        streak,
        lastPick: 'A',
        lastAt: '2026-11-16T10:00:00.000Z',
        due: null,
      });
    };

    // t-below-min: 2 answered (< 3), 100% wrong -> excluded
    setProg('q-1', 't-below-min', 1, 0, 0);
    setProg('q-2', 't-below-min', 1, 0, 0);

    // t-no-wrong: 3 answered, 0 wrong -> excluded
    setProg('q-3', 't-no-wrong', 1, 1, 1);
    setProg('q-4', 't-no-wrong', 1, 1, 1);
    setProg('q-5', 't-no-wrong', 1, 1, 1);

    // t-top: 3 answered, 3 attempts, 3 wrong (wrongRate 1.0, wrongNow 3)
    setProg('q-6', 't-top', 1, 0, 0);
    setProg('q-7', 't-top', 1, 0, 0);
    setProg('q-8', 't-top', 1, 0, 0);

    // t-more-now: 3 answered, 4 attempts, 2 wrong (wrongRate 0.5, wrongNow 2)
    setProg('q-9', 't-more-now', 1, 0, 0);
    setProg('q-10', 't-more-now', 1, 0, 0);
    setProg('q-11', 't-more-now', 2, 2, 2);

    // t-tie-b: 3 answered, 4 attempts, 2 wrong (wrongRate 0.5, wrongNow 1)
    setProg('q-12', 't-tie-b', 2, 0, 0);
    setProg('q-13', 't-tie-b', 1, 1, 1);
    setProg('q-14', 't-tie-b', 1, 1, 1);

    // t-tie-a: 3 answered, 4 attempts, 2 wrong (wrongRate 0.5, wrongNow 1) -> beats t-tie-b by id
    setProg('q-15', 't-tie-a', 2, 0, 0);
    setProg('q-16', 't-tie-a', 1, 1, 1);
    setProg('q-17', 't-tie-a', 1, 1, 1);

    // t-mid: 3 answered, 5 attempts, 2 wrong (wrongRate 0.4, wrongNow 1)
    setProg('q-18', 't-mid', 2, 0, 0);
    setProg('q-19', 't-mid', 2, 2, 2);
    setProg('q-20', 't-mid', 1, 1, 1);

    // t-low: 3 answered, 6 attempts, 1 wrong (wrongRate 1/6) -> dropped by WEAK_TOP_N = 5
    setProg('q-21', 't-low', 2, 1, 0);
    setProg('q-22', 't-low', 2, 2, 2);
    setProg('q-23', 't-low', 2, 2, 2);

    const weak = weakTopics(world, testBank.id);
    assert.deepEqual(
      weak.map((t) => t.id),
      ['t-top', 't-more-now', 't-tie-a', 't-tie-b', 't-mid'],
    );
  });

  it('builds weakRoundConfig and weakSummary, returning null when no weak topics exist', () => {
    const world = makeRichWorld(5);
    loadTopicList(world, [{ id: 't-a', subjectKey: 'subj-a', name: '考點甲' }]);
    for (let i = 1; i <= 4; i += 1) {
      world.enrich.set(`q-${i}`, makeEnrichItem(`q-${i}`, ['t-a']));
    }

    // Before reaching threshold: weakRoundConfig() returns null, weakSummary ready = false
    assert.equal(weakRoundConfig(world, testBank.id), null);
    assert.deepEqual(weakSummary(world, testBank.id), {
      ready: false,
      answeredTotal: 0,
      topicCount: 0,
    });

    // Empty topicIds also returns null
    assert.equal(weakRoundConfig(world, testBank.id, []), null);

    // Explicit single topic override works
    world.settings.lastRound = {
      bankId: testBank.id,
      subjectKeys: ['subj-a'],
      count: 20,
      mode: 'new',
      fast: true,
      study: 'read',
      ask: 'positive',
      passes: 3,
    };
    assert.deepEqual(weakRoundConfig(world, testBank.id, ['t-a']), {
      bankId: testBank.id,
      subjectKeys: [],
      count: WEAK_ROUND_COUNT,
      mode: 'mixed',
      fast: true,
      study: 'quiz',
      ask: 'all',
      passes: 1,
      topicIds: ['t-a'],
    });

    // Answer 3 questions with 1 wrong -> weak topic ready
    for (let i = 1; i <= 3; i += 1) {
      world.progress.set(`q-${i}`, {
        seen: 1,
        correct: i === 1 ? 0 : 1,
        views: 0,
        streak: i === 1 ? 0 : 1,
        lastPick: 'A',
        lastAt: '2026-11-16T10:00:00.000Z',
        due: null,
      });
    }

    assert.deepEqual(weakSummary(world, testBank.id), {
      ready: true,
      answeredTotal: 3,
      topicCount: 1,
    });
    assert.deepEqual(weakRoundConfig(world, testBank.id), {
      bankId: testBank.id,
      subjectKeys: [],
      count: WEAK_ROUND_COUNT,
      mode: 'mixed',
      fast: true,
      study: 'quiz',
      ask: 'all',
      passes: 1,
      topicIds: ['t-a'],
    });
  });
});
