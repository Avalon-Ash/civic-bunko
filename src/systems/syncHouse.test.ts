// 小貓之家的跨裝置同步：領養跟著 owned（聯集）；新貓的名字是同步檔選填的 cats（逐隻 mergeCatProfile）；
// 每隻的長相（含原本那隻）是選填的 looks（逐隻 mergeCatLook，比改動時間）。帶出門、陪我刷題不同步。
// 規則在 docs/plans/cat-house.md §3、docs/adr/0018。本檔與樣本的斷言不准為了讓測試通過而修改。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dispatch } from '../core/commands';
import { HOUSE_FIRST_CAT } from '../core/constants/house';
import { SYNC_STORAGE_KEY } from '../core/constants/sync';
import type { CatLook, UICommand } from '../core/types';
import { createWorld, type World } from '../core/world';
import { catOutfit, houseCats } from '../selectors/house';
import { attachSync, syncNow, waitForSync, type SyncStorageLike } from './sync';
import { mergeCatLook } from './syncMerge';

const CREDENTIALS = JSON.stringify({ owner: 'family', repo: 'civic-sync', token: 'test-token-not-real' });

function golden(name: string): string {
  return readFileSync(new URL(`../testing/golden/${name}`, import.meta.url), 'utf8');
}

function memoryStorage(initial: Record<string, string> = {}): SyncStorageLike {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key) => (key in data ? (data[key] ?? null) : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

/** 假的雲端：一個檔案。GET 回目前內容（沒有就是 404），PUT 存下來 */
function fakeRemote(initialText?: string) {
  const remote = {
    text: initialText ?? (null as string | null),
    puts: 0,
    json(): Record<string, unknown> {
      return JSON.parse(remote.text ?? '{}') as Record<string, unknown>;
    },
    fetch: (async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') {
        if (remote.text === null) return new Response('{}', { status: 404 });
        return new Response(
          JSON.stringify({ sha: `sha-${remote.puts}`, content: Buffer.from(remote.text, 'utf8').toString('base64') }),
          { status: 200 },
        );
      }
      const body = JSON.parse(String(init?.body)) as { content: string };
      remote.text = Buffer.from(body.content, 'base64').toString('utf8');
      remote.puts += 1;
      return new Response('{}', { status: 200 });
    }) as typeof fetch,
  };
  return remote;
}

async function device(remote: ReturnType<typeof fakeRemote>, setup?: (world: World) => void): Promise<World> {
  const world = createWorld();
  world.settings.wardrobe = { owned: ['beanie', 'fur-orange', 'scarf'], achievements: [], quests: {} };
  setup?.(world);
  attachSync(world, {
    fetch: remote.fetch,
    storage: memoryStorage({ [SYNC_STORAGE_KEY]: CREDENTIALS }),
    now: () => new Date('2026-11-22T12:00:00.000Z'),
  });
  await waitForSync(world);
  return world;
}

async function sync(world: World): Promise<void> {
  syncNow(world);
  await waitForSync(world);
  assert.equal(world.sync.status, 'idle', world.sync.error ?? '');
}

const run = (world: World, cmd: UICommand, iso: string) => dispatch(world, cmd, { now: () => new Date(iso) });
const nameOf = (world: World, cat: string) => houseCats(world).find((c) => c.id === cat)?.named ?? null;

function sameLook(a: CatLook | null, b: CatLook | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe('merging a cat look', () => {
  const looks: Array<CatLook | null> = [
    null,
    { outfit: { fur: 'fur-orange' }, at: '' },
    { outfit: { 'head-top': 'beanie' }, at: '' },
    { outfit: {}, at: '2026-11-22T03:00:00.000Z' },
    { outfit: { fur: 'fur-orange' }, at: '2026-11-22T03:00:00.000Z' },
    { outfit: { 'head-top': 'beanie', fur: 'fur-orange' }, at: '2026-11-22T03:00:00.000Z' },
    { outfit: { fur: 'fur-orange', 'head-top': 'beanie' }, at: '2026-11-22T05:00:00.000Z' },
  ];

  it('gives the same answer whichever device goes first, and is stable when repeated', () => {
    for (const a of looks) {
      for (const b of looks) {
        const ab = mergeCatLook(a, b);
        assert.ok(sameLook(ab, mergeCatLook(b, a)), JSON.stringify([a, b]));
        assert.ok(sameLook(ab, mergeCatLook(ab, a)) && sameLook(ab, mergeCatLook(ab, b)));
        for (const c of looks) {
          assert.ok(sameLook(mergeCatLook(ab, c), mergeCatLook(a, mergeCatLook(b, c))), JSON.stringify([a, b, c]));
        }
      }
    }
  });

  it('keeps the look changed later; taking everything off later also wins', () => {
    const older: CatLook = { outfit: { fur: 'fur-orange' }, at: '2026-11-22T03:00:00.000Z' };
    const bare: CatLook = { outfit: {}, at: '2026-11-22T04:00:00.000Z' };
    assert.equal(mergeCatLook(older, bare), bare);
    assert.equal(mergeCatLook(null, older), older);
    assert.equal(mergeCatLook(null, null), null);
  });
});

describe('syncing the cat house between devices', () => {
  it('a cat adopted, named and dressed on one device moves in on the other', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    const tablet = await device(remote);

    run(phone, { type: 'adoptCat', name: '麻糬', fur: 'fur-orange' }, '2026-11-22T01:00:00.000Z');
    run(phone, { type: 'wear', slot: 'head-top', item: 'beanie', cat: 'cat-2' }, '2026-11-22T01:01:00.000Z');
    await sync(phone);
    const json = remote.json() as { cats?: Record<string, unknown>; looks?: Record<string, unknown> };
    assert.deepEqual(json.cats, { 'cat-2': { name: '麻糬', at: '2026-11-22T01:00:00.000Z' } });
    assert.deepEqual(json.looks, {
      'cat-2': { outfit: { fur: 'fur-orange', 'head-top': 'beanie' }, at: '2026-11-22T01:01:00.000Z' },
    });
    assert.equal('outing' in json || 'leader' in json, false);

    await sync(tablet);
    assert.deepEqual(houseCats(tablet).map((c) => c.id), [HOUSE_FIRST_CAT, 'cat-2']);
    assert.equal(nameOf(tablet, 'cat-2'), '麻糬');
    assert.deepEqual(catOutfit(tablet, 'cat-2'), { fur: 'fur-orange', 'head-top': 'beanie' });
  });

  it('the later change wins per cat and per kind, whichever device syncs first', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    run(phone, { type: 'adoptCat' }, '2026-11-22T01:00:00.000Z');
    await sync(phone);
    const tablet = await device(remote);

    // 手機較晚改名、平板較晚換裝：各自留下較晚的那一項
    run(tablet, { type: 'setCatName', name: '湯圓', cat: 'cat-2' }, '2026-11-22T02:00:00.000Z');
    run(phone, { type: 'setCatName', name: '麻糬', cat: 'cat-2' }, '2026-11-22T03:00:00.000Z');
    run(phone, { type: 'wear', slot: 'neck', item: 'scarf', cat: 'cat-2' }, '2026-11-22T02:00:00.000Z');
    run(tablet, { type: 'wear', slot: 'fur', item: 'fur-orange', cat: 'cat-2' }, '2026-11-22T03:00:00.000Z');

    await sync(phone);
    await sync(tablet);
    await sync(phone);
    for (const world of [phone, tablet]) {
      assert.equal(nameOf(world, 'cat-2'), '麻糬');
      assert.deepEqual(catOutfit(world, 'cat-2'), { fur: 'fur-orange' });
    }
  });

  it('the first cat look travels once it has a change time; a look without one stays on its device', async () => {
    const remote = fakeRemote();
    const phone = await device(remote, (w) => {
      w.settings.wardrobe = { ...w.settings.wardrobe!, outfit: { neck: 'scarf' } };
    });
    const tablet = await device(remote, (w) => {
      w.settings.wardrobe = { ...w.settings.wardrobe!, outfit: { 'head-top': 'beanie' } };
    });
    await sync(phone);
    // 兩台都是加改動時間之前換的：不上傳、不互蓋
    assert.equal((remote.json() as { looks?: Record<string, unknown> }).looks?.[HOUSE_FIRST_CAT], undefined);
    assert.deepEqual(catOutfit(phone, HOUSE_FIRST_CAT), { neck: 'scarf' });
    assert.deepEqual(catOutfit(tablet, HOUSE_FIRST_CAT), { 'head-top': 'beanie' });

    run(phone, { type: 'wear', slot: 'fur', item: 'fur-orange' }, '2026-11-22T04:00:00.000Z');
    await sync(phone);
    await sync(tablet);
    assert.deepEqual(catOutfit(tablet, HOUSE_FIRST_CAT), { neck: 'scarf', fur: 'fur-orange' });
    assert.deepEqual(tablet.settings.wardrobe?.outfit, { neck: 'scarf', fur: 'fur-orange' });
    assert.equal(tablet.settings.wardrobe?.outfitAt, '2026-11-22T04:00:00.000Z');
  });

  it('two devices adopting offline end up with the same cat, not two', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    const tablet = await device(remote);
    run(phone, { type: 'adoptCat', name: '麻糬' }, '2026-11-22T01:00:00.000Z');
    run(tablet, { type: 'adoptCat', name: '湯圓' }, '2026-11-22T02:00:00.000Z');
    await sync(phone);
    await sync(tablet);
    await sync(phone);
    for (const world of [phone, tablet]) {
      assert.deepEqual(houseCats(world).map((c) => c.id), [HOUSE_FIRST_CAT, 'cat-2']);
      assert.equal(nameOf(world, 'cat-2'), '湯圓');
    }
  });

  it('reads the golden house sync file and keeps a cat it does not know when writing back', async () => {
    const remote = fakeRemote(golden('sync-v1-house.json'));
    const phone = await device(remote);
    assert.deepEqual(houseCats(phone).map((c) => c.id), [HOUSE_FIRST_CAT, 'cat-2']);
    assert.equal(nameOf(phone, 'cat-2'), '麻糬');
    assert.deepEqual(catOutfit(phone, HOUSE_FIRST_CAT), { fur: 'fur-orange' });
    assert.deepEqual(catOutfit(phone, 'cat-2'), { fur: 'fur-orange', 'head-top': 'beanie' });

    run(phone, { type: 'setCatName', name: '湯圓', cat: 'cat-2' }, '2026-11-22T06:00:00.000Z');
    await sync(phone);
    const json = remote.json() as {
      cats?: Record<string, unknown>;
      looks?: Record<string, unknown>;
      wardrobe?: { owned?: string[] };
    };
    assert.deepEqual(json.cats?.['cat-9'], { name: '未來貓', at: '2026-12-20T00:00:00.000Z' });
    assert.deepEqual(json.looks?.['cat-9'], { outfit: { fur: 'fur-future-v9' }, at: '2026-12-20T00:00:00.000Z' });
    assert.ok(json.wardrobe?.owned?.includes('adopt-cat-9'));
    assert.deepEqual(json.cats?.['cat-2'], { name: '湯圓', at: '2026-11-22T06:00:00.000Z' });
  });

  it('an older sync file without the house does not take any cat away', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    run(phone, { type: 'adoptCat', name: '麻糬', fur: 'fur-orange' }, '2026-11-22T01:00:00.000Z');
    // 舊版那台把同步檔寫回去，沒有 cats、looks
    remote.text = golden('sync-v1.json');
    await sync(phone);
    assert.deepEqual(houseCats(phone).map((c) => c.id), [HOUSE_FIRST_CAT, 'cat-2']);
    assert.equal(nameOf(phone, 'cat-2'), '麻糬');
    assert.deepEqual(catOutfit(phone, 'cat-2'), { fur: 'fur-orange' });
    // 寫回去時補上
    const json = remote.json() as { cats?: Record<string, unknown>; wardrobe?: { owned?: string[] } };
    assert.deepEqual(json.cats?.['cat-2'], { name: '麻糬', at: '2026-11-22T01:00:00.000Z' });
    assert.ok(json.wardrobe?.owned?.includes('adopt-cat-2'));
  });
});
