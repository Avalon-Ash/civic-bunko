import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SLOTS } from '../../../core/constants/wardrobe';
import type { Outfit } from '../../../core/types';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cat, ItemIcon } from '../Cat';
import { ITEM_ART } from './art';

/** SVG 裡的 fill／stroke 屬性只能用 var(--…) 或 none，不能寫色碼 */
function badPaintAttrs(fragment: string): string[] {
  const bad: string[] = [];
  for (const [, attr, val] of fragment.matchAll(/\b(fill|stroke)="([^"]+)"/g)) {
    if (val && val !== 'none' && !/^var\(--[\w-]+\)$/.test(val)) bad.push(`${attr}="${val}"`);
  }
  return bad;
}

describe('wardrobe art', () => {
  it('every item in ITEMS has art, and fur items use a fur class while others are layers', () => {
    for (const item of ITEMS) {
      const art = ITEM_ART[item.id];
      assert.ok(art, `missing art for ${item.id}`);
      const slot = SLOTS.find((s) => s.id === item.slot);
      assert.ok(slot, `unknown slot ${item.slot}`);
      assert.equal(art.kind, slot.layer ? 'layer' : 'fur', `${item.id} art kind does not match slot ${item.slot}`);
    }
  });

  it('has no art for items that are not in ITEMS', () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    for (const id of Object.keys(ITEM_ART)) {
      assert.ok(ids.has(id), `art for unknown item ${id}`);
    }
  });

  it('one-piece suits have their own shop icon (the avatar version is just a collar)', () => {
    for (const item of ITEMS.filter((i) => i.id.endsWith('-suit'))) {
      const art = ITEM_ART[item.id];
      assert.ok(art && art.kind === 'layer' && art.icon, item.id);
      const icon = renderToStaticMarkup(h(ItemIcon, { id: item.id }));
      assert.ok(icon.includes(`viewBox="${art.icon.box}"`), item.id);
      assert.ok(!icon.includes(`viewBox="${art.box}"`), item.id);
    }
    // 沒給圖示的配件照舊用頭像版的圖
    const beanie = ITEM_ART.beanie;
    assert.ok(beanie && beanie.kind === 'layer' && !beanie.icon);
    assert.ok(renderToStaticMarkup(h(ItemIcon, { id: 'beanie' })).includes(`viewBox="${beanie.box}"`));
  });

  it('item IDs are unique', () => {
    const ids = ITEMS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('patterned furs render clipped head marks with token-only colors; plain and legacy furs emit no marks', () => {
    const patterned = ['fur-tabby', 'fur-silver', 'fur-tuxedo', 'fur-calico', 'fur-siamese'];
    const plain = ['fur-orange', 'fur-gray', 'fur-black', 'fur-gold', 'fur-milktea'];
    for (const id of patterned) {
      const art = ITEM_ART[id];
      assert.ok(art && art.kind === 'fur' && art.marks, `${id} should define marks`);
      const markup = renderToStaticMarkup(h(Cat, { interactive: false, outfit: { fur: id } }));
      const clipIds = new Set([...markup.matchAll(/<clipPath id="([^"]+)">/g)].map((m) => m[1]));
      const markGroup = /<g clip-path="url\(#([^)]+)\)" class="cb-fur-marks cb-fur-head">([\s\S]*?)<\/g>(?=<ellipse)/.exec(markup);
      assert.ok(markGroup, `${id} avatar should render clipped cb-fur-marks`);
      assert.ok(clipIds.has(markGroup[1] ?? ''), `${id} avatar clipPath id should exist`);
      assert.deepEqual(badPaintAttrs(markGroup[2] ?? ''), [], `${id} avatar marks should use only CSS variables`);
    }
    const plainOutfits: Outfit[] = [{}, ...plain.map((fur): Outfit => ({ fur }))];
    for (const outfit of plainOutfits) {
      const markup = renderToStaticMarkup(h(Cat, { interactive: false, outfit }));
      assert.ok(!markup.includes('cb-fur-marks'), `${outfit.fur ?? 'default'} should not emit fur marks`);
      assert.ok(!markup.includes('<clipPath'), `${outfit.fur ?? 'default'} should not emit head clipPath`);
    }
  });
});
