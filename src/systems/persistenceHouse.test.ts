// 小貓之家的存檔格式（save-v7-house.json）：讀得回來、寫回去不丟東西、壞掉的只丟那一小項。
// 規則在 docs/plans/cat-house.md §3、docs/adr/0018。樣本與本檔的斷言不准為了讓測試通過而修改。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY } from '../core/constants/round';
import { createWorld, type World } from '../core/world';
import { attachPersistence, exportProgress, importProgress, type StorageLike } from './persistence';

function golden(name: string): string {
  return readFileSync(new URL(`../testing/golden/${name}`, import.meta.url), 'utf8');
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? (data[key] ?? null) : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

function loadSave(raw: string): { world: World; storage: ReturnType<typeof memoryStorage> } {
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  const world = createWorld();
  attachPersistence(world, storage);
  return { world, storage };
}

type RawSave = { settings: { wardrobe: Record<string, unknown> } };

describe('persistence: cat house (save-v7-house.json)', () => {
  it('house golden samples are unchanged', () => {
    const hash = (name: string) => createHash('sha256').update(golden(name).replace(/
/g, '
')).digest('hex');
    assert.equal(hash('save-v7-house.json'), 'fdc8abc7988212cb12f10bc4a5c16a2eb4d755cec3d0187fd6c780fbf9afd32f');
    assert.equal(hash('sync-v1-house.json'), '85c910bcfb8d1ed17753b34af7312da3a33cf42db84f5925e66e9f8755d65979');
  });

  it('reads every house field, including a cat this version does not know yet', () => {
    const { world } = loadSave(golden('save-v7-house.json'));
    const w = world.settings.wardrobe;
    assert.equal(world.settings.catName, '阿福');
    assert.equal(w?.outfitAt, '2026-11-22T01:00:00.000Z');
    assert.deepEqual(w?.outfit, { 'head-top': 'beanie', 'head-side': 'bow' });
    assert.deepEqual(w?.cats, {
      'cat-2': {
        name: '麻糬',
        nameAt: '2026-11-22T01:05:00.000Z',
        outfit: { fur: 'fur-orange', 'head-top': 'beanie' },
        outfitAt: '2026-11-22T01:06:00.000Z',
      },
      'cat-3': {},
      'cat-9': {
        name: '未來貓',
        nameAt: '2026-12-20T00:00:00.000Z',
        outfit: { fur: 'fur-future-v9' },
        outfitAt: '2026-12-20T00:00:00.000Z',
      },
    });
    assert.deepEqual(w?.outing, ['cat-1', 'cat-3']);
    assert.equal(w?.leader, 'cat-2');
    assert.ok(w?.owned.includes('adopt-cat-9'));
  });

  it('writes the save back equivalent, and export → import keeps the house', () => {
    const raw = golden('save-v7-house.json');
    const { world, storage } = loadSave(raw);
    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY] ?? 'null'), JSON.parse(raw));

    const other = createWorld();
    assert.deepEqual(importProgress(other, exportProgress(world)), { ok: true });
    assert.deepEqual(other.settings.wardrobe, world.settings.wardrobe);
  });

  it('drops only the broken bits of the house and keeps the rest of the save', () => {
    const parsed = JSON.parse(golden('save-v7-house.json')) as RawSave;
    parsed.settings.wardrobe.cats = {
      'cat-2': { name: 42, nameAt: '2026-11-22T01:05:00.000Z', outfit: { fur: 'fur-orange', tail: 'x', 'head-top': 7 } },
      'cat-3': 'not-an-object',
      dog: { name: '小狗' },
      'cat-4': { name: '布丁', outfitAt: 123 },
    };
    parsed.settings.wardrobe.outfitAt = 99;
    parsed.settings.wardrobe.outing = ['cat-1', 'dog', 5, 'cat-4', 'cat-4'];
    parsed.settings.wardrobe.leader = 'dog';
    const target = createWorld();
    assert.deepEqual(importProgress(target, JSON.stringify(parsed)), { ok: true });
    const w = target.settings.wardrobe;
    assert.deepEqual(w?.cats, {
      'cat-2': { nameAt: '2026-11-22T01:05:00.000Z', outfit: { fur: 'fur-orange' } },
      'cat-4': { name: '布丁' },
    });
    assert.equal(w?.outfitAt, undefined);
    assert.deepEqual(w?.outing, ['cat-1', 'cat-4']);
    assert.equal(w?.leader, undefined);
    assert.deepEqual(w?.outfit, { 'head-top': 'beanie', 'head-side': 'bow' });
    assert.equal(target.settings.catName, '阿福');
    assert.equal(target.progress.size, 1);

    parsed.settings.wardrobe.cats = 'broken';
    parsed.settings.wardrobe.outing = 'cat-1';
    const again = createWorld();
    assert.deepEqual(importProgress(again, JSON.stringify(parsed)), { ok: true });
    assert.equal(again.settings.wardrobe?.cats, undefined);
    assert.equal(again.settings.wardrobe?.outing, undefined);
    assert.ok(again.settings.wardrobe?.owned.includes('adopt-cat-2'));
  });

  it('an older save without any house field still loads with only the first cat', () => {
    const { world } = loadSave(golden('save-v6-wardrobe-scorch.json'));
    const w = world.settings.wardrobe;
    assert.equal(w?.cats, undefined);
    assert.equal(w?.outfitAt, undefined);
    assert.equal(w?.outing, undefined);
    assert.equal(w?.leader, undefined);
  });
});
