import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue } from './selection';
import { createTestWorld, makeConfig, makeSeededRng } from '../testing/fixture';

describe('selection.buildQueue', () => {
  const now = new Date('2026-11-15T12:00:00');

  it('excludes needs_review and other banks, and returns actual count when insufficient', () => {
    const world = createTestWorld();
    const queue = buildQueue(world, makeConfig({ count: 50, mode: 'new' }), now, makeSeededRng(1));

    // test-bank has 5 ok questions (q-a1, q-a2, q-a3, q-b1, q-b2); q-a4-bad is needs_review; q-x1 is other-bank
    assert.equal(queue.length, 5);
    assert.equal(new Set(queue).size, 5);
    assert.ok(!queue.includes('q-a4-bad'));
    assert.ok(!queue.includes('q-x1'));
  });

  it('filters by subjectKeys when non-empty and includes all when empty', () => {
    const world = createTestWorld();
    const onlyA = buildQueue(
      world,
      makeConfig({ subjectKeys: ['subj-a'], count: 10, mode: 'new' }),
      now,
      makeSeededRng(2),
    );
    assert.equal(onlyA.length, 3);
    assert.deepEqual(new Set(onlyA), new Set(['q-a1', 'q-a2', 'q-a3']));

    const allSubjects = buildQueue(
      world,
      makeConfig({ subjectKeys: [], count: 10, mode: 'new' }),
      now,
      makeSeededRng(2),
    );
    assert.equal(allSubjects.length, 5);
  });

  it('selects new, wrong, and due modes accurately', () => {
    const world = createTestWorld();

    // q-a1: due today & wrong (streak 0, due 2026-11-15)
    world.progress.set('q-a1', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'B',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: '2026-11-15',
    });
    // q-a2: wrong but not due yet (due 2026-11-18)
    world.progress.set('q-a2', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'A',
      lastAt: '2026-11-15T10:00:00.000Z',
      due: '2026-11-18',
    });
    // q-a3: due today & streak 1
    world.progress.set('q-a3', {
      seen: 2,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'C',
      lastAt: '2026-11-12T10:00:00.000Z',
      due: '2026-11-15',
    });
    // q-b1: graduated (seen 1, correct 1, streak 1, due null)
    world.progress.set('q-b1', {
      seen: 1,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'D',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: null,
    });
    // q-b2: unseen (new)

    const newQ = buildQueue(world, makeConfig({ mode: 'new', count: 10 }), now, makeSeededRng(3));
    assert.deepEqual(newQ, ['q-b2']);

    const wrongQ = buildQueue(world, makeConfig({ mode: 'wrong', count: 10 }), now, makeSeededRng(3));
    assert.deepEqual(new Set(wrongQ), new Set(['q-a1', 'q-a2']));

    const dueQ = buildQueue(world, makeConfig({ mode: 'due', count: 10 }), now, makeSeededRng(3));
    assert.deepEqual(new Set(dueQ), new Set(['q-a1', 'q-a3']));
  });

  it('orders mixed mode as due -> wrong -> new -> rest without duplicates', () => {
    const world = createTestWorld();

    // q-a1: due (and also wrong -> stays in due tier)
    world.progress.set('q-a1', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'B',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: '2026-11-14',
    });
    // q-a2: wrong (future due)
    world.progress.set('q-a2', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'A',
      lastAt: '2026-11-15T10:00:00.000Z',
      due: '2026-11-17',
    });
    // q-a3: graduated (rest)
    world.progress.set('q-a3', {
      seen: 1,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'C',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: null,
    });
    // q-b1: due (streak 1)
    world.progress.set('q-b1', {
      seen: 2,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'D',
      lastAt: '2026-11-12T10:00:00.000Z',
      due: '2026-11-15',
    });
    // q-b2: new

    const fullMixed = buildQueue(world, makeConfig({ mode: 'mixed', count: 10 }), now, makeSeededRng(7));
    assert.equal(fullMixed.length, 5);
    assert.equal(new Set(fullMixed).size, 5);

    // Tier 1 (due): q-a1, q-b1
    assert.deepEqual(new Set(fullMixed.slice(0, 2)), new Set(['q-a1', 'q-b1']));
    // Tier 2 (wrong): q-a2
    assert.equal(fullMixed[2], 'q-a2');
    // Tier 3 (new): q-b2
    assert.equal(fullMixed[3], 'q-b2');
    // Tier 4 (rest): q-a3
    assert.equal(fullMixed[4], 'q-a3');

    // Respects count limit
    const limited = buildQueue(world, makeConfig({ mode: 'mixed', count: 3 }), now, makeSeededRng(7));
    assert.equal(limited.length, 3);
    assert.deepEqual(new Set(limited), new Set(['q-a1', 'q-b1', 'q-a2']));
  });

  it('orders mixed mode with viewed-unseen ahead of completely unseen', () => {
    const world = createTestWorld();

    // q-a1: due
    world.progress.set('q-a1', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'B',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: '2026-11-14',
    });
    // q-a2: wrong
    world.progress.set('q-a2', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'A',
      lastAt: '2026-11-15T10:00:00.000Z',
      due: '2026-11-17',
    });
    // q-a3: graduated (rest)
    world.progress.set('q-a3', {
      seen: 1,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'C',
      lastAt: '2026-11-14T10:00:00.000Z',
      due: null,
    });
    // q-b1: viewed in read mode, never answered
    world.progress.set('q-b1', {
      seen: 0,
      correct: 0,
      views: 2,
      streak: 0,
      lastPick: null,
      lastAt: '2026-11-15T08:00:00.000Z',
      due: null,
    });
    // q-b2: never viewed, never answered

    const fullMixed = buildQueue(world, makeConfig({ mode: 'mixed', count: 10 }), now, makeSeededRng(7));
    assert.deepEqual(fullMixed, ['q-a1', 'q-a2', 'q-b1', 'q-b2', 'q-a3']);
  });

  it('filters questions by ask (positive, negative, all)', () => {
    const world = createTestWorld();
    const qA2 = world.questions.get('q-a2')!;
    world.questions.set('q-a2', { ...qA2, stem: '下列敘述何者錯誤？' });
    const qB1 = world.questions.get('q-b1')!;
    world.questions.set('q-b1', { ...qB1, stem: '下列何者非屬自治事項？' });

    const pos = buildQueue(world, makeConfig({ ask: 'positive', count: 10 }), now, makeSeededRng(1));
    assert.deepEqual(new Set(pos), new Set(['q-a1', 'q-a3', 'q-b2']));

    const neg = buildQueue(world, makeConfig({ ask: 'negative', count: 10 }), now, makeSeededRng(1));
    assert.deepEqual(new Set(neg), new Set(['q-a2', 'q-b1']));

    const all = buildQueue(world, makeConfig({ ask: 'all', count: 10 }), now, makeSeededRng(1));
    assert.equal(all.length, 5);
  });

  it('filters by topicIds (multi-topic intersection, excludes unenriched, empty means all, exam unaffected)', () => {
    const world = createTestWorld();
    const baseEnrich = world.enrich.get('q-a1')!;
    world.enrich.set('q-a1', { ...baseEnrich, id: 'q-a1', topic: ['t-1', 't-2'] });
    world.enrich.set('q-a2', { ...baseEnrich, id: 'q-a2', topic: ['t-2'] });
    // q-a3, q-b1, q-b2 have no enrich data

    // Filter by ['t-1'] -> only q-a1 (even though it has 2 topics)
    const t1 = buildQueue(
      world,
      makeConfig({ ask: 'all', count: 10, topicIds: ['t-1'] }),
      now,
      makeSeededRng(1),
    );
    assert.deepEqual(t1, ['q-a1']);

    // Filter by ['t-2'] -> q-a1 and q-a2; unenriched q-a3/q-b1/q-b2 excluded
    const t2 = buildQueue(
      world,
      makeConfig({ ask: 'all', count: 10, topicIds: ['t-2'] }),
      now,
      makeSeededRng(1),
    );
    assert.deepEqual(new Set(t2), new Set(['q-a1', 'q-a2']));

    // Empty topicIds means unrestricted (all 5 ok questions)
    const emptyTopicIds = buildQueue(
      world,
      makeConfig({ ask: 'all', count: 10, topicIds: [] }),
      now,
      makeSeededRng(1),
    );
    assert.equal(emptyTopicIds.length, 5);

    // Exam round ignores topicIds
    const examQueue = buildQueue(
      world,
      makeConfig({
        ask: 'all',
        topicIds: ['t-1'],
        exam: { paperId: '115-general-subj-a', minutes: 5 },
      }),
      now,
      makeSeededRng(1),
    );
    assert.deepEqual(examQueue, ['q-a1', 'q-a2', 'q-a3']);
  });
});
