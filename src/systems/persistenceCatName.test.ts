// 小貓的名字（settings.catName，2026-11-18 新增的選填欄位）：新樣本 save-v3-cat-name.json。
// 舊樣本與 persistenceGolden.test.ts 不動；這裡另外確認舊存檔照樣讀、新欄位不進同步檔。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dispatch } from '../core/commands';
import { CAT_NAME_MAX } from '../core/constants/cat';
import { STORAGE_KEY } from '../core/constants/round';
import { SYNC_STORAGE_KEY } from '../core/constants/sync';
import { createWorld, type World } from '../core/world';
import { catDisplayName, catName } from '../selectors/cat';
import { attachPersistence, exportProgress, importProgress } from './persistence';
import { attachSync, waitForSync, type SyncStorageLike } from './sync';

function golden(name: string): string {
  return readFileSync(new URL(`../testing/golden/${name}`, import.meta.url), 'utf8');
}

function memoryStorage(initial: Record<string, string> = {}): SyncStorageLike & { data: Record<string, string>; writes: number } {
  const data: Record<string, string> = { ...initial };
  const store = {
    data,
    writes: 0,
    getItem: (key: string) => (key in data ? (data[key] ?? null) : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
      store.writes += 1;
    },
    removeItem: (key: string) => {
      delete data[key];
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

const saved = (storage: ReturnType<typeof memoryStorage>): { settings?: Record<string, unknown> } =>
  JSON.parse(storage.data[STORAGE_KEY] ?? '{}') as { settings?: Record<string, unknown> };

describe('persistence: cat name', () => {
  it('reads a save that has a name and writes it back unchanged', () => {
    const raw = golden('save-v3-cat-name.json');
    const { world, storage } = loadSave(raw);
    assert.equal(world.settings.catName, '阿福');
    assert.equal(catName(world), '阿福');
    assert.equal(catDisplayName(world), '阿福');
    // 其他欄位照舊
    assert.deepEqual(world.settings.wardrobe?.owned, ['beanie', 'future-item-v9']);

    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY] ?? 'null'), JSON.parse(raw));
  });

  it('older saves load as before: no name, and no name field appears when they are written back', () => {
    for (const name of ['save-v1.json', 'save-v1-legacy.json', 'save-v2-wardrobe.json']) {
      const { world, storage } = loadSave(golden(name));
      assert.equal(world.settings.catName, undefined, name);
      assert.equal(catName(world), null, name);
      world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
      assert.ok(!('catName' in (saved(storage).settings ?? {})), name);
    }
  });

  it('a broken name drops only that field, not the save', () => {
    for (const bad of [42, '', '   ', null, { text: '阿福' }, ['阿福']]) {
      const payload = JSON.parse(golden('save-v3-cat-name.json')) as { settings: Record<string, unknown> };
      payload.settings.catName = bad;
      const { world } = loadSave(JSON.stringify(payload));
      assert.equal(world.settings.catName, undefined, JSON.stringify(bad));
      assert.equal(world.settings.accessory, 'bow');
      assert.equal(world.progress.size, 1);
      assert.deepEqual(world.settings.wardrobe?.achievements, ['exam-1', 'exam-60', 'future-ach-v9']);
    }
  });

  it('an over-long or padded name in a save is cleaned on load', () => {
    const payload = JSON.parse(golden('save-v3-cat-name.json')) as { settings: Record<string, unknown> };
    payload.settings.catName = `  ${'喵'.repeat(CAT_NAME_MAX + 4)}\n`;
    const { world } = loadSave(JSON.stringify(payload));
    assert.equal(world.settings.catName, '喵'.repeat(CAT_NAME_MAX));
  });

  it('setCatName saves a cleaned name, clears it with an empty one, and does nothing when unchanged', () => {
    const { world, storage } = loadSave(golden('save-v2-wardrobe.json'));
    dispatch(world, { type: 'setCatName', name: '  麻糬 ' });
    assert.equal(world.settings.catName, '麻糬');
    assert.equal(saved(storage).settings?.catName, '麻糬');
    const writes = storage.writes;

    dispatch(world, { type: 'setCatName', name: '麻糬' });
    assert.equal(storage.writes, writes);

    dispatch(world, { type: 'setCatName', name: '   ' });
    assert.equal(world.settings.catName, undefined);
    assert.ok(!('catName' in (saved(storage).settings ?? {})));
    // 取名、清掉名字都不動其他設定
    assert.equal(world.settings.accessory, 'bow');
    assert.deepEqual(world.settings.wardrobe?.outfit, { 'head-top': 'beanie', 'head-side': 'bow' });
  });

  it('export → import on another device keeps the name', () => {
    const { world } = loadSave(golden('save-v3-cat-name.json'));
    const other = createWorld();
    attachPersistence(other, memoryStorage());
    const result = importProgress(other, exportProgress(world));
    assert.equal(result.ok, true);
    assert.equal(other.settings.catName, '阿福');
  });

  it('the name stays on this device: it is not written to the sync file', async () => {
    const { world } = loadSave(golden('save-v3-cat-name.json'));
    const storage = memoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify({ owner: 'family', repo: 'civic-sync', token: 'test-token-not-real' }),
    });
    const puts: string[] = [];
    const fakeFetch: typeof fetch = async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response('{}', { status: 404 });
      puts.push(String(init?.body));
      return new Response('{}', { status: 200 });
    };
    attachSync(world, { fetch: fakeFetch, storage, now: () => new Date('2026-11-18T04:00:00.000Z') });
    await waitForSync(world);

    assert.equal(puts.length, 1);
    const body = JSON.parse(puts[0] ?? '{}') as { content: string };
    const text = Buffer.from(body.content, 'base64').toString('utf8');
    assert.ok(!text.includes('阿福') && !text.includes('catName'), text);
    // 同步完本機的名字還在
    assert.equal(world.settings.catName, '阿福');
  });
});
