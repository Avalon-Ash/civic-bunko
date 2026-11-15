import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { createTestWorld } from '../testing/fixture';
import { isInstallHintDismissed, progressOverview } from './backup';

describe('backup & install hint selectors', () => {
  it('reads installHintDismissed defaulting to false', () => {
    const world = createTestWorld();
    assert.equal(isInstallHintDismissed(world), false);

    dispatch(world, { type: 'dismissInstallHint' });
    assert.equal(isInstallHintDismissed(world), true);
  });

  it('computes seenCount and latest lastAnsweredAt from world progress', () => {
    const world = createTestWorld();
    assert.deepEqual(progressOverview(world), { seenCount: 0, lastAnsweredAt: null });

    world.progress.set('q-a1', {
      seen: 1,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'A',
      lastAt: '2026-11-15T09:00:00.000Z',
      due: null,
    });
    world.progress.set('q-a2', {
      seen: 2,
      correct: 1,
      views: 0,
      streak: 0,
      lastPick: 'B',
      lastAt: '2026-11-16T08:30:00.000Z',
      due: '2026-11-17',
    });
    world.progress.set('q-zero', {
      seen: 0,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: null,
      lastAt: '2026-11-17T00:00:00.000Z',
      due: null,
    });

    assert.deepEqual(progressOverview(world), {
      seenCount: 2,
      lastAnsweredAt: '2026-11-16T08:30:00.000Z',
    });
  });
});
