import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import {
  SYNC_API_BASE,
  SYNC_FILE_VERSION,
  SYNC_REMOTE_PATH,
  SYNC_STORAGE_KEY,
} from '../core/constants/sync';
import type { AppEvent, DayKey, Progress, QuestionId, SyncCredentials } from '../core/types';
import { createWorld } from '../core/world';
import { exportProgress } from './persistence';
import { attachSync, waitForSync, type SyncStorageLike } from './sync';
import { encodeSyncCode } from './syncCode';
import { makeConfig } from '../testing/fixture';

function createMemoryStorage(
  initial: Record<string, string> = {},
): SyncStorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(data, key) ? (data[key] ?? null) : null;
    },
    setItem(key: string, value: string): void {
      data[key] = value;
    },
    removeItem(key: string): void {
      delete data[key];
    },
  };
}

function makeProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    seen: 1,
    correct: 1,
    views: 0,
    streak: 1,
    lastPick: 'A',
    lastAt: '2026-11-15T10:00:00.000Z',
    due: null,
    ...overrides,
  };
}

function encodeRemoteContent(
  progress: Record<QuestionId, Progress>,
  updatedAt = '2026-11-15T10:00:00.000Z',
  days?: Record<DayKey, number>,
  extra?: Record<string, unknown>,
): string {
  const json = JSON.stringify({
    version: SYNC_FILE_VERSION,
    updatedAt,
    progress,
    ...(days !== undefined ? { days } : {}),
    ...(extra ?? {}),
  });
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  // Simulate GitHub Contents API wrapping base64 with newlines
  return b64.replace(/(.{40})/g, '$1\n');
}

function decodePutContent(bodyText: string): {
  message: string;
  sha?: string;
  payload: {
    version: number;
    updatedAt: string;
    progress: Record<QuestionId, Progress>;
    days?: Record<DayKey, number>;
    wardrobe?: {
      owned: string[];
      achievements: string[];
      quests: Record<string, string[]>;
      outfit?: unknown;
      saved?: Record<string, number>; repairs?: number;
    };
  };
} {
  const parsed = JSON.parse(bodyText) as { message: string; content: string; sha?: string };
  const json = Buffer.from(parsed.content, 'base64').toString('utf8');
  return {
    message: parsed.message,
    ...(parsed.sha !== undefined ? { sha: parsed.sha } : {}),
    payload: JSON.parse(json) as {
      version: number;
      updatedAt: string;
      progress: Record<QuestionId, Progress>;
      days?: Record<DayKey, number>;
      wardrobe?: {
        owned: string[];
        achievements: string[];
        quests: Record<string, string[]>;
        outfit?: unknown;
        saved?: Record<string, number>; repairs?: number;
      };
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const TEST_CRED: SyncCredentials = {
  owner: 'family',
  repo: 'civic-sync',
  token: 'secret_pat_token_987654',
};

describe('sync system', () => {
  it('uploads initial progress when remote returns 404 and includes required GitHub headers', async () => {
    const world = createWorld();
    world.progress.set('q1', makeProgress({ seen: 2, correct: 1 }));
    const storage = createMemoryStorage();
    const calls: Array<{ url: string; method: string; headers: Headers; body: string | null }> = [];

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === 'string' ? init.body : null;
      calls.push({ url, method, headers, body });

      if (method === 'GET') {
        return jsonResponse(404, { message: 'Not Found' });
      }
      return jsonResponse(201, { content: { sha: 'sha-1' } });
    };

    const fixedNow = new Date('2026-11-16T01:00:00.000Z');
    attachSync(world, { fetch: fakeFetch, storage, now: () => fixedNow });
    dispatch(world, { type: 'setSyncCode', code: encodeSyncCode(TEST_CRED) });
    await waitForSync(world);

    assert.equal(calls.length, 2);
    const expectedUrl = `${SYNC_API_BASE}/repos/family/civic-sync/contents/${SYNC_REMOTE_PATH}`;
    assert.equal(calls[0]?.url, expectedUrl);
    assert.equal(calls[0]?.method, 'GET');
    assert.equal(calls[0]?.headers.get('Authorization'), `Bearer ${TEST_CRED.token}`);
    assert.equal(calls[0]?.headers.get('Accept'), 'application/vnd.github+json');
    assert.equal(calls[0]?.headers.get('X-GitHub-Api-Version'), '2022-11-28');

    assert.equal(calls[1]?.method, 'PUT');
    assert.ok(calls[1]?.body);
    const put = decodePutContent(calls[1].body);
    assert.equal(put.sha, undefined);
    assert.equal(put.payload.version, 1);
    assert.deepEqual(put.payload.progress.q1, world.progress.get('q1'));

    assert.equal(world.sync.status, 'idle');
    assert.equal(world.sync.lastSyncedAt, fixedNow.toISOString());
    assert.equal(world.sync.error, null);
  });

  it('merges local and remote data, emits progressChanged, and skips PUT when remote already matches', async () => {
    const world = createWorld();
    world.progress.set('q1', makeProgress({ seen: 1, views: 5, lastAt: '2026-11-15T09:00:00.000Z' }));

    const remoteOnly = makeProgress({ seen: 3, correct: 3, views: 2, lastAt: '2026-11-15T11:00:00.000Z' });
    const remoteQ1 = makeProgress({ seen: 2, views: 1, lastAt: '2026-11-15T10:00:00.000Z' });

    const storage = createMemoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED),
    });

    const changedEvents: QuestionId[][] = [];
    world.bus.on('progressChanged', (e) => changedEvents.push(e.ids));

    const methods: string[] = [];
    let putBodyRaw = '';

    const fakeFetch: typeof fetch = async (_input, init) => {
      const method = init?.method ?? 'GET';
      methods.push(method);
      if (method === 'GET') {
        return jsonResponse(200, {
          sha: 'sha-remote-1',
          content: encodeRemoteContent({ q1: remoteQ1, q2: remoteOnly }),
        });
      }
      putBodyRaw = typeof init?.body === 'string' ? init.body : '';
      return jsonResponse(200, { content: { sha: 'sha-remote-2' } });
    };

    attachSync(world, {
      fetch: fakeFetch,
      storage,
      now: () => new Date('2026-11-16T02:00:00.000Z'),
    });
    await waitForSync(world);

    assert.deepEqual(methods, ['GET', 'PUT']);
    assert.equal(changedEvents.length, 1);
    assert.deepEqual(changedEvents[0]?.sort(), ['q1', 'q2']);
    assert.equal(world.progress.get('q1')?.views, 5);
    assert.equal(world.progress.get('q1')?.seen, 2);
    assert.deepEqual(world.progress.get('q2'), remoteOnly);

    const put = decodePutContent(putBodyRaw);
    assert.equal(put.sha, 'sha-remote-1');
    assert.equal(put.payload.progress.q1?.views, 5);

    // Second sync when remote already equals local: should only GET, no PUT
    methods.length = 0;
    const syncedRemote = put.payload.progress;
    const fakeFetchUpToDate: typeof fetch = async (_input, init) => {
      const method = init?.method ?? 'GET';
      methods.push(method);
      return jsonResponse(200, {
        sha: 'sha-remote-2',
        content: encodeRemoteContent(syncedRemote),
      });
    };
    attachSync(world, {
      fetch: fakeFetchUpToDate,
      storage,
      now: () => new Date('2026-11-16T02:05:00.000Z'),
    });
    await waitForSync(world);
    assert.deepEqual(methods, ['GET']);
  });

  it('retries once on 409/422 sha conflict and succeeds with fresh sha', async () => {
    const world = createWorld();
    world.progress.set('q1', makeProgress({ seen: 1, lastAt: '2026-11-15T10:00:00.000Z' }));
    const storage = createMemoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED),
    });

    let getCount = 0;
    const putShas: Array<string | undefined> = [];

    const fakeFetch: typeof fetch = async (_input, init) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        getCount += 1;
        if (getCount === 1) {
          return jsonResponse(200, {
            sha: 'stale-sha',
            content: encodeRemoteContent({}),
          });
        }
        return jsonResponse(200, {
          sha: 'fresh-sha',
          content: encodeRemoteContent({ q3: makeProgress({ seen: 4 }) }),
        });
      }
      const put = decodePutContent(String(init?.body ?? ''));
      putShas.push(put.sha);
      if (putShas.length === 1) {
        return jsonResponse(409, { message: 'Conflict' });
      }
      return jsonResponse(200, { content: { sha: 'new-sha' } });
    };

    attachSync(world, {
      fetch: fakeFetch,
      storage,
      now: () => new Date('2026-11-16T03:00:00.000Z'),
    });
    await waitForSync(world);

    assert.equal(getCount, 2);
    assert.deepEqual(putShas, ['stale-sha', 'fresh-sha']);
    assert.equal(world.sync.status, 'idle');
    assert.equal(world.progress.get('q3')?.seen, 4);
  });

  it('reports friendly error messages for 401, 404 repo not found, network errors, and invalid code', async () => {
    const world = createWorld();
    const storage = createMemoryStorage();
    const events: AppEvent[] = [];
    for (const type of ['syncChanged', 'progressChanged'] as const) {
      world.bus.on(type, (ev) => events.push(ev));
    }

    // Invalid code should fail without storing or calling fetch
    let fetchCount = 0;
    attachSync(world, {
      fetch: async () => {
        fetchCount += 1;
        return jsonResponse(200, {});
      },
      storage,
      now: () => new Date('2026-11-16T04:00:00.000Z'),
    });

    dispatch(world, { type: 'setSyncCode', code: 'bad-code' });
    assert.equal(fetchCount, 0);
    assert.equal(storage.getItem(SYNC_STORAGE_KEY), null);
    assert.equal(world.sync.status, 'error');
    assert.equal(world.sync.error, '同步碼格式不對');

    // 401 error
    attachSync(world, {
      fetch: async () => jsonResponse(401, { message: 'Bad credentials' }),
      storage,
      now: () => new Date('2026-11-16T04:01:00.000Z'),
    });
    dispatch(world, { type: 'setSyncCode', code: encodeSyncCode(TEST_CRED) });
    await waitForSync(world);
    assert.equal(world.sync.status, 'error');
    assert.equal(world.sync.error, '同步碼失效或權限不足');

    // 404 repo not found on PUT
    attachSync(world, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(404, { message: 'Not Found' });
        }
        return jsonResponse(404, { message: 'Not Found' });
      },
      storage,
      now: () => new Date('2026-11-16T04:02:00.000Z'),
    });
    await waitForSync(world);
    assert.equal(world.sync.status, 'error');
    assert.equal(world.sync.error, '找不到同步用的 repo');

    // Network error
    attachSync(world, {
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
      storage,
      now: () => new Date('2026-11-16T04:03:00.000Z'),
    });
    await waitForSync(world);
    assert.equal(world.sync.status, 'error');
    assert.equal(world.sync.error, '現在連不上網路，稍後會再試');

    // Ensure token never leaked into events or sync state
    const serialized = JSON.stringify({ events, sync: world.sync });
    assert.equal(serialized.includes(TEST_CRED.token), false);
  });

  it('queues at most one rerun when triggered while syncing, and stops calling fetch after disableSync', async () => {
    const world = createWorld();
    world.progress.set('q1', makeProgress({ seen: 1 }));
    const storage = createMemoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED),
    });

    let resolveFirstGet: (res: Response) => void = () => {};
    let getCalls = 0;

    const fakeFetch: typeof fetch = async (_input, init) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        getCalls += 1;
        if (getCalls === 1) {
          return await new Promise<Response>((resolve) => {
            resolveFirstGet = resolve;
          });
        }
        return jsonResponse(200, {
          sha: 'sha-1',
          content: encodeRemoteContent({ q1: makeProgress({ seen: 1 }) }),
        });
      }
      return jsonResponse(200, { content: { sha: 'sha-2' } });
    };

    attachSync(world, {
      fetch: fakeFetch,
      storage,
      now: () => new Date('2026-11-16T05:00:00.000Z'),
    });

    assert.equal(world.sync.status, 'syncing');
    // Trigger multiple times while first sync is in flight
    dispatch(world, { type: 'syncNow' });
    world.bus.emit({ type: 'roundFinished', results: [], config: makeConfig(), at: '2026-11-16T05:00:00.000Z' });

    // Resolve first GET
    resolveFirstGet(jsonResponse(404, { message: 'Not Found' }));
    await waitForSync(world);

    // Should have run initial + 1 rerun (not 3)
    assert.equal(getCalls, 2);
    assert.equal(world.sync.status, 'idle');

    // Now test disableSync cancels in-flight sync and never calls fetch again
    let fetchAfterDisable = 0;
    let slowStarted = false;
    let releaseSlowGet: (res: Response) => void = () => {};
    attachSync(world, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET' && !slowStarted) {
          slowStarted = true;
          return await new Promise<Response>((resolve) => {
            releaseSlowGet = resolve;
          });
        }
        fetchAfterDisable += 1;
        return jsonResponse(200, { sha: 's', content: encodeRemoteContent({}) });
      },
      storage,
      now: () => new Date('2026-11-16T05:01:00.000Z'),
    });

    dispatch(world, { type: 'disableSync' });
    assert.equal(world.sync.status, 'off');
    assert.equal(storage.getItem(SYNC_STORAGE_KEY), null);
    assert.equal(world.progress.get('q1')?.seen, 1);

    // Finish slow GET from before disableSync — must NOT trigger PUT
    releaseSlowGet(jsonResponse(404, { message: 'Not Found' }));
    await waitForSync(world);

    dispatch(world, { type: 'syncNow' });
    world.bus.emit({ type: 'roundFinished', results: [], config: makeConfig(), at: '2026-11-16T05:02:00.000Z' });
    await waitForSync(world);

    assert.equal(fetchAfterDisable, 0);
    assert.equal(world.sync.status, 'off');
  });

  it('never includes sync token or credentials in exportProgress output', async () => {
    const world = createWorld();
    const storage = createMemoryStorage();
    attachSync(world, {
      fetch: async () => jsonResponse(404, {}),
      storage,
      now: () => new Date('2026-11-16T06:00:00.000Z'),
    });

    dispatch(world, { type: 'setSyncCode', code: encodeSyncCode(TEST_CRED) });
    await waitForSync(world);

    const exported = exportProgress(world);
    assert.equal(exported.includes(TEST_CRED.token), false);
    assert.equal(exported.includes(TEST_CRED.owner), false);
    assert.equal(exported.includes(TEST_CRED.repo), false);
  });

  it('merges days taking max count, emits dayLogChanged, and reads legacy remote files without days', async () => {
    const world = createWorld();
    world.dayLog.set('2026-11-15', 16);
    world.dayLog.set('2026-11-16', 3);

    const storage = createMemoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED),
    });

    const dayEvents: Array<{ day: string; count: number }> = [];
    world.bus.on('dayLogChanged', (e) => dayEvents.push({ day: e.day, count: e.count }));

    let putBodyRaw = '';
    const methods: string[] = [];

    attachSync(world, {
      fetch: async (_input, init) => {
        const method = init?.method ?? 'GET';
        methods.push(method);
        if (method === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-days-1',
            content: encodeRemoteContent({}, '2026-11-16T00:00:00.000Z', {
              '2026-11-15': 10,
              '2026-11-16': 15,
              '2026-11-17': 6,
            }),
          });
        }
        putBodyRaw = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-days-2' } });
      },
      storage,
      now: () => new Date('2026-11-17T08:00:00.000Z'),
    });
    await waitForSync(world);

    assert.deepEqual(methods, ['GET', 'PUT']);
    assert.deepEqual(Object.fromEntries(world.dayLog), {
      '2026-11-15': 16,
      '2026-11-16': 15,
      '2026-11-17': 6,
    });
    assert.deepEqual(
      dayEvents.sort((a, b) => a.day.localeCompare(b.day)),
      [
        { day: '2026-11-16', count: 15 },
        { day: '2026-11-17', count: 6 },
      ],
    );

    const put = decodePutContent(putBodyRaw);
    assert.deepEqual(put.payload.days, {
      '2026-11-15': 16,
      '2026-11-16': 15,
      '2026-11-17': 6,
    });

    // Legacy remote file without `days` must still be readable and merge cleanly
    const worldLegacy = createWorld();
    worldLegacy.progress.set('q1', makeProgress({ seen: 1 }));
    worldLegacy.dayLog.set('2026-11-18', 5);
    let legacyPutRaw = '';
    attachSync(worldLegacy, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-old',
            content: encodeRemoteContent({ q1: makeProgress({ seen: 1 }) }),
          });
        }
        legacyPutRaw = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-new' } });
      },
      storage,
      now: () => new Date('2026-11-18T08:00:00.000Z'),
    });
    await waitForSync(worldLegacy);
    assert.equal(worldLegacy.sync.status, 'idle');
    assert.deepEqual(decodePutContent(legacyPutRaw).payload.days, { '2026-11-18': 5 });

    // Invalid days in remote file reports data format error
    const worldInvalid = createWorld();
    attachSync(worldInvalid, {
      fetch: async () =>
        jsonResponse(200, {
          sha: 'sha-bad',
          content: encodeRemoteContent({}, '2026-11-18T00:00:00.000Z', {
            'bad-date': 5,
          }),
        }),
      storage,
      now: () => new Date('2026-11-18T09:00:00.000Z'),
    });
    await waitForSync(worldInvalid);
    assert.equal(worldInvalid.sync.status, 'error');
    assert.equal(worldInvalid.sync.error, '同步資料格式不正確');
  });

  it('merges wardrobe without syncing outfit, keeps local outfit, and tolerates missing or corrupted remote wardrobe', async () => {
    const storage = createMemoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED),
    });

    // 1. Both sides have wardrobe: merges owned/achievements/quests, preserves local outfit, omits outfit from PUT
    const world = createWorld();
    world.settings.wardrobe = {
      owned: ['beanie'],
      achievements: ['exam-1'],
      quests: { '2026-11-17': ['quiz-round'] },
      outfit: { 'head-top': 'beanie', neck: 'scarf' },
    };

    let putBodyRaw = '';
    attachSync(world, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-w1',
            content: encodeRemoteContent({}, '2026-11-17T00:00:00.000Z', undefined, {
              wardrobe: {
                owned: ['bell'],
                achievements: ['stamps-3'],
                quests: { '2026-11-17': ['new-card'] },
                outfit: { 'head-top': 'beret' },
              },
            }),
          });
        }
        putBodyRaw = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-w2' } });
      },
      storage,
      now: () => new Date('2026-11-17T10:00:00.000Z'),
    });
    await waitForSync(world);

    assert.equal(world.sync.status, 'idle');
    assert.deepEqual(world.settings.wardrobe, {
      owned: ['beanie', 'bell'],
      achievements: ['exam-1', 'stamps-3'],
      quests: { '2026-11-17': ['new-card', 'quiz-round'] },
      outfit: { 'head-top': 'beanie', neck: 'scarf' },
    });

    const put = decodePutContent(putBodyRaw);
    assert.ok(put.payload.wardrobe);
    assert.equal('outfit' in put.payload.wardrobe, false);
    assert.deepEqual(put.payload.wardrobe, {
      owned: ['beanie', 'bell'],
      achievements: ['exam-1', 'stamps-3'],
      quests: { '2026-11-17': ['new-card', 'quiz-round'] },
    });

    // 2. Remote missing wardrobe (legacy sync) keeps local wardrobe intact
    const worldLegacyRemote = createWorld();
    worldLegacyRemote.settings.wardrobe = {
      owned: ['beanie'],
      achievements: ['exam-1'],
      quests: { '2026-11-17': ['quiz-round'] },
      outfit: { 'head-top': 'beanie' },
    };
    attachSync(worldLegacyRemote, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-leg',
            content: encodeRemoteContent({}),
          });
        }
        return jsonResponse(200, { content: { sha: 'sha-leg-2' } });
      },
      storage,
      now: () => new Date('2026-11-17T11:00:00.000Z'),
    });
    await waitForSync(worldLegacyRemote);
    assert.equal(worldLegacyRemote.sync.status, 'idle');
    assert.deepEqual(worldLegacyRemote.settings.wardrobe, {
      owned: ['beanie'],
      achievements: ['exam-1'],
      quests: { '2026-11-17': ['quiz-round'] },
      outfit: { 'head-top': 'beanie' },
    });

    // 3. Corrupted remote wardrobe does not fail sync or drop progress
    const worldCorruptRemote = createWorld();
    attachSync(worldCorruptRemote, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-bad-w',
            content: encodeRemoteContent(
              { q1: makeProgress({ seen: 2 }) },
              '2026-11-17T00:00:00.000Z',
              undefined,
              { wardrobe: 'corrupted-string' },
            ),
          });
        }
        return jsonResponse(200, { content: { sha: 'sha-bad-w2' } });
      },
      storage,
      now: () => new Date('2026-11-17T12:00:00.000Z'),
    });
    await waitForSync(worldCorruptRemote);
    assert.equal(worldCorruptRemote.sync.status, 'idle');
    assert.equal(worldCorruptRemote.progress.get('q1')?.seen, 2);
  });

  it('syncs what was saved in daily sales: larger amount per item wins, uploads when only that differs, and adds no field when unused', async () => {
    const storage = createMemoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED),
    });
    const world = createWorld();
    world.settings.wardrobe = {
      owned: ['beanie', 'cape'],
      achievements: [],
      quests: {},
      saved: { beanie: 24, cape: 40 },
      outfit: { 'head-top': 'beanie' },
    };
    let putBodyRaw = '';
    attachSync(world, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-s1',
            content: encodeRemoteContent({}, '2026-11-20T00:00:00.000Z', undefined, {
              wardrobe: { owned: ['beanie', 'cape'], achievements: [], quests: {}, saved: { cape: 60 } },
            }),
          });
        }
        putBodyRaw = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-s2' } });
      },
      storage,
      now: () => new Date('2026-11-20T10:00:00.000Z'),
    });
    await waitForSync(world);
    assert.equal(world.sync.status, 'idle');
    // owned 兩邊一樣，只有省下的金額不同：本機要更新、雲端也要更新
    assert.deepEqual(world.settings.wardrobe, {
      owned: ['beanie', 'cape'],
      achievements: [],
      quests: {},
      saved: { beanie: 24, cape: 60 },
      outfit: { 'head-top': 'beanie' },
    });
    assert.deepEqual(decodePutContent(putBodyRaw).payload.wardrobe, {
      owned: ['beanie', 'cape'],
      achievements: [],
      quests: {},
      saved: { beanie: 24, cape: 60 },
    });

    // 舊版 App 寫回的同步檔沒有 saved：本機的紀錄留著，並且補回雲端
    const worldOldRemote = createWorld();
    worldOldRemote.settings.wardrobe = { owned: ['beanie'], achievements: [], quests: {}, saved: { beanie: 24 } };
    let putOld = '';
    attachSync(worldOldRemote, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-o1',
            content: encodeRemoteContent({}, '2026-11-20T00:00:00.000Z', undefined, {
              wardrobe: { owned: ['beanie'], achievements: [], quests: {} },
            }),
          });
        }
        putOld = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-o2' } });
      },
      storage,
      now: () => new Date('2026-11-20T11:00:00.000Z'),
    });
    await waitForSync(worldOldRemote);
    assert.deepEqual(worldOldRemote.settings.wardrobe?.saved, { beanie: 24 });
    assert.deepEqual(decodePutContent(putOld).payload.wardrobe?.saved, { beanie: 24 });

    // 沒趁特價買過的人：同步檔不多這一欄
    const worldPlain = createWorld();
    worldPlain.settings.wardrobe = { owned: ['beanie'], achievements: [], quests: {} };
    let putPlain = '';
    attachSync(worldPlain, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') return jsonResponse(404, {});
        putPlain = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-p1' } });
      },
      storage,
      now: () => new Date('2026-11-20T12:00:00.000Z'),
    });
    await waitForSync(worldPlain);
    const plain = decodePutContent(putPlain).payload.wardrobe;
    assert.ok(plain);
    assert.equal('saved' in plain, false);
  });
  it('syncs how many scorch repairs were paid: larger count wins, uploads when only that differs, never uploads the marks', async () => {
    const storage = createMemoryStorage({
      [SYNC_STORAGE_KEY]: JSON.stringify(TEST_CRED),
    });
    const world = createWorld();
    world.settings.wardrobe = {
      owned: ['beanie'],
      achievements: [],
      quests: {},
      repairs: 2,
      scorch: ['today-quest'],
      outfit: { 'head-top': 'beanie' },
    };
    let putBodyRaw = '';
    attachSync(world, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-r1',
            content: encodeRemoteContent({}, '2026-11-20T00:00:00.000Z', undefined, {
              wardrobe: { owned: ['beanie'], achievements: [], quests: {}, repairs: 1, scorch: ['other-device-spot'] },
            }),
          });
        }
        putBodyRaw = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-r2' } });
      },
      storage,
      now: () => new Date('2026-11-20T10:00:00.000Z'),
    });
    await waitForSync(world);
    assert.equal(world.sync.status, 'idle');
    // owned 兩邊一樣，只有修復次數不同：本機留較大的、雲端也補上；焦痕是這台自己的，不上傳、也不收別台的
    assert.deepEqual(world.settings.wardrobe, {
      owned: ['beanie'],
      achievements: [],
      quests: {},
      repairs: 2,
      scorch: ['today-quest'],
      outfit: { 'head-top': 'beanie' },
    });
    assert.deepEqual(decodePutContent(putBodyRaw).payload.wardrobe, {
      owned: ['beanie'],
      achievements: [],
      quests: {},
      repairs: 2,
    });

    // 雲端的次數比較大：本機跟上（不必再上傳）
    const worldBehind = createWorld();
    worldBehind.settings.wardrobe = { owned: ['beanie'], achievements: [], quests: {}, repairs: 1 };
    let putBehind = '';
    attachSync(worldBehind, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-b1',
            content: encodeRemoteContent({}, '2026-11-20T00:00:00.000Z', undefined, {
              wardrobe: { owned: ['beanie'], achievements: [], quests: {}, repairs: 4 },
            }),
          });
        }
        putBehind = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-b2' } });
      },
      storage,
      now: () => new Date('2026-11-20T10:30:00.000Z'),
    });
    await waitForSync(worldBehind);
    assert.equal(worldBehind.settings.wardrobe?.repairs, 4);
    assert.equal(putBehind, '');

    // 舊版 App 寫回的同步檔沒有 repairs：本機的次數留著，並且補回雲端
    const worldOldRemote = createWorld();
    worldOldRemote.settings.wardrobe = { owned: ['beanie'], achievements: [], quests: {}, repairs: 3 };
    let putOld = '';
    attachSync(worldOldRemote, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonResponse(200, {
            sha: 'sha-o1',
            content: encodeRemoteContent({}, '2026-11-20T00:00:00.000Z', undefined, {
              wardrobe: { owned: ['beanie'], achievements: [], quests: {} },
            }),
          });
        }
        putOld = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-o2' } });
      },
      storage,
      now: () => new Date('2026-11-20T11:00:00.000Z'),
    });
    await waitForSync(worldOldRemote);
    assert.equal(worldOldRemote.settings.wardrobe?.repairs, 3);
    assert.equal(decodePutContent(putOld).payload.wardrobe?.repairs, 3);

    // 沒修過的人：同步檔不多這一欄
    const worldPlain = createWorld();
    worldPlain.settings.wardrobe = { owned: ['beanie'], achievements: [], quests: {}, scorch: ['today-quest'] };
    let putPlain = '';
    attachSync(worldPlain, {
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') return jsonResponse(404, {});
        putPlain = String(init?.body ?? '');
        return jsonResponse(200, { content: { sha: 'sha-p1' } });
      },
      storage,
      now: () => new Date('2026-11-20T12:00:00.000Z'),
    });
    await waitForSync(worldPlain);
    const plain = decodePutContent(putPlain).payload.wardrobe;
    assert.ok(plain);
    assert.equal('repairs' in plain, false);
    assert.equal('scorch' in plain, false);
  });
});
