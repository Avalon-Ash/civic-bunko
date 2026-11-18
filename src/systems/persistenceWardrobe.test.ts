import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY } from '../core/constants/round';
import { ACHIEVEMENTS } from '../core/constants/wardrobe';
import { createWorld, type World } from '../core/world';
import { unlockedAchievements } from '../selectors/wardrobe';
import {
  attachPersistence,
  exportProgress,
  importProgress,
  type StorageLike,
} from './persistence';

function golden(name: string): string {
  return readFileSync(new URL(`../testing/golden/${name}`, import.meta.url), 'utf8');
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
  writes: number;
} {
  const data: Record<string, string> = { ...initial };
  const store = {
    data,
    writes: 0,
    getItem: (key: string) => (key in data ? (data[key] ?? null) : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
      store.writes += 1;
    },
  };
  return store;
}

function loadSave(raw: string): { world: World; storage: ReturnType<typeof memoryStorage> } {
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  const world = createWorld();
  attachPersistence(world, storage);
  return { world, storage };
}

describe('persistence wardrobe', () => {
  it('round-trips save-v2-wardrobe.json unchanged including unknown IDs and does not re-celebrate saved achievements', () => {
    const raw = golden('save-v2-wardrobe.json');
    const { world, storage } = loadSave(raw);

    assert.deepEqual(world.settings.wardrobe, {
      owned: ['beanie', 'future-item-v9'],
      achievements: ['exam-1', 'exam-60', 'future-ach-v9'],
      quests: { '2026-11-17': ['quiz-round', 'future-quest-v9'] },
      outfit: { 'head-top': 'beanie', 'head-side': 'bow' },
    });
    // 存檔裡已經有的成就不再慶祝一次；存檔之後才新增的低門檻成就（這份樣本的紀錄已經達標）照常補發
    const saved = new Set(world.settings.wardrobe?.achievements ?? []);
    assert.ok(world.celebrations.every((c) => !saved.has(c.id)));
    assert.deepEqual(
      world.celebrations.map((c) => c.id),
      ACHIEVEMENTS.filter((a) => !saved.has(a.id) && unlockedAchievements(world).has(a.id)).map((a) => a.id),
    );
    assert.equal(storage.writes, 0);

    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    const written: unknown = JSON.parse(storage.data[STORAGE_KEY] ?? 'null');
    const original: unknown = JSON.parse(raw);
    assert.deepEqual(written, original);

    const backup = exportProgress(world);
    const other = createWorld();
    assert.deepEqual(importProgress(other, backup), { ok: true });
    assert.deepEqual(other.settings.wardrobe, world.settings.wardrobe);
  });

  it('drops only corrupted wardrobe or invalid sub-fields while keeping other settings and progress', () => {
    const baseProgress = {
      '115-general-admin-law-q08': {
        seen: 1,
        correct: 1,
        views: 0,
        streak: 1,
        lastPick: 'A',
        lastAt: '2026-11-16T12:00:00.000Z',
        due: null,
      },
    };

    for (const badWardrobe of ['not-an-object', null, 42, ['beanie']]) {
      const world = createWorld();
      const res = importProgress(
        world,
        JSON.stringify({
          version: 1,
          progress: baseProgress,
          settings: {
            theme: 'dark',
            lastRound: null,
            wardrobe: badWardrobe,
          },
        }),
      );
      assert.equal(res.ok, true);
      assert.equal(world.progress.size, 1);
      assert.equal(world.settings.theme, 'dark');
      assert.equal('wardrobe' in world.settings, false);
    }

    const partialBad = JSON.stringify({
      version: 1,
      progress: baseProgress,
      settings: {
        theme: 'light',
        lastRound: null,
        wardrobe: {
          owned: ['beanie', 123],
          achievements: 'bad',
          quests: {
            '2026-13-01': ['quiz-round'],
            '2026-11-17': [99],
            '2026-11-18': ['quiz-round', 'future-quest'],
          },
          outfit: {
            'bad-slot': 'beanie',
            neck: 42,
            'head-top': 'future-hat',
          },
        },
      },
    });
    const partialWorld = createWorld();
    assert.equal(importProgress(partialWorld, partialBad).ok, true);
    assert.deepEqual(partialWorld.settings.wardrobe, {
      owned: [],
      achievements: [],
      quests: { '2026-11-18': ['quiz-round', 'future-quest'] },
      outfit: { 'head-top': 'future-hat' },
    });

    const badOutfitType = JSON.stringify({
      version: 1,
      progress: baseProgress,
      settings: {
        theme: 'light',
        lastRound: null,
        wardrobe: {
          owned: ['beanie'],
          achievements: ['exam-1'],
          quests: {},
          outfit: 'bad-outfit',
        },
      },
    });
    const badOutfitWorld = createWorld();
    assert.equal(importProgress(badOutfitWorld, badOutfitType).ok, true);
    assert.deepEqual(badOutfitWorld.settings.wardrobe, {
      owned: ['beanie'],
      achievements: ['exam-1'],
      quests: {},
    });
  });

  it('still rejects the entire save when settings.accessory is an unrecognized ID', () => {
    const badAccessorySave = JSON.stringify({
      version: 1,
      progress: {},
      settings: {
        theme: 'light',
        lastRound: null,
        accessory: 'cape',
      },
    });

    const target = createWorld();
    assert.equal(importProgress(target, badAccessorySave).ok, false);

    const { world } = loadSave(badAccessorySave);
    assert.equal(world.settings.theme, 'system');
    assert.equal(world.settings.accessory, undefined);
  });

  it('backfills achievements in memory on load without writing storage, then writes on next dayLogChanged', () => {
    const saveWith300 = JSON.stringify({
      version: 1,
      progress: {},
      settings: { theme: 'light', lastRound: null },
      days: {
        '2026-11-15': 150,
        '2026-11-16': 150,
      },
    });

    const { world, storage } = loadSave(saveWith300);
    const unlocked = unlockedAchievements(world);
    assert.equal(unlocked.has('answered-100'), true);
    assert.equal(unlocked.has('answered-300'), true);
    // 補發的是「目前條件已達成」的全部成就，照 ACHIEVEMENTS 的順序
    assert.deepEqual(
      world.celebrations,
      ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).map((a) => ({ kind: 'achievement', id: a.id })),
    );
    const getWardrobe = (w: World) => w.settings.wardrobe;
    assert.equal(getWardrobe(world), undefined);
    assert.equal(storage.writes, 0);

    // Next real user action (dayLogChanged) writes unlocked achievements to wardrobe.achievements
    world.dayLog.set('2026-11-17', 1);
    world.bus.emit({ type: 'dayLogChanged', day: '2026-11-17', count: 1 });

    assert.equal(storage.writes > 0, true);
    const backfilled = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).map((a) => a.id);
    assert.deepEqual(getWardrobe(world)?.achievements, backfilled);
    // Does not duplicate celebrations
    assert.equal(world.celebrations.length, backfilled.length);
  });
});
