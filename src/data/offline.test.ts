import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OFFLINE_CACHE_NAME } from '../core/constants/offline';
import { parseOfflineManifest, planOfflineCache, refreshOfflineCache } from './offline';

const BASE = 'https://example.invalid/app/';

function fakeCaches(initial: string[]): {
  storage: CacheStorage;
  urls: Set<string>;
  opened: string[];
} {
  const urls = new Set(initial);
  const opened: string[] = [];
  const cache = {
    keys: async () => [...urls].map((url) => ({ url })),
    add: async (url: string) => {
      if (url.includes('fail')) throw new Error('offline');
      urls.add(url);
    },
    delete: async (url: string) => urls.delete(url),
  };
  const storage = {
    open: async (name: string) => {
      opened.push(name);
      return cache;
    },
  } as unknown as CacheStorage;
  return { storage, urls, opened };
}

function manifestFetch(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

describe('offline cache', () => {
  it('public/sw.js uses the same cache name as the constant', () => {
    const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
    assert.ok(sw.includes(`const CACHE_NAME = '${OFFLINE_CACHE_NAME}';`));
  });

  it('parseOfflineManifest rejects malformed input', () => {
    assert.equal(parseOfflineManifest(null), null);
    assert.equal(parseOfflineManifest({ version: 1, files: [] }), null);
    assert.equal(parseOfflineManifest({ version: 'v', files: [1] }), null);
    assert.deepEqual(parseOfflineManifest({ version: 'v', files: ['assets/a.js'] }), {
      version: 'v',
      files: ['assets/a.js'],
    });
  });

  it('plans additions and removals only under assets/', () => {
    const plan = planOfflineCache(
      [
        BASE,
        `${BASE}assets/keep.js`,
        `${BASE}assets/old.js`,
        `${BASE}icons/icon-192.png`,
        'https://fonts.invalid/x.woff2',
      ],
      ['assets/keep.js', 'assets/new.js', 'version.json'],
      BASE,
    );
    assert.deepEqual(plan.toAdd, [`${BASE}assets/new.js`]);
    assert.deepEqual(plan.toRemove, [`${BASE}assets/old.js`]);
  });

  it('adds missing assets and removes stale ones when the manifest matches this version', async () => {
    const { storage, urls, opened } = fakeCaches([
      BASE,
      `${BASE}assets/old.js`,
      `${BASE}assets/keep.js`,
    ]);
    const result = await refreshOfflineCache('v2', BASE, {
      fetch: manifestFetch({ version: 'v2', files: ['assets/keep.js', 'assets/new.js'] }),
      caches: storage,
    });
    assert.deepEqual(result, { added: 1, removed: 1 });
    assert.deepEqual([...urls].sort(), [BASE, `${BASE}assets/keep.js`, `${BASE}assets/new.js`]);
    assert.deepEqual(opened, [OFFLINE_CACHE_NAME]);
  });

  it('does nothing when the page is an older version, or the manifest is missing or malformed', async () => {
    const { storage, urls } = fakeCaches([`${BASE}assets/old.js`]);
    const run = (fetchFn: typeof fetch) =>
      refreshOfflineCache('v1', BASE, { fetch: fetchFn, caches: storage });
    assert.equal(await run(manifestFetch({ version: 'v2', files: ['assets/new.js'] })), null);
    assert.equal(await run(manifestFetch({}, 404)), null);
    assert.equal(await run(manifestFetch({ nope: true })), null);
    assert.equal(
      await run(async () => {
        throw new Error('offline');
      }),
      null,
    );
    assert.deepEqual([...urls], [`${BASE}assets/old.js`]);
  });

  it('keeps stale assets when a download fails, so offline never gets worse', async () => {
    const { storage, urls } = fakeCaches([`${BASE}assets/old.js`]);
    const result = await refreshOfflineCache('v2', BASE, {
      fetch: manifestFetch({
        version: 'v2',
        files: ['assets/a.js', 'assets/fail.js', 'assets/b.js'],
      }),
      caches: storage,
    });
    assert.deepEqual(result, { added: 1, removed: 0 });
    assert.ok(urls.has(`${BASE}assets/old.js`));
  });
});
