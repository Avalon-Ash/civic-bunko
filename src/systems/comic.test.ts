// 漫畫上方「登場角色」列的是哪些角色：comicCasts 照第一次出場的順序、不重複。
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ComicActor, ComicPanel } from '../core/types';
import { comicCasts } from './comic';

const panel = (...casts: ComicActor['cast'][]): ComicPanel => ({
  scene: 'solo',
  actors: casts.map((cast) => ({ cast, pose: 'sit' })),
  props: [],
  text: { from: 'hook' },
});

test('comicCasts：照第一次出場的順序列出角色、不重複', () => {
  const panels = [panel('citizen'), panel('agency', 'citizen'), panel(), panel('local', 'agency')];
  assert.deepEqual(comicCasts({ panels }), ['citizen', 'agency', 'local']);
});

test('comicCasts：沒有角色就是空的', () => {
  assert.deepEqual(comicCasts({ panels: [panel()] }), []);
});
