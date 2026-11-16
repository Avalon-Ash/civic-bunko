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

  it('round-trips exam config, startedAt, optionOrder, and shuffleOptions, and discards malformed saved rounds', () => {
    const fixedNow = () => new Date('2026-11-16T08:00:00.000Z');

    // 1. Exam round round-trip preserves config.exam, startedAt, and examPicks
    const examStorage = createMemoryStorage();
    const worldExam1 = createWorld();
    attachPersistence(worldExam1, examStorage);
    loadBank(worldExam1, [testBank], testPaperFiles);

    dispatch(
      worldExam1,
      {
        type: 'startRound',
        config: makeConfig({ exam: { paperId: testPaperA.id, minutes: 4 } }),
      },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    dispatch(worldExam1, { type: 'examPick', pick: 'A' });
    dispatch(worldExam1, { type: 'examGoto', index: 2 });
    dispatch(worldExam1, { type: 'examPick', pick: 'C' });
    dispatch(worldExam1, { type: 'examGoto', index: 0 });
    assert.ok(worldExam1.round !== null);

    const worldExam2 = createWorld();
    attachPersistence(worldExam2, examStorage);
    assert.deepEqual(worldExam2.savedRound?.config.exam, { paperId: testPaperA.id, minutes: 4 });
    assert.equal(worldExam2.savedRound?.startedAt, '2026-11-16T08:00:00.000Z');
    assert.deepEqual(worldExam2.savedRound?.examPicks, { 'q-a1': 'A', 'q-a3': 'C' });
    assert.equal(worldExam2.savedRound?.pick, 'A');

    dispatch(worldExam2, { type: 'resumeRound' });
    assert.deepEqual(worldExam2.round?.examPicks, { 'q-a1': 'A', 'q-a3': 'C' });
    assert.equal(worldExam2.round?.pick, 'A');

    // 2. Shuffled quiz round round-trip preserves settings.shuffleOptions and round.optionOrder
    const shuffleStorage = createMemoryStorage();
    const worldShuf1 = createWorld();
    attachPersistence(worldShuf1, shuffleStorage);
    loadBank(worldShuf1, [testBank], testPaperFiles);

    dispatch(worldShuf1, { type: 'setShuffleOptions', on: true });
    dispatch(
      worldShuf1,
      { type: 'startRound', config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }) },
      { now: fixedNow, rng: makeSeededRng(7) },
    );
    const savedOrders = worldShuf1.round?.optionOrder;
    assert.ok(savedOrders !== undefined);

    const worldShuf2 = createWorld();
    attachPersistence(worldShuf2, shuffleStorage);
    assert.equal(worldShuf2.settings.shuffleOptions, true);
    assert.deepEqual(worldShuf2.savedRound?.optionOrder, savedOrders);

    // 3. Malformed exam, startedAt, or optionOrder in saved round discards the entire round
    const baseRound = {
      config: makeConfig({ subjectKeys: ['subj-a'], count: 2 }),
      queue: ['q-a1', 'q-a2'],
      index: 0,
      pick: null,
      results: [],
      combo: 0,
      finished: false,
      pass: 1,
    };

    const malformedRounds = [
      // Exam missing startedAt
      { ...baseRound, config: { ...baseRound.config, exam: { paperId: testPaperA.id, minutes: 4 } } },
      // Exam with invalid minutes
      {
        ...baseRound,
        config: { ...baseRound.config, exam: { paperId: testPaperA.id, minutes: 0 } },
        startedAt: '2026-11-16T08:00:00.000Z',
      },
      // Invalid startedAt string
      { ...baseRound, startedAt: 'not-a-date' },
      // optionOrder with duplicate choices
      { ...baseRound, optionOrder: { 'q-a1': ['A', 'A', 'B', 'C'] } },
      // optionOrder with wrong length
      { ...baseRound, optionOrder: { 'q-a1': ['A', 'B', 'C'] } },
      // optionOrder with non-choice value
      { ...baseRound, optionOrder: { 'q-a1': ['A', 'B', 'C', 'E'] } },
      // examPicks with key not in queue
      {
        ...baseRound,
        config: { ...baseRound.config, exam: { paperId: testPaperA.id, minutes: 4 } },
        startedAt: '2026-11-16T08:00:00.000Z',
        examPicks: { 'q-not-in-queue': 'A' },
      },
      // examPicks with invalid choice
      {
        ...baseRound,
        config: { ...baseRound.config, exam: { paperId: testPaperA.id, minutes: 4 } },
        startedAt: '2026-11-16T08:00:00.000Z',
        examPicks: { 'q-a1': 'E' },
      },
      // examPicks not an object
      {
        ...baseRound,
        config: { ...baseRound.config, exam: { paperId: testPaperA.id, minutes: 4 } },
        startedAt: '2026-11-16T08:00:00.000Z',
        examPicks: 'bad',
      },
    ];

    for (const badRound of malformedRounds) {
      const badStorage = createMemoryStorage({
        [STORAGE_KEY]: JSON.stringify({
          version: 1,
          progress: {},
          settings: { theme: 'system', lastRound: null },
          round: badRound,
        }),
      });
      const badWorld = createWorld();
      attachPersistence(badWorld, badStorage);
      assert.equal(badWorld.savedRound, null);
    }
  });

  it('round-trips examHistory and drops only malformed examHistory entries', () => {
    const valid1 = {
      paperId: testPaperA.id,
      at: '2026-11-16T08:00:00.000Z',
      total: 3,
      answered: 3,
      correct: 2,
      score: 67,
    };
    const valid2 = {
      paperId: testPaperB.id,
      at: '2026-11-16T09:00:00.000Z',
      total: 2,
      answered: 2,
      correct: 2,
      score: 100,
    };

    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        progress: {},
        settings: {
          theme: 'light',
          lastRound: null,
          examHistory: [
            valid1,
            { paperId: '', at: '2026-11-16T08:30:00.000Z', total: 3, answered: 3, correct: 1, score: 33 },
            { paperId: testPaperA.id, at: 'not-a-date', total: 3, answered: 3, correct: 1, score: 33 },
            { paperId: testPaperA.id, at: '2026-11-16T08:40:00.000Z', total: 3, answered: 4, correct: 1, score: 33 },
            { paperId: testPaperA.id, at: '2026-11-16T08:45:00.000Z', total: 3, answered: 2, correct: 3, score: 100 },
            { paperId: testPaperA.id, at: '2026-11-16T08:50:00.000Z', total: 3, answered: 2, correct: 1, score: 105 },
            'not-an-object',
            valid2,
          ],
        },
      }),
    });

    const world1 = createWorld();
    attachPersistence(world1, storage);
    assert.equal(world1.settings.theme, 'light');
    assert.deepEqual(world1.settings.examHistory, [valid1, valid2]);

    const exported = exportProgress(world1);
    const world2 = createWorld();
    const res = importProgress(world2, exported);
    assert.equal(res.ok, true);
    assert.deepEqual(world2.settings.examHistory, [valid1, valid2]);
  });

  it('round-trips topicIds in savedRound, discards malformed topicIds, and strips topicIds from settings.lastRound', () => {
    const fixedNow = () => new Date('2026-11-16T10:00:00.000Z');
    const storage = createMemoryStorage();

    // 1. Saved round preserves config.topicIds across reload and resume
    const world1 = createWorld();
    attachPersistence(world1, storage);
    loadBank(world1, [testBank], testPaperFiles);
    const baseEnrich = {
      id: 'q-a1',
      topic: ['t-1'],
      mnemonic: 'm',
      trap: 't',
      plain: null,
      marks: [],
      options: {
        A: { why: 'a', lawRef: null },
        B: { why: 'b', lawRef: null },
        C: { why: 'c', lawRef: null },
        D: { why: 'd', lawRef: null },
      },
      visual: null,
      lawChanged: null,
      confidence: 'high' as const,
      reviewed: false,
    };
    world1.enrich.set('q-a1', baseEnrich);
    world1.enrich.set('q-a2', { ...baseEnrich, id: 'q-a2', topic: ['t-1'] });

    dispatch(
      world1,
      { type: 'startRound', config: makeConfig({ ask: 'all', count: 10, topicIds: ['t-1'] }) },
      { now: fixedNow, rng: makeSeededRng(1) },
    );
    assert.ok(world1.round !== null);

    const world2 = createWorld();
    attachPersistence(world2, storage);
    assert.deepEqual(world2.savedRound?.config.topicIds, ['t-1']);
    dispatch(world2, { type: 'resumeRound' });
    assert.deepEqual(world2.round?.config.topicIds, ['t-1']);

    // 2. Malformed topicIds in saved round discards the round without throwing
    const badTopicIdsValues = ['t-1', 123, null, ['t-1', 42], { id: 't-1' }];
    for (const badTopicIds of badTopicIdsValues) {
      const badStorage = createMemoryStorage({
        [STORAGE_KEY]: JSON.stringify({
          version: 1,
          progress: {},
          settings: { theme: 'system', lastRound: null },
          round: {
            config: { ...makeConfig({ subjectKeys: ['subj-a'], count: 2 }), topicIds: badTopicIds },
            queue: ['q-a1', 'q-a2'],
            index: 0,
            pick: null,
            results: [],
            combo: 0,
            finished: false,
            pass: 1,
          },
        }),
      });
      const badWorld = createWorld();
      attachPersistence(badWorld, badStorage);
      assert.equal(badWorld.savedRound, null);
    }

    // 3. settings.lastRound strips topicIds when loaded from storage
    const lastRoundWithTopicsStorage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        progress: {},
        settings: {
          theme: 'light',
          lastRound: {
            ...makeConfig({ subjectKeys: ['subj-a'], count: 5 }),
            topicIds: ['t-1', 't-2'],
          },
        },
      }),
    });
    const cleanWorld = createWorld();
    attachPersistence(cleanWorld, lastRoundWithTopicsStorage);
    assert.ok(cleanWorld.settings.lastRound !== null);
    assert.equal(cleanWorld.settings.lastRound.topicIds, undefined);
    assert.equal('topicIds' in cleanWorld.settings.lastRound, false);
  });

  it('round-trips settings.bilingual and drops non-boolean bilingual field without failing settings', () => {
    const storage = createMemoryStorage();
    const world1 = createWorld();
    attachPersistence(world1, storage);

    dispatch(world1, { type: 'setBilingual', on: false });
    const world2 = createWorld();
    attachPersistence(world2, storage);
    assert.equal(world2.settings.bilingual, false);

    const exportedFalse = exportProgress(world2);
    const world3 = createWorld();
    assert.equal(importProgress(world3, exportedFalse).ok, true);
    assert.equal(world3.settings.bilingual, false);

    dispatch(world3, { type: 'setBilingual', on: true });
    const exportedTrue = exportProgress(world3);
    const world4 = createWorld();
    assert.equal(importProgress(world4, exportedTrue).ok, true);
    assert.equal(world4.settings.bilingual, true);

    for (const badValue of ['yes', 1, null, { on: true }]) {
      const badJson = JSON.stringify({
        version: 1,
        progress: {},
        settings: {
          theme: 'dark',
          lastRound: null,
          bilingual: badValue,
        },
      });
      const target = createWorld();
      const res = importProgress(target, badJson);
      assert.equal(res.ok, true);
      assert.equal(target.settings.theme, 'dark');
      assert.equal('bilingual' in target.settings, false);
      assert.equal(target.settings.bilingual, undefined);
    }
  });
});
