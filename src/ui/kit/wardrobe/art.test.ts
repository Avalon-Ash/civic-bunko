import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SLOTS } from '../../../core/constants/wardrobe';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemIcon } from '../Cat';
import { ITEM_ART } from './art';

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
});
