import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { STORAGE_KEY } from '../core/constants/round';
import { READ_PASSES_DEFAULT } from '../core/constants/study';
import type { RoundState } from '../core/types';
import { createWorld } from '../core/world';
import {
  makeConfig,
  makeSeededRng,
  testBank,
  testPaperA,
  testPaperB,
  testPaperFiles,
  testQuestionsA,
} from '../testing/fixture';
import { loadBank } from './bankLoader';
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

  it('defaults installHintDismissed to false for legacy saves and preserves true on round-trip', () => {
    const legacyJson = JSON.stringify({
      version: 1,
      progress: {},
      settings: { theme: 'light', lastRound: null },
    });
    const legacyWorld = createWorld();
    attachPersistence(legacyWorld, createMemoryStorage({ [STORAGE_KEY]: legacyJson }));
    assert.equal(legacyWorld.settings.installHintDismissed, false);

    dispatch(legacyWorld, { type: 'dismissInstallHint' });
    const exported = exportProgress(legacyWorld);
    const restoredWorld = createWorld();
    dispatch(restoredWorld, { type: 'importProgress', json: exported });
    assert.equal(restoredWorld.settings.installHintDismissed, true);

    const badSettingsJson = JSON.stringify({
      version: 1,
      progress: {},
      settings: { theme: 'light', lastRound: null, installHintDismissed: 'yes' },
    });
    assert.equal(importProgress(restoredWorld, badSettingsJson).ok, false);
  });

  it('fills defaults for legacy saves missing views, study, ask, and passes', () => {
    const legacyJson = JSON.stringify({
      version: 1,
      progress: {
        'q-a1': {
          seen: 2,
          correct: 1,
          streak: 0,
          lastPick: 'B',
          lastAt: '2026-11-15T10:00:00.000Z',
          due: '2026-11-16',
        },
      },
      settings: {
        theme: 'dark',
        lastRound: {
          bankId: 'test-bank',
          subjectKeys: ['subj-a'],
          count: 10,
          mode: 'mixed',
          fast: true,
        },
      },
    });

    const world = createWorld();
    attachPersistence(world, createMemoryStorage({ [STORAGE_KEY]: legacyJson }));

    assert.equal(world.progress.get('q-a1')?.views, 0);
    assert.equal(world.settings.lastRound?.study, 'quiz');
    assert.equal(world.settings.lastRound?.ask, 'positive');
    assert.equal(world.settings.lastRound?.passes, READ_PASSES_DEFAULT);

    // Invalid new fields are rejected
    const invalidViews = JSON.stringify({
      version: 1,
      progress: {
        'q-a1': {
          seen: 1,
          correct: 1,
          views: -1,
          streak: 1,
          lastPick: 'A',
          lastAt: '2026-11-15T10:00:00.000Z',
          due: null,
        },
      },
    });
    assert.equal(importProgress(world, invalidViews).ok, false);

    const invalidStudy = JSON.stringify({
      version: 1,
      progress: {},
      settings: {
        theme: 'light',
        lastRound: {
          bankId: 'test-bank',
          subjectKeys: [],
          count: 10,
          mode: 'mixed',
          fast: false,
          study: 'invalid',
        },
      },
    });
    assert.equal(importProgress(world, invalidStudy).ok, false);
  });

  it('persists active round, restores into savedRound, omits round from export, and clears on finish/discard', () => {
    const fixedNow = () => new Date('2026-11-16T01:00:00.000Z');
    const storage = createMemoryStorage();

    // 1. Save active round progress into storage
    const world1 = createWorld();
    attachPersistence(world1, storage);
    loadBank(world1, [testBank], testPaperFiles);

    dispatch(
      world1,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    assert.ok(world1.round !== null);

    const firstId = world1.round.queue[0]!;
    const firstAns = world1.questions.get(firstId)!.answer[0]!;
    dispatch(world1, { type: 'answer', pick: firstAns }, { now: fixedNow });
    dispatch(world1, { type: 'next' }, { now: fixedNow });
    assert.equal(world1.round.index, 1);

    // exportProgress must NOT contain round
    const exported = JSON.parse(exportProgress(world1)) as Record<string, unknown>;
    assert.equal('round' in exported, false);

    // storage must contain round at index 1
    const storedBeforeReload = JSON.parse(storage.data[STORAGE_KEY]!) as { round?: { index: number } };
    assert.equal(storedBeforeReload.round?.index, 1);

    // 2. Recreate world: puts round into savedRound (not world.round), survives empty initial loadBank, validates on papers load
    const world2 = createWorld();
    const getRound2 = (): RoundState | null => world2.round;
    attachPersistence(world2, storage);
    assert.equal(getRound2(), null);
    assert.ok(world2.savedRound !== null);
    assert.equal(world2.savedRound.index, 1);

    // Initial metadata-only loadBank (0 questions) must not prematurely discard savedRound
    loadBank(world2, [testBank], []);
    assert.ok(world2.savedRound !== null);

    // Full loadBank keeps savedRound when all questions exist
    loadBank(world2, [testBank], testPaperFiles);
    assert.ok(world2.savedRound !== null);

    // Resume moves savedRound to world.round and emits roundRestored
    let restoredEvents = 0;
    world2.bus.on('roundRestored', () => {
      restoredEvents += 1;
    });
    dispatch(world2, { type: 'resumeRound' });
    assert.equal(restoredEvents, 1);
    assert.equal(world2.savedRound, null);
    const resumed = getRound2();
    assert.ok(resumed !== null);
    assert.equal(resumed.index, 1);

    // 3. Finish remaining questions -> round is cleared from storage
    while (getRound2()) {
      const current = getRound2()!;
      const qId = current.queue[current.index]!;
      const ans = world2.questions.get(qId)!.answer[0]!;
      dispatch(world2, { type: 'answer', pick: ans }, { now: fixedNow });
      dispatch(world2, { type: 'next' }, { now: fixedNow });
    }
    const storedAfterFinish = JSON.parse(storage.data[STORAGE_KEY]!) as Record<string, unknown>;
    assert.equal('round' in storedAfterFinish, false);

    // 4. Discards savedRound when any queued question is missing from bank
    dispatch(
      world2,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 3 }) },
      { now: fixedNow, rng: makeSeededRng(2) },
    );
    assert.ok(world2.round !== null);

    const world3 = createWorld();
    attachPersistence(world3, storage);
    assert.ok(world3.savedRound !== null);
    loadBank(world3, [testBank], [
      { paper: testPaperA, groups: [], questions: testQuestionsA.slice(0, 1), essays: [] },
      { paper: testPaperB, groups: [], questions: [], essays: [] },
    ]);
    assert.equal(world3.savedRound, null);
    const storedAfterInvalid = JSON.parse(storage.data[STORAGE_KEY]!) as Record<string, unknown>;
    assert.equal('round' in storedAfterInvalid, false);
  });

  it('clears saved round on quitRound (discarded) and discardSavedRound', () => {
    const fixedNow = () => new Date('2026-11-16T01:00:00.000Z');
    const storage = createMemoryStorage();

    const world1 = createWorld();
    attachPersistence(world1, storage);
    loadBank(world1, [testBank], testPaperFiles);

    // Read mode advances are persisted, and quitRound clears storage
    dispatch(
      world1,
      { type: 'startRound', config: makeConfig({ study: 'read', subjectKeys: ['subj-a'], count: 3, passes: 2 }) },
      { now: fixedNow, rng: makeSeededRng(3) },
    );
    dispatch(world1, { type: 'next' }, { now: fixedNow, rng: makeSeededRng(3) });
    const storedRead = JSON.parse(storage.data[STORAGE_KEY]!) as { round?: { index: number } };
    assert.equal(storedRead.round?.index, 1);

    dispatch(world1, { type: 'quitRound' }, { now: fixedNow });
    const storedAfterQuit = JSON.parse(storage.data[STORAGE_KEY]!) as Record<string, unknown>;
    assert.equal('round' in storedAfterQuit, false);

    // discardSavedRound clears storage too
    dispatch(
      world1,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now: fixedNow, rng: makeSeededRng(4) },
    );
    const world2 = createWorld();
    attachPersistence(world2, storage);
    assert.ok(world2.savedRound !== null);
    dispatch(world2, { type: 'discardSavedRound' });
    assert.equal(world2.savedRound, null);
    const storedAfterDiscard = JSON.parse(storage.data[STORAGE_KEY]!) as Record<string, unknown>;
    assert.equal('round' in storedAfterDiscard, false);
  });

  it('round-trips days and accessory, validates invalid values, and backfills legacy saves once', () => {
    const storage = createMemoryStorage();
    const world1 = createWorld();
    attachPersistence(world1, storage);

    for (let i = 1; i <= 3; i += 1) {
      world1.dayLog.set(`2026-11-0${i}`, 15);
    }
    dispatch(world1, { type: 'setAccessory', accessory: 'bow' });

    const exported = exportProgress(world1);
    const parsedExport = JSON.parse(exported) as { days?: Record<string, number>; settings?: { accessory?: string } };
    assert.deepEqual(parsedExport.days, {
      '2026-11-01': 15,
      '2026-11-02': 15,
      '2026-11-03': 15,
    });
    assert.equal(parsedExport.settings?.accessory, 'bow');

    const world2 = createWorld();
    const res = importProgress(world2, exported);
    assert.equal(res.ok, true);
    assert.equal(world2.dayLog.get('2026-11-02'), 15);
    assert.equal(world2.settings.accessory, 'bow');

    // Invalid days and invalid accessory must be rejected
    assert.equal(
      importProgress(world2, JSON.stringify({ version: 1, progress: {}, days: { '2026-13-01': 5 } })).ok,
      false,
    );
    assert.equal(
      importProgress(world2, JSON.stringify({ version: 1, progress: {}, days: { '2026-11-01': -1 } })).ok,
      false,
    );
    assert.equal(
      importProgress(
        world2,
        JSON.stringify({ version: 1, progress: {}, settings: { theme: 'light', lastRound: null, accessory: 'cape' } }),
      ).ok,
      false,
    );

    // Legacy save without `days`: backfills once on startup and writes back `days`
    const legacyStorage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        progress: {
          'q-a1': {
            seen: 1,
            correct: 1,
            views: 0,
            streak: 1,
            lastPick: 'A',
            lastAt: '2026-11-10T12:00:00',
            due: null,
          },
          'q-a2': {
            seen: 1,
            correct: 0,
            views: 0,
            streak: 0,
            lastPick: 'B',
            lastAt: '2026-11-10T14:00:00',
            due: '2026-11-11',
          },
        },
        settings: { theme: 'light', lastRound: null },
      }),
    });

    const legacyWorld1 = createWorld();
    attachPersistence(legacyWorld1, legacyStorage);
    assert.equal(legacyWorld1.dayLog.get('2026-11-10'), 2);

    // Storage now persists `days`, so reloading into a new world keeps 2 without re-backfilling
    const persistedAfterLoad = JSON.parse(legacyStorage.data[STORAGE_KEY]!) as { days?: Record<string, number> };
    assert.deepEqual(persistedAfterLoad.days, { '2026-11-10': 2 });

    const legacyWorld2 = createWorld();
    attachPersistence(legacyWorld2, legacyStorage);
    assert.equal(legacyWorld2.dayLog.get('2026-11-10'), 2);

    // resetProgress clears both progress and dayLog
    dispatch(legacyWorld2, { type: 'resetProgress' });
    assert.equal(legacyWorld2.progress.size, 0);
    assert.equal(legacyWorld2.dayLog.size, 0);
  });
});
