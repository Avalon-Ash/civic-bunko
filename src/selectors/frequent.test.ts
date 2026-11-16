import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FREQ_ROUND_COUNT, FREQ_TOP_PER_SUBJECT } from '../core/constants/frequent';
import type { Enrich, OfficialQuestion, Paper, PaperFile, SourceFile, TopicInfo } from '../core/types';
import { createWorld, type World } from '../core/world';
import { loadBank, loadTopicList } from '../systems/bankLoader';
import { buildQueue } from '../systems/selection';
import { otherBank, testBank } from '../testing/fixture';
import { frequentRoundConfig, frequentTopics } from './frequent';

const dummySource: SourceFile = {
  url: 'https://example.invalid/test.pdf',
  file: 'test.pdf',
  sha256: '0000000000000000',
};

function enrichOf(id: string, topic: string[]): Enrich {
  const opt = { why: '解析', lawRef: null };
  return {
    id,
    topic,
    mnemonic: '口訣',
    trap: '陷阱',
    plain: null,
    marks: [],
    options: { A: opt, B: opt, C: opt, D: opt },
    visual: null,
    lawChanged: null,
    confidence: 'high',
    reviewed: false,
  };
}

function paperOf(id: string, subjectKey: string, bankId = testBank.id): Paper {
  return {
    id,
    bankId,
    year: 115,
    exam: 'general',
    subjectKey,
    subjectName: subjectKey,
    examCode: 'T01',
    mcqCount: 0,
    sources: { q: dummySource, s: dummySource, m: null },
  };
}

function questionOf(id: string, paperId: string, no: number): OfficialQuestion {
  return {
    id,
    paperId,
    no,
    stem: `測試題 ${id}`,
    options: ['A', 'B', 'C', 'D'],
    answer: ['A'],
    correction: null,
    groupId: null,
    parseStatus: 'ok',
  };
}

const TOPICS: TopicInfo[] = [
  { id: 'a/1', subjectKey: 'subj-a', name: '甲一' },
  { id: 'a/2', subjectKey: 'subj-a', name: '甲二' },
  { id: 'a/3', subjectKey: 'subj-a', name: '甲三' },
  { id: 'a/4', subjectKey: 'subj-a', name: '甲四' },
  { id: 'a/5', subjectKey: 'subj-a', name: '甲五（沒有題目）' },
  { id: 'b/1', subjectKey: 'subj-b', name: '乙一' },
  { id: 'x/1', subjectKey: 'subj-x', name: '丙一' },
];

/** 甲科各考點題數：a/1=1、a/2=4、a/3=2、a/4=2；乙科 b/1=3；另一個題庫 x/1=5。 */
function makeWorld(): World {
  const world = createWorld();
  const pa = paperOf('115-general-subj-a', 'subj-a');
  const pb = paperOf('115-general-subj-b', 'subj-b');
  const px = paperOf('115-local4-subj-x', 'subj-x', otherBank.id);
  const plan: Array<[Paper, string, number]> = [
    [pa, 'a/1', 1],
    [pa, 'a/2', 4],
    [pa, 'a/3', 2],
    [pa, 'a/4', 2],
    [pb, 'b/1', 3],
    [px, 'x/1', 5],
  ];
  const byPaper = new Map<string, OfficialQuestion[]>();
  const enrich: Enrich[] = [];
  for (const [paper, topicId, n] of plan) {
    const list = byPaper.get(paper.id) ?? [];
    for (let i = 0; i < n; i += 1) {
      const id = `${topicId}-q${i + 1}`;
      list.push(questionOf(id, paper.id, list.length + 1));
      enrich.push(enrichOf(id, [topicId]));
    }
    byPaper.set(paper.id, list);
  }
  const files: PaperFile[] = [pa, pb, px].map((paper) => ({
    paper,
    groups: [],
    questions: byPaper.get(paper.id) ?? [],
    essays: [],
  }));
  loadBank(world, [testBank, otherBank], files);
  loadTopicList(world, TOPICS);
  for (const item of enrich) {
    world.enrich.set(item.id, item);
  }
  return world;
}

describe('frequent selectors', () => {
  it('takes the top topics per subject by question count, in bank subject order, stable on ties', () => {
    const world = makeWorld();
    const list = frequentTopics(world, testBank.id);
    assert.equal(FREQ_TOP_PER_SUBJECT, 3);
    assert.deepEqual(
      list.map((t) => [t.id, t.total]),
      [
        ['a/2', 4],
        ['a/3', 2],
        ['a/4', 2],
        ['b/1', 3],
      ],
    );
  });

  it('ignores other banks and unknown banks', () => {
    const world = makeWorld();
    assert.deepEqual(
      frequentTopics(world, otherBank.id).map((t) => t.id),
      ['x/1'],
    );
    assert.deepEqual(frequentTopics(world, 'no-such-bank'), []);
    assert.equal(frequentRoundConfig(world, 'no-such-bank'), null);
  });

  it('builds a round config limited to frequent topics', () => {
    const world = makeWorld();
    const config = frequentRoundConfig(world, testBank.id);
    assert.ok(config);
    assert.equal(config.count, FREQ_ROUND_COUNT);
    assert.equal(config.mode, 'mixed');
    assert.deepEqual(config.topicIds, ['a/2', 'a/3', 'a/4', 'b/1']);

    const queue = buildQueue(world, config, new Date('2026-11-16T00:00:00Z'), () => 0.5);
    assert.equal(queue.length, FREQ_ROUND_COUNT);
    assert.ok(queue.every((id) => !id.startsWith('a/1-') && !id.startsWith('x/1-')));
    assert.equal(new Set(queue).size, queue.length);
  });

  it('accepts an explicit single topic', () => {
    const world = makeWorld();
    const config = frequentRoundConfig(world, testBank.id, ['b/1']);
    assert.ok(config);
    const queue = buildQueue(world, config, new Date('2026-11-16T00:00:00Z'), () => 0.5);
    assert.deepEqual([...queue].sort(), ['b/1-q1', 'b/1-q2', 'b/1-q3']);
    assert.equal(frequentRoundConfig(world, testBank.id, []), null);
  });
});
