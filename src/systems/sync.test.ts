import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import {
  SYNC_API_BASE,
  SYNC_FILE_VERSION,
  SYNC_REMOTE_PATH,
  SYNC_STORAGE_KEY,
} from '../core/constants/sync';
import type { AppEvent, Progress, QuestionId, SyncCredentials } from '../core/types';
import { createWorld } from '../core/world';
import { exportProgress } from './persistence';
import { attachSync, waitForSync, type SyncStorageLike } from './sync';
import { encodeSyncCode } from './syncCode';

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

function encodeRemoteContent(progress: Record<QuestionId, Progress>, updatedAt = '2026-11-15T10:00:00.000Z'): string {
  const json = JSON.stringify({
    version: SYNC_FILE_VERSION,
    updatedAt,
    progress,
  });
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  // Simulate GitHub Contents API wrapping base64 with newlines
  return b64.replace(/(.{40})/g, '$1\n');
}

function decodePutContent(bodyText: string): {
  message: string;
  sha?: string;
  payload: { version: number; updatedAt: string; progress: Record<QuestionId, Progress> };
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
    world.bus.emit({ type: 'roundFinished', results: [], at: '2026-11-16T05:00:00.000Z' });

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
    world.bus.emit({ type: 'roundFinished', results: [], at: '2026-11-16T05:02:00.000Z' });
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
});
