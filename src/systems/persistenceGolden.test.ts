// 守門測試：使用者裝置上已經存在的資料，任何改版都必須照樣讀得回來。
//
// src/testing/golden/*.json 是「已經出貨的格式」的固定樣本，代表真實使用者手上的存檔與同步檔。
// 這些樣本與本檔的斷言不准為了讓測試通過而修改：
// - 新功能要存新東西：只能往上加「選填」欄位，舊樣本要照樣能讀。
// - 真的需要改格式：先寫遷移（舊格式讀進來自動轉成新格式），再「新增」一份新樣本，舊樣本留著。
// 樣本檔的雜湊寫死在下面，被改動就會失敗。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY } from '../core/constants/round';
import {
  SYNC_FILE_VERSION,
  SYNC_REMOTE_PATH,
  SYNC_STORAGE_KEY,
  SYNC_VISIBILITY_MIN_INTERVAL_MS,
} from '../core/constants/sync';
import { createWorld, type World } from '../core/world';
import { attachPersistence, exportProgress, importProgress } from './persistence';
import { attachSync, syncOnVisibilityChange, waitForSync, type SyncStorageLike } from './sync';

function golden(name: string): string {
  return readFileSync(new URL(`../testing/golden/${name}`, import.meta.url), 'utf8');
}

/** 與行尾無關的雜湊（Windows 檢出可能是 CRLF） */
function goldenHash(name: string): string {
  return createHash('sha256').update(golden(name).replace(/\r\n/g, '\n')).digest('hex');
}

function memoryStorage(initial: Record<string, string> = {}): SyncStorageLike & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? (data[key] ?? null) : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function loadSave(name: string): { world: World; storage: ReturnType<typeof memoryStorage> } {
  const storage = memoryStorage({ [STORAGE_KEY]: golden(name) });
  const world = createWorld();
  attachPersistence(world, storage);
  return { world, storage };
}

const TEST_CREDENTIALS = { owner: 'family', repo: 'civic-sync', token: 'test-token-not-real' };

function remoteResponse(name: string): Response {
  return new Response(
    JSON.stringify({ sha: 'sha-golden', content: Buffer.from(golden(name), 'utf8').toString('base64') }),
    { status: 200 },
  );
}

describe('persistence golden: shipped formats must stay readable', () => {
  it('storage keys, remote path and file version are frozen', () => {
    assert.equal(STORAGE_KEY, 'civic-bunko/v1');
    assert.equal(SYNC_STORAGE_KEY, 'civic-bunko/sync');
    assert.equal(SYNC_REMOTE_PATH, 'progress.json');
    assert.equal(SYNC_FILE_VERSION, 1);
  });

  it('golden sample files are unchanged', () => {
    assert.deepEqual(
      {
        'save-v1.json': goldenHash('save-v1.json'),
        'save-v1-legacy.json': goldenHash('save-v1-legacy.json'),
        'sync-v1.json': goldenHash('sync-v1.json'),
        'sync-v1-legacy.json': goldenHash('sync-v1-legacy.json'),
      },
      GOLDEN_HASHES,
    );
  });

  it('restores every part of a current save: progress, days, settings, exam history, cards seen, unfinished exam round', () => {
    const { world } = loadSave('save-v1.json');

    assert.equal(world.progress.size, 3);
    assert.deepEqual(world.progress.get('115-general-admin-law-q08'), {
      seen: 3,
      correct: 2,
      views: 1,
      streak: 2,
      lastPick: 'B',
      lastAt: '2026-11-16T12:30:00.000Z',
      due: '2026-11-20',
    });
    assert.deepEqual(world.progress.get('114-local4-admin-law-q19'), {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'C',
      lastAt: '2026-11-17T01:05:00.000Z',
      due: '2026-11-18',
    });
    assert.deepEqual(world.progress.get('113-general-law-english-q41'), {
      seen: 0,
      correct: 0,
      views: 2,
      streak: 0,
      lastPick: null,
      lastAt: '2026-11-15T09:00:00.000Z',
      due: null,
    });

    assert.deepEqual(Object.fromEntries(world.dayLog), {
      '2026-11-15': 15,
      '2026-11-16': 22,
      '2026-11-17': 4,
    });

    assert.equal(world.settings.theme, 'light');
    assert.equal(world.settings.installHintDismissed, true);
    assert.equal(world.settings.accessory, 'bow');
    assert.equal(world.settings.shuffleOptions, true);
    assert.equal(world.settings.bilingual, false);
    assert.deepEqual(world.settings.cardsSeen, ['concept-law-rank', 'newlaw-lga-55-city']);
    assert.deepEqual(world.settings.examHistory, [
      {
        paperId: '115-general-admin-law',
        at: '2026-11-16T14:00:00.000Z',
        total: 50,
        answered: 48,
        correct: 31,
        score: 62,
      },
    ]);
    assert.deepEqual(world.settings.lastRound, {
      bankId: 'local4-civil',
      subjectKeys: ['admin-law', 'law-english'],
      count: 10,
      mode: 'mixed',
      fast: false,
      study: 'quiz',
      ask: 'positive',
      passes: 1,
    });

    const saved = world.savedRound;
    assert.ok(saved, 'unfinished round must be restorable');
    assert.deepEqual(saved.config.exam, { paperId: '114-general-admin-law', minutes: 60 });
    assert.deepEqual(saved.queue, [
      '114-general-admin-law-q01',
      '114-general-admin-law-q02',
      '114-general-admin-law-q03',
    ]);
    assert.equal(saved.index, 1);
    assert.equal(saved.startedAt, '2026-11-17T02:00:00.000Z');
    assert.deepEqual(saved.examPicks, { '114-general-admin-law-q01': 'D' });
  });

  it('survives a save → reload cycle without losing anything', () => {
    const { world, storage } = loadSave('save-v1.json');
    // 任何一次設定異動都會觸發寫回；寫回後用新的 world 再讀一次
    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });

    const reloaded = createWorld();
    attachPersistence(reloaded, memoryStorage({ [STORAGE_KEY]: storage.data[STORAGE_KEY] ?? '' }));

    assert.deepEqual(Object.fromEntries(reloaded.progress), Object.fromEntries(world.progress));
    assert.deepEqual(Object.fromEntries(reloaded.dayLog), Object.fromEntries(world.dayLog));
    assert.deepEqual(reloaded.settings, world.settings);
    assert.deepEqual(reloaded.savedRound, world.savedRound);
  });

  it('export → import on another device keeps progress, days and settings', () => {
    const { world } = loadSave('save-v1.json');
    const backup = exportProgress(world);

    const other = createWorld();
    assert.deepEqual(importProgress(other, backup), { ok: true });
    assert.deepEqual(Object.fromEntries(other.progress), Object.fromEntries(world.progress));
    assert.deepEqual(Object.fromEntries(other.dayLog), Object.fromEntries(world.dayLog));
    assert.deepEqual(other.settings.examHistory, world.settings.examHistory);
    assert.deepEqual(other.settings.cardsSeen, world.settings.cardsSeen);
  });

  it('reads a legacy save that predates views, days, study modes and the newer settings', () => {
    const { world } = loadSave('save-v1-legacy.json');

    assert.deepEqual(world.progress.get('115-general-admin-law-q08'), {
      seen: 2,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'A',
      lastAt: '2026-11-15T12:30:00.000Z',
      due: '2026-11-17',
    });
    assert.equal(world.settings.theme, 'system');
    assert.equal(world.settings.lastRound?.bankId, 'local4-civil');
    assert.equal(world.settings.lastRound?.mode, 'new');
    assert.equal(world.settings.lastRound?.fast, true);
    assert.equal(world.savedRound, null);
  });

  it('merges a current sync file into local data without dropping either side', async () => {
    const { world } = loadSave('save-v1.json');
    const storage = memoryStorage({ [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CREDENTIALS) });
    const puts: string[] = [];
    const fakeFetch: typeof fetch = async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') return remoteResponse('sync-v1.json');
      puts.push(String(init?.body));
      return new Response('{}', { status: 200 });
    };

    attachSync(world, { fetch: fakeFetch, storage, now: () => new Date('2026-11-17T04:00:00.000Z') });
    await waitForSync(world);

    assert.equal(world.sync.status, 'idle');
    // 兩邊都有的題目：取較晚作答的那一筆（遠端）
    assert.equal(world.progress.get('115-general-admin-law-q08')?.seen, 4);
    assert.equal(world.progress.get('115-general-admin-law-q08')?.due, '2026-11-24');
    // 只有遠端有的
    assert.equal(world.progress.get('115-general-public-admin-q21')?.correct, 1);
    // 只有本機有的
    assert.equal(world.progress.get('114-local4-admin-law-q19')?.lastPick, 'C');
    assert.equal(world.progress.get('113-general-law-english-q41')?.views, 2);
    // 每日題數取較大值
    assert.deepEqual(Object.fromEntries(world.dayLog), {
      '2026-11-15': 15,
      '2026-11-16': 30,
      '2026-11-17': 9,
    });
    // 卡片已看與模擬考成績取聯集
    assert.deepEqual(world.settings.cardsSeen, [
      'concept-law-rank',
      'newlaw-lga-55-city',
      'concept-admin-act',
    ]);
    assert.deepEqual(
      world.settings.examHistory?.map((r) => r.paperId),
      ['115-general-admin-law', '113-local4-local-gov'],
    );
    // 其他設定不受同步影響
    assert.equal(world.settings.accessory, 'bow');
    assert.equal(world.settings.theme, 'light');

    // 寫回遠端的內容仍是同一個版本，而且包含合併後的全部題目
    assert.equal(puts.length, 1);
    const body = JSON.parse(puts[0] ?? '{}') as { content: string };
    const payload = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) as {
      version: number;
      progress: Record<string, unknown>;
    };
    assert.equal(payload.version, 1);
    assert.equal(Object.keys(payload.progress).length, 4);
  });

  it('reads a legacy sync file that has only progress', async () => {
    const world = createWorld();
    const storage = memoryStorage({ [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CREDENTIALS) });
    const fakeFetch: typeof fetch = async (_input, init) =>
      (init?.method ?? 'GET') === 'GET'
        ? remoteResponse('sync-v1-legacy.json')
        : new Response('{}', { status: 200 });

    attachSync(world, { fetch: fakeFetch, storage, now: () => new Date('2026-11-17T04:00:00.000Z') });
    await waitForSync(world);

    assert.equal(world.sync.status, 'idle');
    assert.equal(world.progress.get('115-general-public-admin-q21')?.seen, 1);
  });

  it('syncs when the app is hidden or shown again, at most once per interval, and never without credentials', async () => {
    let nowMs = Date.parse('2026-11-17T04:00:00.000Z');
    let gets = 0;
    const fakeFetch: typeof fetch = async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') {
        gets += 1;
        return remoteResponse('sync-v1-legacy.json');
      }
      return new Response('{}', { status: 200 });
    };

    const world = createWorld();
    attachSync(world, {
      fetch: fakeFetch,
      storage: memoryStorage({ [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CREDENTIALS) }),
      now: () => new Date(nowMs),
    });
    await waitForSync(world);
    assert.equal(gets, 1, 'startup sync');

    assert.equal(syncOnVisibilityChange(world), true);
    await waitForSync(world);
    assert.equal(gets, 2);

    nowMs += SYNC_VISIBILITY_MIN_INTERVAL_MS - 1;
    assert.equal(syncOnVisibilityChange(world), false);
    await waitForSync(world);
    assert.equal(gets, 2);

    nowMs += 1;
    assert.equal(syncOnVisibilityChange(world), true);
    await waitForSync(world);
    assert.equal(gets, 3);

    const offline = createWorld();
    attachSync(offline, { fetch: fakeFetch, storage: memoryStorage(), now: () => new Date(nowMs) });
    assert.equal(syncOnVisibilityChange(offline), false);
    assert.equal(gets, 3);
  });

  it('writes a current save back byte-for-byte equivalent: nothing is dropped or rewritten on load', () => {
    const { world, storage } = loadSave('save-v1.json');
    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });

    const written: unknown = JSON.parse(storage.data[STORAGE_KEY] ?? 'null');
    const original: unknown = JSON.parse(golden('save-v1.json'));
    assert.deepEqual(written, original);
  });

  it('a request that never comes back times out instead of leaving sync stuck, and the next trigger still runs', async () => {
    let hang = true;
    let calls = 0;
    const fakeFetch: typeof fetch = (_input, init) => {
      calls += 1;
      if (hang) return new Promise<Response>(() => undefined);
      return Promise.resolve(
        (init?.method ?? 'GET') === 'GET'
          ? remoteResponse('sync-v1-legacy.json')
          : new Response('{}', { status: 200 }),
      );
    };

    const world = createWorld();
    attachSync(world, {
      fetch: fakeFetch,
      storage: memoryStorage({ [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CREDENTIALS) }),
      now: () => new Date('2026-11-17T04:00:00.000Z'),
      fetchTimeoutMs: 20,
    });
    await waitForSync(world);

    assert.equal(calls, 1);
    assert.equal(world.sync.status, 'error');
    assert.equal(world.sync.error, '現在連不上網路，稍後會再試');
    assert.equal(world.progress.size, 0);

    // 上一次失敗：不受間隔限制，回到前景立刻重試
    hang = false;
    assert.equal(syncOnVisibilityChange(world), true);
    // 已經在同步中了：同一個間隔內的第二次切換不再重複觸發
    assert.equal(syncOnVisibilityChange(world), false);
    await waitForSync(world);

    assert.equal(world.sync.status, 'idle');
    assert.equal(world.progress.get('115-general-public-admin-q21')?.seen, 1);
  });
});

const GOLDEN_HASHES: Record<string, string> = {
  'save-v1.json': '873c6e0b3625ab60a57b298db24327ce63e3c0943842c8f544a6f7f75e08c196',
  'save-v1-legacy.json': '27308122a24f5368103c59b65a8b827f5f9f3075d68a1197a81fdff0b16e25ee',
  'sync-v1.json': '8d659e5e588bc63b4fa7a610670f16d42e7e6ce5892b6b8707eb32e9f42a9d86',
  'sync-v1-legacy.json': 'af53f625cb7dd5b38631b1482740af251ed120f45500a9e4de955df7c65ac447',
};
