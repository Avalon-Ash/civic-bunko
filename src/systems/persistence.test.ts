import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { STORAGE_KEY } from '../core/constants/round';
import { createWorld } from '../core/world';
import {
  attachPersistence,
  exportProgress,
  importProgress,
  type StorageLike,
} from './persistence';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(data, key) ? (data[key] ?? null) : null;
    },
    setItem(key: string, value: string): void {
      data[key] = value;
    },
  };
}

describe('persistence system', () => {
  it('restores valid data on startup and auto-saves on changes', () => {
    const world1 = createWorld();
    const storage = createMemoryStorage();
    attachPersistence(world1, storage);

    dispatch(world1, { type: 'setTheme', theme: 'light' });
    world1.bus.emit({
      type: 'answered',
      id: 'q-a1',
      pick: 'B',
      correct: false,
      at: '2026-11-15T10:00:00.000Z',
    });

    assert.ok(storage.data[STORAGE_KEY]);

    const world2 = createWorld();
    attachPersistence(world2, storage);
    assert.equal(world2.settings.theme, 'light');
    assert.equal(world2.progress.get('q-a1')?.seen, 1);
    assert.equal(world2.progress.get('q-a1')?.streak, 0);
  });

  it('ignores corrupted storage data on startup without throwing', () => {
    const badInputs = [
      'not-json{{{',
      JSON.stringify({ version: 99, progress: {}, settings: { theme: 'dark', lastRound: null } }),
      JSON.stringify({ version: 1, progress: { q1: { seen: 'bad' } } }),
    ];

    for (const raw of badInputs) {
      const world = createWorld();
      const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
      assert.doesNotThrow(() => attachPersistence(world, storage));
      assert.equal(world.progress.size, 0);
      assert.equal(world.settings.theme, 'system');
    }
  });

  it('round-trips export/import and leaves data untouched on invalid import', () => {
    const world = createWorld();
    const storage = createMemoryStorage();
    attachPersistence(world, storage);

    world.bus.emit({
      type: 'answered',
      id: 'q-a1',
      pick: 'A',
      correct: true,
      at: '2026-11-15T10:00:00.000Z',
    });
    dispatch(world, { type: 'setTheme', theme: 'dark' });

    const exported = exportProgress(world);

    // Invalid imports must fail and keep existing data intact
    const badPayloads = [
      '{bad',
      JSON.stringify({ version: 2, progress: {} }),
      JSON.stringify({
        version: 1,
        progress: {
          q2: { seen: 1, correct: 2, streak: 1, lastPick: 'A', lastAt: '2026-11-15', due: null },
        },
      }),
      JSON.stringify({
        version: 1,
        progress: {
          q2: { seen: 1, correct: 1, streak: 1, lastPick: 'Z', lastAt: '2026-11-15', due: null },
        },
      }),
    ];

    for (const bad of badPayloads) {
      const res = importProgress(world, bad);
      assert.equal(res.ok, false);
      assert.throws(() => dispatch(world, { type: 'importProgress', json: bad }));
      assert.equal(world.progress.size, 1);
      assert.ok(world.progress.has('q-a1'));
      assert.equal(world.settings.theme, 'dark');
    }

    // Valid import into a fresh world restores everything
    const target = createWorld();
    dispatch(target, { type: 'importProgress', json: exported });
    assert.equal(target.progress.get('q-a1')?.correct, 1);
    assert.equal(target.settings.theme, 'dark');

    // resetProgress clears progress and persists empty progress
    const targetStorage = createMemoryStorage();
    attachPersistence(target, targetStorage);
    dispatch(target, { type: 'resetProgress' });
    assert.equal(target.progress.size, 0);
    const reloaded = createWorld();
    attachPersistence(reloaded, targetStorage);
    assert.equal(reloaded.progress.size, 0);
  });
});
