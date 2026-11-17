import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SYNC_FILE_VERSION, SYNC_STORAGE_KEY } from '../core/constants/sync';
import type { AppEvent, ExamRecord, SyncCredentials } from '../core/types';
import { createWorld } from '../core/world';
import { attachSync, waitForSync, type SyncStorageLike } from './sync';
import { mergeCardsSeen, mergeExamHistory } from './syncMerge';

const TEST_CRED: SyncCredentials = {
  owner: 'family',
  repo: 'civic-sync',
  token: 'secret_pat_token_987654',
};

function storageWithCred(): SyncStorageLike {
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

function exam(paperId: string, at: string, correct = 30): ExamRecord {
  return { paperId, at, total: 50, answered: 50, correct, score: Math.round((correct / 50) * 100) };
}

function remoteBody(payload: Record<string, unknown>): Response {
  const json = JSON.stringify({
    version: SYNC_FILE_VERSION,
    updatedAt: '2026-11-17T00:00:00.000Z',
    progress: {},
    ...payload,
  });
  return new Response(
    JSON.stringify({ sha: 'sha-1', content: Buffer.from(json, 'utf8').toString('base64') }),
    { status: 200 },
  );
}

function decodePut(body: string): Record<string, unknown> {
  const parsed = JSON.parse(body) as { content: string };
  return JSON.parse(Buffer.from(parsed.content, 'base64').toString('utf8')) as Record<string, unknown>;
}

describe('sync merge: cardsSeen & examHistory', () => {
  it('mergeCardsSeen is a union that keeps local order and ignores remote order', () => {
    assert.deepEqual(mergeCardsSeen(['b', 'a'], ['z', 'a', 'c']), ['b', 'a', 'c', 'z']);
    assert.deepEqual(mergeCardsSeen(['b', 'a'], ['c', 'z', 'a', 'c']), ['b', 'a', 'c', 'z']);
    assert.deepEqual(mergeCardsSeen([], []), []);
  });

  it('mergeExamHistory unions by time+paper, sorts old to new, trims to max, and is commutative', () => {
    const a = exam('p1', '2026-11-16T10:00:00.000Z');
    const b = exam('p2', '2026-11-17T09:00:00.000Z');
    const c = exam('p1', '2026-11-15T08:00:00.000Z');

    const lr = mergeExamHistory([a, b], [c, a], 60);
    const rl = mergeExamHistory([c, a], [a, b], 60);
    assert.deepEqual(lr, [c, a, b]);
    assert.deepEqual(lr, rl);
    assert.deepEqual(mergeExamHistory([a, b], [c], 2), [a, b]);
  });
});

describe('sync system: cardsSeen & examHistory', () => {
  it('pulls remote-only items into settings, pushes the union, and emits settingsChanged', async () => {
    const world = createWorld();
    const local = exam('p1', '2026-11-17T09:00:00.000Z');
    const remote = exam('p2', '2026-11-16T09:00:00.000Z');
    world.settings = { ...world.settings, cardsSeen: ['card-a'], examHistory: [local] };

    const events: AppEvent[] = [];
    world.bus.on('settingsChanged', (event) => events.push(event));
    const puts: string[] = [];
    const fakeFetch: typeof fetch = async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return remoteBody({ cardsSeen: ['card-b'], examHistory: [remote] });
      }
      puts.push(String(init?.body));
      return new Response('{}', { status: 200 });
    };

    attachSync(world, {
      fetch: fakeFetch,
      storage: storageWithCred(),
      now: () => new Date('2026-11-17T10:00:00.000Z'),
    });
    await waitForSync(world);

    assert.deepEqual(world.settings.cardsSeen, ['card-a', 'card-b']);
    assert.deepEqual(world.settings.examHistory, [remote, local]);
    assert.equal(events.length, 1);
    assert.equal(puts.length, 1);
    const payload = decodePut(puts[0] ?? '');
    assert.deepEqual(payload.cardsSeen, ['card-a', 'card-b']);
    assert.deepEqual(payload.examHistory, [remote, local]);
    assert.equal(world.sync.status, 'idle');
  });

  it('reads legacy remote files without the new fields and skips PUT when nothing differs', async () => {
    const world = createWorld();
    const events: AppEvent[] = [];
    world.bus.on('settingsChanged', (event) => events.push(event));
    let putCount = 0;
    const fakeFetch: typeof fetch = async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return remoteBody({});
      }
      putCount += 1;
      return new Response('{}', { status: 200 });
    };

    attachSync(world, {
      fetch: fakeFetch,
      storage: storageWithCred(),
      now: () => new Date('2026-11-17T10:00:00.000Z'),
    });
    await waitForSync(world);

    assert.equal(putCount, 0);
    assert.equal(events.length, 0);
    assert.equal(world.sync.status, 'idle');
  });

  it('skips PUT when remote holds the same items in a different order, and tolerates a malformed field', async () => {
    const world = createWorld();
    const a = exam('p1', '2026-11-16T10:00:00.000Z');
    const b = exam('p2', '2026-11-17T09:00:00.000Z');
    world.settings = { ...world.settings, cardsSeen: ['card-a', 'card-b'], examHistory: [a, b] };
    let putCount = 0;
    let malformed = false;
    const fakeFetch: typeof fetch = async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return malformed
          ? remoteBody({ cardsSeen: 'oops', examHistory: [{ bad: true }] })
          : remoteBody({ cardsSeen: ['card-b', 'card-a'], examHistory: [b, a] });
      }
      putCount += 1;
      return new Response('{}', { status: 200 });
    };
    const deps = {
      fetch: fakeFetch,
      storage: storageWithCred(),
      now: () => new Date('2026-11-17T10:00:00.000Z'),
    };

    attachSync(world, deps);
    await waitForSync(world);
    assert.equal(putCount, 0);
    assert.deepEqual(world.settings.cardsSeen, ['card-a', 'card-b']);

    malformed = true;
    attachSync(world, deps);
    await waitForSync(world);
    assert.equal(world.sync.status, 'idle');
    assert.equal(putCount, 1);
    assert.deepEqual(world.settings.examHistory, [a, b]);
  });
});
