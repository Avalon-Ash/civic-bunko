// 配對完成的卡片（settings.cardsMatched，ADR 0023）：只增不減、存檔讀寫、同步取聯集。
// 樣本 save-v9-matched.json 與本檔的斷言不准為了讓測試通過而修改。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dispatch } from '../core/commands';
import { STORAGE_KEY } from '../core/constants/round';
import { SYNC_FILE_VERSION, SYNC_STORAGE_KEY } from '../core/constants/sync';
import type { AppEvent, SyncCredentials } from '../core/types';
import { createWorld, type World } from '../core/world';
import { attachPersistence, exportProgress, importProgress, type StorageLike } from './persistence';
import { attachSync, waitForSync, type SyncStorageLike } from './sync';

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

const TEST_CRED: SyncCredentials = { owner: 'family', repo: 'civic-sync', token: 'secret_pat_token_987654' };

function syncStorage(): SyncStorageLike {
  const data: Record<string, string> = { [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED) };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function remoteBody(payload: Record<string, unknown>): Response {
  const json = JSON.stringify({ version: SYNC_FILE_VERSION, updatedAt: '2026-11-27T00:00:00.000Z', progress: {}, ...payload });
  return new Response(JSON.stringify({ sha: 'sha-1', content: Buffer.from(json, 'utf8').toString('base64') }), {
    status: 200,
  });
}

function decodePut(body: string): Record<string, unknown> {
  const parsed = JSON.parse(body) as { content: string };
  return JSON.parse(Buffer.from(parsed.content, 'base64').toString('utf8')) as Record<string, unknown>;
}

async function syncOnce(world: World, remote: Record<string, unknown>): Promise<string[]> {
  const puts: string[] = [];
  const fakeFetch: typeof fetch = async (_input, init) => {
    if ((init?.method ?? 'GET') === 'GET') return remoteBody(remote);
    puts.push(String(init?.body));
    return new Response('{}', { status: 200 });
  };
  attachSync(world, { fetch: fakeFetch, storage: syncStorage(), now: () => new Date('2026-11-27T10:00:00.000Z') });
  await waitForSync(world);
  return puts;
}

describe('cardsMatched: command', () => {
  it('markCardMatched adds the card once, and counts it as seen', () => {
    const world = createWorld();
    const events: AppEvent[] = [];
    world.bus.on('cardSeen', (event) => events.push(event));
    dispatch(world, { type: 'markCardMatched', id: 'c1' });
    dispatch(world, { type: 'markCardMatched', id: 'c1' });
    assert.deepEqual(world.settings.cardsMatched, ['c1']);
    assert.deepEqual(world.settings.cardsSeen, ['c1']);
    assert.equal(events.length, 1);
  });
});

describe('cardsMatched: save file (save-v9-matched.json)', () => {
  it('golden sample is unchanged', () => {
    const hash = createHash('sha256').update(golden('save-v9-matched.json').replace(/\r\n/g, '\n')).digest('hex');
    assert.equal(hash, '5907ff93fb58ffaff65463a34f928d48bc2445d894d939798485255c454816a2');
  });

  it('reads cardsMatched (keeping IDs this version does not know) and writes the save back equivalent', () => {
    const raw = golden('save-v9-matched.json');
    const { world, storage } = loadSave(raw);
    assert.deepEqual(world.settings.cardsMatched, ['concept-admin-act', 'future-card-v10']);
    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY] ?? 'null'), JSON.parse(raw));

    const other = createWorld();
    assert.deepEqual(importProgress(other, exportProgress(world)), { ok: true });
    assert.deepEqual(other.settings.cardsMatched, world.settings.cardsMatched);
  });

  it('an older save has no cardsMatched; a broken one is dropped without breaking the rest', () => {
    assert.equal(loadSave(golden('save-v8-room.json')).world.settings.cardsMatched, undefined);
    const parsed = JSON.parse(golden('save-v9-matched.json')) as { settings: Record<string, unknown> };
    parsed.settings.cardsMatched = 'concept-admin-act';
    const target = createWorld();
    assert.deepEqual(importProgress(target, JSON.stringify(parsed)), { ok: true });
    assert.equal(target.settings.cardsMatched, undefined);
    assert.deepEqual(target.settings.cardsSeen, ['concept-law-rank', 'newlaw-lga-55-city']);
  });
});

describe('cardsMatched: sync', () => {
  it('pulls remote-only cards and pushes the union', async () => {
    const world = createWorld();
    world.settings = { ...world.settings, cardsMatched: ['a'] };
    const puts = await syncOnce(world, { cardsMatched: ['b'] });
    assert.deepEqual(world.settings.cardsMatched, ['a', 'b']);
    assert.equal(puts.length, 1);
    assert.deepEqual(decodePut(puts[0] ?? '').cardsMatched, ['a', 'b']);
  });

  it('the merge is order-free: either side first gives the same set', async () => {
    const one = createWorld();
    one.settings = { ...one.settings, cardsMatched: ['x', 'y'] };
    await syncOnce(one, { cardsMatched: ['z', 'x'] });
    const two = createWorld();
    two.settings = { ...two.settings, cardsMatched: ['z', 'x'] };
    await syncOnce(two, { cardsMatched: ['x', 'y'] });
    assert.deepEqual([...(one.settings.cardsMatched ?? [])].sort(), [...(two.settings.cardsMatched ?? [])].sort());
  });

  it('a legacy sync file without the field changes nothing and is not rewritten; a malformed one is ignored', async () => {
    const world = createWorld();
    assert.deepEqual(await syncOnce(world, {}), []);
    assert.equal(world.settings.cardsMatched, undefined);

    const mine = createWorld();
    mine.settings = { ...mine.settings, cardsMatched: ['a'] };
    const puts = await syncOnce(mine, { cardsMatched: 'oops' });
    assert.equal(mine.sync.status, 'idle');
    assert.deepEqual(mine.settings.cardsMatched, ['a']);
    assert.deepEqual(decodePut(puts[0] ?? '').cardsMatched, ['a']);
  });
});
