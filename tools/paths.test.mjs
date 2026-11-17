import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import {
  LAWS_DIR,
  listPacks,
  PACKS_DIR,
  packPaths,
  RAW_DIR,
  resolvePackFromArgv,
  ROOT,
} from './paths.mjs';

test('listPacks returns sorted pack ids containing pack.json', () => {
  const packs = listPacks();
  assert.ok(packs.includes('local4-civil'));
  assert.deepEqual(packs, [...packs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
});

test('packPaths and shared directory constants resolve expected locations', () => {
  assert.equal(LAWS_DIR, resolve(ROOT, 'data/laws'));
  assert.equal(RAW_DIR, resolve(ROOT, 'data/raw'));
  assert.equal(PACKS_DIR, resolve(ROOT, 'data/packs'));

  const paths = packPaths('local4-civil');
  assert.equal(paths.root, resolve(PACKS_DIR, 'local4-civil'));
  assert.equal(paths.packFile, join(paths.root, 'pack.json'));
  assert.equal(paths.officialDir, join(paths.root, 'official'));
  assert.equal(paths.officialIndex, join(paths.root, 'official/index.json'));
  assert.equal(paths.enrichDir, join(paths.root, 'enrich'));
  assert.equal(paths.zhDir, join(paths.root, 'zh'));
  assert.equal(paths.cardsDir, join(paths.root, 'cards'));
  assert.equal(paths.topicsFile, join(paths.root, 'topics.json'));
  assert.equal(paths.zhSrcDir, resolve(ROOT, 'tools/zh/src/local4-civil'));
});

test('resolvePackFromArgv handles --pack, single pack default, and multi-pack error', () => {
  assert.deepEqual(resolvePackFromArgv([], ['local4-civil']), { ok: true, id: 'local4-civil' });
  assert.deepEqual(resolvePackFromArgv(['--pack', 'pack-b'], ['pack-a', 'pack-b']), { ok: true, id: 'pack-b' });
  assert.deepEqual(resolvePackFromArgv(['--pack=pack-a'], ['pack-a', 'pack-b']), { ok: true, id: 'pack-a' });

  const multi = resolvePackFromArgv([], ['pack-a', 'pack-b']);
  assert.equal(multi.ok, false);
  if (!multi.ok) {
    assert.ok(multi.error.includes('pack-a'));
    assert.ok(multi.error.includes('pack-b'));
  }

  const missing = resolvePackFromArgv(['--pack', 'nope'], ['local4-civil']);
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.ok(missing.error.includes('local4-civil'));
  }

  const empty = resolvePackFromArgv([], []);
  assert.equal(empty.ok, false);
});
