import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DayKey, Progress, QuestionId } from '../core/types';
import { mergeDays, mergeProgress, mergeWardrobe, type SyncWardrobe } from './syncMerge';

function makeProg(overrides: Partial<Progress> = {}): Progress {
  return {
    seen: 1,
    correct: 1,
    views: 0,
    streak: 1,
    lastPick: 'A',
    lastAt: '2026-11-15T10:00:00.000Z',
    due: null,
    ...overrides,
  };
}

describe('syncMerge', () => {
  it('keeps entries present on only one side', () => {
    const local = new Map<QuestionId, Progress>([
      ['q1', makeProg({ seen: 2, correct: 1 })],
    ]);
    const remote = new Map<QuestionId, Progress>([
      ['q2', makeProg({ seen: 3, correct: 3, views: 2 })],
    ]);

    const merged = mergeProgress(local, remote);
    assert.equal(merged.size, 2);
    assert.deepEqual(merged.get('q1'), local.get('q1'));
    assert.deepEqual(merged.get('q2'), remote.get('q2'));
  });

  it('picks the record with later lastAt and takes max views', () => {
    const older = makeProg({
      seen: 5,
      correct: 4,
      views: 10,
      streak: 3,
      lastPick: 'B',
      lastAt: '2026-11-15T09:00:00.000Z',
      due: '2026-11-20',
    });
    const newer = makeProg({
      seen: 2,
      correct: 1,
      views: 3,
      streak: 0,
      lastPick: 'C',
      lastAt: '2026-11-15T10:00:00.000Z',
      due: '2026-11-16',
    });

    const merged = mergeProgress(
      new Map([['q1', older]]),
      new Map([['q1', newer]]),
    );
    assert.deepEqual(merged.get('q1'), {
      ...newer,
      views: 10,
    });
  });

  it('picks larger seen when lastAt is identical, with max views', () => {
    const a = makeProg({
      seen: 2,
      correct: 2,
      views: 4,
      lastAt: '2026-11-15T10:00:00.000Z',
    });
    const b = makeProg({
      seen: 5,
      correct: 3,
      views: 1,
      lastAt: '2026-11-15T10:00:00.000Z',
    });

    const merged = mergeProgress(new Map([['q1', a]]), new Map([['q1', b]]));
    assert.deepEqual(merged.get('q1'), { ...b, views: 4 });
  });

  it('is strictly commutative regardless of argument order', () => {
    const left = new Map<QuestionId, Progress>([
      ['q-only-l', makeProg({ seen: 1 })],
      ['q-time', makeProg({ seen: 2, views: 7, lastAt: '2026-11-15T08:00:00+08:00' })],
      ['q-same-time', makeProg({ seen: 4, views: 1, lastAt: '2026-11-15T12:00:00.000Z' })],
      ['q-tie', makeProg({ seen: 3, correct: 2, views: 5, streak: 1, lastPick: 'A', due: '2026-11-18' })],
    ]);
    const right = new Map<QuestionId, Progress>([
      ['q-only-r', makeProg({ seen: 2 })],
      ['q-time', makeProg({ seen: 1, views: 2, lastAt: '2026-11-15T01:00:00.000Z' })],
      ['q-same-time', makeProg({ seen: 6, views: 3, lastAt: '2026-11-15T12:00:00.000Z' })],
      ['q-tie', makeProg({ seen: 3, correct: 3, views: 2, streak: 2, lastPick: 'D', due: null })],
    ]);

    const lr = mergeProgress(left, right);
    const rl = mergeProgress(right, left);

    assert.equal(lr.size, rl.size);
    for (const [id, entry] of lr) {
      assert.deepEqual(entry, rl.get(id));
    }
  });

  it('merges days by taking the max count per date and is commutative', () => {
    const local = new Map<DayKey, number>([
      ['2026-11-14', 5],
      ['2026-11-15', 16],
      ['2026-11-16', 4],
    ]);
    const remote = new Map<DayKey, number>([
      ['2026-11-15', 12],
      ['2026-11-16', 15],
      ['2026-11-17', 9],
    ]);

    const lr = mergeDays(local, remote);
    const rl = mergeDays(remote, local);

    assert.deepEqual(Object.fromEntries(lr), {
      '2026-11-14': 5,
      '2026-11-15': 16,
      '2026-11-16': 15,
      '2026-11-17': 9,
    });
    assert.deepEqual(Object.fromEntries(lr), Object.fromEntries(rl));
  });

  it('merges wardrobe owned, achievements, and quests with commutativity and idempotency', () => {
    const local: SyncWardrobe = {
      owned: ['wings', 'beanie'],
      achievements: ['exam-60', 'answered-100'],
      quests: {
        '2026-11-18': ['exam'],
        '2026-11-17': ['quiz-round'],
      },
    };
    const remote: SyncWardrobe = {
      owned: ['beanie', 'bell'],
      achievements: ['answered-100', 'stamps-3'],
      quests: {
        '2026-11-17': ['new-card', 'quiz-round'],
        '2026-11-19': ['topic-round'],
      },
    };

    const lr = mergeWardrobe(local, remote);
    const rl = mergeWardrobe(remote, local);

    assert.deepEqual(lr, {
      owned: ['beanie', 'bell', 'wings'],
      achievements: ['answered-100', 'exam-60', 'stamps-3'],
      quests: {
        '2026-11-17': ['new-card', 'quiz-round'],
        '2026-11-18': ['exam'],
        '2026-11-19': ['topic-round'],
      },
    });
    assert.deepEqual(lr, rl);
    assert.deepEqual(mergeWardrobe(lr, lr), lr);
    assert.deepEqual(mergeWardrobe(local, undefined), mergeWardrobe(undefined, local));
  });
});
