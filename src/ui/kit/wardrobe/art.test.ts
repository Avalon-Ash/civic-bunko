import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SLOTS } from '../../../core/constants/wardrobe';
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

  it('item IDs are unique', () => {
    const ids = ITEMS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
