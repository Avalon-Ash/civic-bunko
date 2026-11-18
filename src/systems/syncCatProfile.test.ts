// 小貓的個人設定（名字＋改動時間）跨裝置同步：同步檔選填的 cat 欄，兩邊比改動時間，較新的整包留下。
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dispatch } from '../core/commands';
import { SYNC_STORAGE_KEY } from '../core/constants/sync';
import type { CatProfile } from '../core/types';
import { createWorld, type World } from '../core/world';
import { catName } from '../selectors/cat';
import { attachSync, syncNow, waitForSync, type SyncStorageLike } from './sync';
import { mergeCatProfile, sameCatProfile } from './syncMerge';

const CREDENTIALS = JSON.stringify({ owner: 'family', repo: 'civic-sync', token: 'test-token-not-real' });

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
function fakeRemote(initial?: Record<string, unknown>) {
  const remote = {
    text: initial ? JSON.stringify(initial) : (null as string | null),
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

/** 一台裝置：有自己的 world，接到同一個假雲端 */
async function device(remote: ReturnType<typeof fakeRemote>, settings: Partial<World['settings']> = {}): Promise<World> {
  const world = createWorld();
  world.settings = { ...world.settings, ...settings };
  attachSync(world, {
    fetch: remote.fetch,
    storage: memoryStorage({ [SYNC_STORAGE_KEY]: CREDENTIALS }),
    now: () => new Date('2026-11-18T12:00:00.000Z'),
  });
  await waitForSync(world);
  return world;
}

async function sync(world: World): Promise<void> {
  syncNow(world);
  await waitForSync(world);
  assert.equal(world.sync.status, 'idle', world.sync.error ?? '');
}

const rename = (world: World, name: string, iso: string) =>
  dispatch(world, { type: 'setCatName', name }, { now: () => new Date(iso) });

describe('merging the cat profile', () => {
  const profiles: Array<CatProfile | null> = [
    null,
    { name: '阿福', at: '' },
    { name: '麻糬', at: '' },
    { name: null, at: '2026-11-18T03:00:00.000Z' },
    { name: '阿福', at: '2026-11-18T03:00:00.000Z' },
    { name: '麻糬', at: '2026-11-18T05:00:00.000Z' },
    { name: null, at: '2026-11-18T09:00:00.000Z' },
  ];

  it('gives the same answer whichever device goes first, and is stable when repeated', () => {
    for (const a of profiles) {
      for (const b of profiles) {
        const ab = mergeCatProfile(a, b);
        assert.ok(sameCatProfile(ab, mergeCatProfile(b, a)), JSON.stringify([a, b]));
        assert.ok(sameCatProfile(ab, mergeCatProfile(ab, a)) && sameCatProfile(ab, mergeCatProfile(ab, b)));
        for (const c of profiles) {
          assert.ok(
            sameCatProfile(mergeCatProfile(ab, c), mergeCatProfile(a, mergeCatProfile(b, c))),
            JSON.stringify([a, b, c]),
          );
        }
      }
    }
  });

  it('keeps the one changed later; a known time beats an unknown one; a name beats no name on a tie', () => {
    const older: CatProfile = { name: '阿福', at: '2026-11-18T03:00:00.000Z' };
    const newer: CatProfile = { name: '麻糬', at: '2026-11-18T05:00:00.000Z' };
    assert.equal(mergeCatProfile(older, newer), newer);
    assert.equal(mergeCatProfile(older, { name: '舊名字', at: '' }), older);
    assert.deepEqual(mergeCatProfile({ name: null, at: '' }, { name: '阿福', at: '' }), { name: '阿福', at: '' });
    // 後來清掉名字，贏過先前取的名字
    const cleared: CatProfile = { name: null, at: '2026-11-18T09:00:00.000Z' };
    assert.equal(mergeCatProfile(newer, cleared), cleared);
    assert.equal(mergeCatProfile(null, older), older);
    assert.equal(mergeCatProfile(null, null), null);
  });
});

describe('syncing the cat profile between devices', () => {
  it('a name given on one device shows up on the other after both sync', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    const tablet = await device(remote);

    rename(phone, '阿福', '2026-11-18T05:00:00.000Z');
    await sync(phone);
    assert.deepEqual(remote.json().cat, { name: '阿福', at: '2026-11-18T05:00:00.000Z' });

    await sync(tablet);
    assert.equal(catName(tablet), '阿福');
    assert.equal(tablet.settings.catNameAt, '2026-11-18T05:00:00.000Z');
  });

  it('the later change wins on both devices, whichever syncs first', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    const tablet = await device(remote);
    rename(phone, '阿福', '2026-11-18T05:00:00.000Z');
    rename(tablet, '麻糬', '2026-11-18T06:00:00.000Z');

    // 較新的那台先同步，較舊的那台後同步：後同步的不能蓋掉較新的名字
    await sync(tablet);
    await sync(phone);
    assert.equal(catName(phone), '麻糬');
    assert.deepEqual(remote.json().cat, { name: '麻糬', at: '2026-11-18T06:00:00.000Z' });
    await sync(tablet);
    assert.equal(catName(tablet), '麻糬');
  });

  it('clearing the name later also travels: the other device goes back to the default name', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    const tablet = await device(remote);
    rename(phone, '阿福', '2026-11-18T05:00:00.000Z');
    await sync(phone);
    await sync(tablet);
    assert.equal(catName(tablet), '阿福');

    rename(tablet, '', '2026-11-18T07:00:00.000Z');
    await sync(tablet);
    await sync(phone);
    assert.equal(catName(phone), null);
    assert.equal(phone.settings.catName, undefined);
    assert.equal(phone.settings.catNameAt, '2026-11-18T07:00:00.000Z');
  });

  it('a name from before change times existed is uploaded and reaches a device that has none', async () => {
    const remote = fakeRemote();
    const phone = await device(remote, { catName: '阿福' });
    assert.deepEqual(remote.json().cat, { name: '阿福', at: '' });
    const tablet = await device(remote);
    assert.equal(catName(tablet), '阿福');
    // 之後任何一台改名（有時間）都贏過這個沒有時間的舊名字
    rename(tablet, '麻糬', '2026-11-18T06:00:00.000Z');
    await sync(tablet);
    await sync(phone);
    assert.equal(catName(phone), '麻糬');
  });

  it('a device on an older version that rewrites the file without the profile does not erase the name', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    rename(phone, '阿福', '2026-11-18T05:00:00.000Z');
    await sync(phone);

    // 舊版 App 不認得 cat 欄，寫回時把它丟掉
    const { cat: _dropped, ...withoutCat } = remote.json();
    remote.text = JSON.stringify(withoutCat);

    await sync(phone);
    assert.equal(catName(phone), '阿福');
    assert.deepEqual(remote.json().cat, { name: '阿福', at: '2026-11-18T05:00:00.000Z' });
  });

  it('a broken profile in the sync file is ignored and the rest of the sync still works', async () => {
    for (const bad of [42, 'name', [], { name: 7, at: '2026-11-18T05:00:00.000Z' }, { at: 'x' }]) {
      const remote = fakeRemote({ version: 1, progress: {}, days: { '2026-11-17': 9 }, cat: bad });
      const phone = await device(remote, { catName: '阿福', catNameAt: '2026-11-18T05:00:00.000Z' });
      assert.equal(phone.sync.status, 'idle', JSON.stringify(bad));
      assert.equal(catName(phone), '阿福');
      assert.equal(phone.dayLog.get('2026-11-17'), 9);
      assert.deepEqual(remote.json().cat, { name: '阿福', at: '2026-11-18T05:00:00.000Z' });
    }
  });

  it('nothing about the cat is written for someone who never named it, and no extra upload happens', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    assert.equal(remote.puts, 1);
    assert.ok(!('cat' in remote.json()));
    await sync(phone);
    assert.equal(remote.puts, 1);
  });

  it('when both sides already agree, syncing again uploads nothing', async () => {
    const remote = fakeRemote();
    const phone = await device(remote);
    rename(phone, '阿福', '2026-11-18T05:00:00.000Z');
    await sync(phone);
    const puts = remote.puts;
    await sync(phone);
    assert.equal(remote.puts, puts);
  });
});
