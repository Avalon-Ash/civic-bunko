// 多部位試穿的驗收（主代理寫）：試穿籃的增減、總價、買不買得起、套裝效果分得出「買下來才有」。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../core/constants/wardrobe';
import type { ItemId, TryOn, WardrobeItem } from '../core/types';
import { toggleTryOn, tryOnBasket, tryOnEffects, tryOnPreview, type ItemStatusView } from './wardrobe';

function item(id: ItemId): WardrobeItem {
  const found = ITEMS.find((i) => i.id === id);
  assert.ok(found, `ITEMS 裡要有 ${id}`);
  return found;
}

function shopPrice(id: ItemId): number {
  const src = item(id).source;
  assert.equal(src.kind, 'shop', `${id} 要是商店配件`);
  return src.kind === 'shop' ? src.price : 0;
}

/** 照 itemStatuses 的形狀手做一份狀態（不經過 world，價格與狀態由測試決定） */
function status(id: ItemId, state: ItemStatusView['state'], extra: Partial<ItemStatusView> = {}): ItemStatusView {
  return { item: item(id), state, ...extra };
}

describe('toggleTryOn', () => {
  it('不同部位可以同時試穿，點同一件脫掉，同部位換成新的那件', () => {
    let t: TryOn = {};
    t = toggleTryOn(t, item('beanie'));
    t = toggleTryOn(t, item('cape'));
    assert.deepEqual(t, { 'head-top': 'beanie', back: 'cape' });

    t = toggleTryOn(t, item('beret'));
    assert.deepEqual(t, { 'head-top': 'beret', back: 'cape' }, '同部位互換，不會留兩件');

    t = toggleTryOn(t, item('cape'));
    assert.deepEqual(t, { 'head-top': 'beret' }, '點同一件就脫掉那個部位');
  });

  it('不改傳進來的物件', () => {
    const before: TryOn = { back: 'cape' };
    toggleTryOn(before, item('beanie'));
    assert.deepEqual(before, { back: 'cape' });
  });
});

describe('tryOnPreview', () => {
  it('試穿的疊在目前穿著上，其他部位照舊', () => {
    assert.deepEqual(
      tryOnPreview({ 'head-top': 'beanie', neck: 'bell' }, { 'head-top': 'dino-hood', back: 'cape' }),
      { 'head-top': 'dino-hood', neck: 'bell', back: 'cape' },
    );
  });
});

describe('tryOnBasket', () => {
  const capePrice = shopPrice('cape');
  const hoodBase = shopPrice('dino-hood');
  const hoodSale = hoodBase - 30;

  it('總價＝今天的價格（特價算特價），原價另外加總；照 SLOTS 的順序列出', () => {
    const statuses = [
      status('dino-hood', 'buyable', { price: hoodSale, base: hoodBase }),
      status('cape', 'buyable', { price: capePrice }),
    ];
    const b = tryOnBasket(statuses, { 'head-top': 'dino-hood', back: 'cape' }, 10_000);
    assert.deepEqual(
      b.items.map((s) => s.item.id),
      ['cape', 'dino-hood'],
      'SLOTS 的順序：背飾在頭頂前面',
    );
    assert.equal(b.total, hoodSale + capePrice);
    assert.equal(b.base, hoodBase + capePrice);
    assert.equal(b.short, 0);
  });

  it('買不買得起看整籃的合計：每件各自買得起、合起來不夠時要算出還差多少', () => {
    const raw = Math.max(capePrice, hoodBase) + 1;
    const statuses = [
      status('dino-hood', 'buyable', { price: hoodBase }),
      status('cape', 'buyable', { price: capePrice }),
    ];
    const b = tryOnBasket(statuses, { 'head-top': 'dino-hood', back: 'cape' }, raw);
    assert.equal(b.short, hoodBase + capePrice - raw);
  });

  it('原始餘額是負的也照算（不先夾成 0）', () => {
    const b = tryOnBasket([status('cape', 'short', { price: capePrice })], { back: 'cape' }, -20);
    assert.equal(b.short, capePrice + 20);
  });

  it('集章、成就送的配件留在籃子裡給她看，但不算進總價也不算進要買的', () => {
    const statuses = [
      status('cape', 'buyable', { price: capePrice }),
      status('grad-cap', 'achievement', { achievement: 'exam-80' }),
    ];
    const b = tryOnBasket(statuses, { back: 'cape', 'head-top': 'grad-cap' }, 10_000);
    assert.deepEqual(b.items.map((s) => s.item.id).sort(), ['cape', 'grad-cap']);
    assert.deepEqual(b.shop.map((s) => s.item.id), ['cape']);
    assert.equal(b.total, capePrice);
  });

  it('已經擁有、下架、不認得、部位對不上的試穿會被濾掉，tryOn 只留有效的', () => {
    const statuses = [
      status('cape', 'owned', { price: capePrice }),
      status('hachimaki', 'off', { price: shopPrice('hachimaki') }),
      status('beanie', 'buyable', { price: shopPrice('beanie') }),
    ];
    const b = tryOnBasket(
      statuses,
      // neck 放 beanie：部位對不上；face-mid 放不存在的 ID
      { back: 'cape', 'head-top': 'hachimaki', neck: 'beanie', 'face-mid': 'no-such-item' as ItemId },
      10_000,
    );
    assert.deepEqual(b.items, []);
    assert.deepEqual(b.tryOn, {});
    assert.equal(b.total, 0);

    const ok = tryOnBasket(statuses, { 'head-top': 'beanie' }, 10_000);
    assert.deepEqual(ok.tryOn, { 'head-top': 'beanie' });
  });
});

describe('tryOnEffects', () => {
  it('試穿湊出來的套裝效果標成要買下來才有；已經穿著就有的不標', () => {
    const fx = tryOnEffects({ back: 'cape' }, { 'head-top': 'dino-hood', body: 'dino-suit', 'face-low': 'fire-breath' });
    const byId = new Map(fx.active.map((a) => [a.id, a.pending]));
    assert.equal(byId.get('fly'), false, '披風本來就穿著');
    assert.equal(byId.get('scorch'), true, '噴火三件都還在試穿');
  });

  it('只差一件的提示照試穿後的樣子算', () => {
    const fx = tryOnEffects({}, { 'head-top': 'frog-hood' });
    assert.ok(fx.near.some((n) => n.id === 'hop'), '青蛙頭套＋任一連身裝就會一蹦一蹦');
    assert.equal(fx.active.length, 0);
  });
});
