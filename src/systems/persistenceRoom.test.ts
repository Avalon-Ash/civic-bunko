// 小屋擺設的存檔格式（save-v8-room.json）與規則：買了的背景預設都擺、收起來的記在 roomHidden、只存本機。
// 規則在 docs/plans/back-specials.md §3。樣本與本檔的斷言不准為了讓測試通過而修改。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY } from '../core/constants/round';
import { createWorld, type World } from '../core/world';
import { attachPersistence, exportProgress, importProgress, type StorageLike } from './persistence';
import { roomDecor, setRoomDecor } from './house';

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

describe('persistence: room decor (save-v8-room.json)', () => {
  it('room golden sample is unchanged', () => {
    const hash = createHash('sha256').update(golden('save-v8-room.json').replace(/\r\n/g, '\n')).digest('hex');
    assert.equal(hash, '43685ad34157b74b8378e3e8aa9eed0cc1c405e4867604375cd8073db4309bf1');
  });

  it('reads roomHidden (keeping IDs this version does not know) and writes the save back equivalent', () => {
    const raw = golden('save-v8-room.json');
    const { world, storage } = loadSave(raw);
    assert.deepEqual(world.settings.wardrobe?.roomHidden, ['cushion', 'bg-future-v9']);
    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY] ?? 'null'), JSON.parse(raw));

    const other = createWorld();
    assert.deepEqual(importProgress(other, exportProgress(world)), { ok: true });
    assert.deepEqual(other.settings.wardrobe, world.settings.wardrobe);
  });

  it('bought backgrounds are placed by default; hidden ones are off; unknown IDs are ignored', () => {
    const { world } = loadSave(golden('save-v8-room.json'));
    assert.deepEqual(roomDecor(world), [
      { id: 'cushion', name: '坐墊', on: false },
      { id: 'moon', name: '月亮', on: true },
    ]);
  });

  it('an older save without roomHidden places every bought background', () => {
    const { world } = loadSave(golden('save-v7-house.json'));
    assert.equal(world.settings.wardrobe?.roomHidden, undefined);
    const parsed = JSON.parse(golden('save-v7-house.json')) as { settings: { wardrobe: { owned: string[] } } };
    parsed.settings.wardrobe.owned.push('book-stack');
    const target = createWorld();
    assert.deepEqual(importProgress(target, JSON.stringify(parsed)), { ok: true });
    assert.deepEqual(roomDecor(target), [{ id: 'book-stack', name: '書堆', on: true }]);
  });

  it('broken roomHidden is dropped without breaking the rest', () => {
    const parsed = JSON.parse(golden('save-v8-room.json')) as { settings: { wardrobe: Record<string, unknown> } };
    parsed.settings.wardrobe.roomHidden = 'cushion';
    const target = createWorld();
    assert.deepEqual(importProgress(target, JSON.stringify(parsed)), { ok: true });
    assert.equal(target.settings.wardrobe?.roomHidden, undefined);
    assert.ok(target.settings.wardrobe?.owned.includes('moon'));
  });

  it('setRoomDecor hides and places only bought backgrounds', () => {
    const { world } = loadSave(golden('save-v8-room.json'));
    assert.equal(setRoomDecor(world, 'moon', false), true);
    assert.equal(setRoomDecor(world, 'moon', false), false);
    assert.equal(setRoomDecor(world, 'cushion', true), true);
    assert.equal(setRoomDecor(world, 'rainbow', true), false, 'not bought');
    assert.equal(setRoomDecor(world, 'beanie', false), false, 'not a background');
    assert.deepEqual(world.settings.wardrobe?.roomHidden, ['bg-future-v9', 'moon']);
    assert.deepEqual(
      roomDecor(world).map((d) => [d.id, d.on]),
      [
        ['cushion', true],
        ['moon', false],
      ],
    );
  });
});
