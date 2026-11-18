// 每日特價：哪幾件特價、買的時候記下省多少、餘額、存檔、合併。開案書 docs/plans/cat-wardrobe.md §3.6。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dispatch } from '../core/commands';
import { STORAGE_KEY } from '../core/constants/round';
import { DAILY_SALE, ITEMS } from '../core/constants/wardrobe';
import { createWorld, type World } from '../core/world';
import { itemStatuses } from '../selectors/wardrobe';
import { createTestWorld } from '../testing/fixture';
import { attachPersistence, exportProgress, importProgress } from './persistence';
import { mergeWardrobe, type SyncWardrobe } from './syncMerge';
import { fishBalance, itemPrice, ownedItems, saleItems, wear } from './wardrobe';

/** 衝刺期間內的一天（testBank 的考試日是 2026-12-05） */
const DAY = new Date(2026, 10, 20, 12, 0, 0);
const at = () => DAY;
const price = (id: string): number => {
  const item = ITEMS.find((i) => i.id === id);
  assert.ok(item && item.source.kind === 'shop', id);
  return item.source.price;
};
const salePrice = (id: string) => Math.round(price(id) * (1 - DAILY_SALE.off));

/** 有很多小魚乾的 world（買東西不會卡在餘額） */
function richWorld(): World {
  const world = createTestWorld();
  for (let d = 17; d <= 19; d += 1) world.dayLog.set(`2026-11-${d}`, 60);
  return world;
}

function memoryStorage(initial: Record<string, string>) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

describe('wardrobe daily sale', () => {
  it('picks the same few shop items on any device for a given day, different ones on another day, never non-shop items', () => {
    const a = saleItems(richWorld(), DAY);
    const b = saleItems(createTestWorld(), DAY);
    assert.equal(a.size, DAILY_SALE.count);
    assert.deepEqual([...a], [...b]);
    for (const id of a) assert.equal(ITEMS.find((i) => i.id === id)?.source.kind, 'shop');
    // 兩個禮拜裡不會天天同一批
    const seen = new Set<string>();
    for (let d = 20; d <= 30; d += 1) seen.add([...saleItems(createTestWorld(), new Date(2026, 10, d, 12))].join(','));
    assert.ok(seen.size > 5);
    // 衝刺限定的配件不在衝刺期間時不會被挑到（那時候買不到）
    for (let d = 1; d <= 10; d += 1) {
      for (const id of saleItems(createTestWorld(), new Date(2026, 9, d, 12))) {
        assert.equal(ITEMS.find((i) => i.id === id)?.sprint ?? false, false);
      }
    }
  });

  it('buying one sale item does not put another item on sale', () => {
    const world = richWorld();
    const before = [...saleItems(world, DAY)];
    dispatch(world, { type: 'buyItem', id: before[0] as string }, { now: at });
    assert.ok(ownedItems(world).has(before[0] as string));
    assert.deepEqual([...saleItems(world, DAY)], before);
  });

  it('charges the sale price, remembers how much was saved, and a full-price purchase records nothing', () => {
    const world = richWorld();
    const sale = [...saleItems(world, DAY)];
    const onSale = sale[0] as string;
    const fullPrice = ITEMS.find((i) => i.source.kind === 'shop' && !i.sprint && !sale.includes(i.id))?.id as string;
    assert.deepEqual(itemPrice(world, onSale, DAY), { price: salePrice(onSale), base: price(onSale), sale: true });
    assert.deepEqual(itemPrice(world, fullPrice, DAY), { price: price(fullPrice), base: price(fullPrice), sale: false });
    assert.equal(itemPrice(world, 'bow', DAY), null);

    const start = fishBalance(world, DAY).raw;
    dispatch(world, { type: 'buyItem', id: onSale }, { now: at });
    assert.equal(fishBalance(world, DAY).raw, start - salePrice(onSale));
    assert.deepEqual(world.settings.wardrobe?.saved, { [onSale]: price(onSale) - salePrice(onSale) });

    dispatch(world, { type: 'buyItem', id: fullPrice }, { now: at });
    assert.equal(fishBalance(world, DAY).raw, start - salePrice(onSale) - price(fullPrice));
    assert.deepEqual(Object.keys(world.settings.wardrobe?.saved ?? {}), [onSale]);

    // 隔天不特價了，已經省下的不變；之後穿脫、解成就、做任務重寫衣櫥時紀錄還在
    const nextMonth = new Date(2026, 10, 29, 12);
    assert.equal(fishBalance(world, nextMonth).raw, start - salePrice(onSale) - price(fullPrice));
    const slot = ITEMS.find((i) => i.id === onSale)?.slot;
    assert.ok(slot);
    assert.equal(wear(world, slot, onSale), true);
    world.dayLog.set('2026-11-20', 200);
    world.bus.emit({ type: 'dayLogChanged', day: '2026-11-20', count: 200 });
    assert.deepEqual(world.settings.wardrobe?.saved, { [onSale]: price(onSale) - salePrice(onSale) });
  });

  it('a sale can make an item affordable, and the shop shows today price with the original', () => {
    const world = createTestWorld();
    const onSale = [...saleItems(world, DAY)].sort((x, y) => price(y) - price(x))[0] as string;
    // 把餘額花到剛好夠特價、不夠原價
    const pad = ITEMS.filter((i) => i.source.kind === 'shop' && !saleItems(world, DAY).has(i.id) && !i.sprint).map((i) => i.id);
    world.settings.wardrobe = { owned: [], achievements: [], quests: {} };
    for (const id of pad) {
      const raw = fishBalance(world, DAY).raw;
      if (raw - price(id) >= salePrice(onSale)) world.settings.wardrobe.owned.push(id);
    }
    const raw = fishBalance(world, DAY).raw;
    assert.ok(raw >= salePrice(onSale) && raw < price(onSale), `raw=${raw}`);
    const status = itemStatuses(world, DAY).find((s) => s.item.id === onSale);
    assert.deepEqual(
      { state: status?.state, price: status?.price, base: status?.base },
      { state: 'buyable', price: salePrice(onSale), base: price(onSale) },
    );
    // 同一件在沒特價的日子是原價、買不起、沒有 base
    const other = Array.from({ length: 20 }, (_, i) => new Date(2026, 10, 21 + i, 12)).find((d) => !saleItems(world, d).has(onSale));
    assert.ok(other);
    const later = itemStatuses(world, other).find((s) => s.item.id === onSale);
    assert.deepEqual({ state: later?.state, price: later?.price, base: later?.base }, { state: 'short', price: price(onSale), base: undefined });
  });

  it('saved amounts cannot inflate the balance: clamped to the item price, ignored for items not owned or unknown', () => {
    const world = createTestWorld();
    world.settings.wardrobe = { owned: ['beanie'], achievements: [], quests: {} };
    const honest = fishBalance(world, DAY);
    world.settings.wardrobe = {
      owned: ['beanie'],
      achievements: [],
      quests: {},
      saved: { beanie: 99999, wings: 300, 'future-item-v9': 500, bow: 50 },
    };
    // beanie 最多省到整件免費；沒買的、不認得的、不是商店的都不算
    assert.equal(fishBalance(world, DAY).raw, honest.raw + price('beanie'));
    assert.equal(fishBalance(world, DAY).spent, 0);
  });

  it('round-trips save-v5-wardrobe-saved.json unchanged, and drops only bad saved entries', () => {
    const raw = readFileSync(new URL('../testing/golden/save-v5-wardrobe-saved.json', import.meta.url), 'utf8');
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const world = createWorld();
    attachPersistence(world, storage);
    assert.deepEqual(world.settings.wardrobe?.saved, { beanie: 24, 'future-item-v9': 7 });
    assert.deepEqual(world.settings.wardrobe?.owned, ['beanie', 'future-item-v9', 'star-clip']);

    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY] ?? 'null'), JSON.parse(raw));

    const other = createWorld();
    assert.deepEqual(importProgress(other, exportProgress(world)), { ok: true });
    assert.deepEqual(other.settings.wardrobe, world.settings.wardrobe);

    const parsed = JSON.parse(raw) as { settings: { wardrobe: Record<string, unknown> } };
    for (const [bad, expected] of [
      [{ beanie: 24, bell: 'ten', cape: -5, wings: 0, mask: Number.NaN, sakura: 12.9 }, { beanie: 24, sakura: 12 }],
      ['not-an-object', undefined],
      [['beanie'], undefined],
      [{}, undefined],
    ] as const) {
      parsed.settings.wardrobe.saved = bad;
      const target = createWorld();
      assert.deepEqual(importProgress(target, JSON.stringify(parsed)), { ok: true });
      assert.deepEqual(target.settings.wardrobe?.saved, expected);
      // 其他欄位照常讀進來
      assert.deepEqual(target.settings.wardrobe?.owned, ['beanie', 'future-item-v9', 'star-clip']);
      assert.equal(target.progress.size, 1);
    }
  });

  it('merges saved amounts per item by taking the larger one, in either order, and adds no field when nobody saved anything', () => {
    const local: SyncWardrobe = { owned: ['beanie', 'cape'], achievements: [], quests: {}, saved: { beanie: 24, cape: 60 } };
    const remote: SyncWardrobe = { owned: ['bell', 'cape'], achievements: [], quests: {}, saved: { cape: 40, bell: 18 } };
    const lr = mergeWardrobe(local, remote);
    assert.deepEqual(lr, {
      owned: ['beanie', 'bell', 'cape'],
      achievements: [],
      quests: {},
      saved: { beanie: 24, bell: 18, cape: 60 },
    });
    assert.deepEqual(mergeWardrobe(remote, local), lr);
    assert.deepEqual(mergeWardrobe(lr, lr), lr);
    assert.deepEqual(mergeWardrobe(local, undefined).saved, { beanie: 24, cape: 60 });

    const plain: SyncWardrobe = { owned: ['beanie'], achievements: [], quests: {} };
    assert.equal('saved' in mergeWardrobe(plain, plain), false);
    assert.equal('saved' in mergeWardrobe(plain, undefined), false);
  });
});
