// 小貓之家：領養、各自取名與換裝、帶出門、陪我刷題。規則在 docs/plans/cat-house.md §3、§4。
// 只經 dispatch（UICommand）寫、經 selectors/house 讀；本檔的斷言不准為了讓測試通過而修改。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { CAT_CHARACTER } from '../core/constants/catLines';
import { HOUSE, HOUSE_ADOPT, HOUSE_FIRST_CAT, HOUSE_MAX_CATS } from '../core/constants/house';
import { WARDROBE_START_DAY } from '../core/constants/wardrobe';
import type { UICommand } from '../core/types';
import { createWorld, type World } from '../core/world';
import { catOutfit, houseCats, leaderCat, nextAdoption, outingCats } from '../selectors/house';
import { currentOutfit, fishBalance } from './wardrobe';

const NOW = new Date(`${WARDROBE_START_DAY}T12:00:00`);
const at = (iso: string) => ({ now: () => new Date(iso) });
const run = (world: World, cmd: UICommand, iso = NOW.toISOString()) => dispatch(world, cmd, at(iso));

/** 給一大筆小魚乾（從 WARDROBE_START_DAY 那天的題數算出來，跟真的一樣） */
function rich(world: World): World {
  world.dayLog.set(WARDROBE_START_DAY, 2_000);
  return world;
}

function withOwned(world: World, owned: string[]): World {
  world.settings.wardrobe = { owned, achievements: [], quests: {} };
  return world;
}

function adoptAll(world: World): void {
  for (let i = 0; i < HOUSE_ADOPT.length; i += 1) run(world, { type: 'adoptCat' });
}

describe('cat house', () => {
  it('starts with only the first cat, who is the leader and goes out', () => {
    const world = createWorld();
    const cats = houseCats(world);
    assert.equal(cats.length, 1);
    assert.equal(cats[0]?.id, HOUSE_FIRST_CAT);
    assert.equal(cats[0]?.name, CAT_CHARACTER.defaultName);
    assert.equal(cats[0]?.named, null);
    assert.equal(cats[0]?.leader, true);
    assert.equal(cats[0]?.out, true);
    assert.equal(leaderCat(world), HOUSE_FIRST_CAT);
    assert.deepEqual(outingCats(world), [HOUSE_FIRST_CAT]);
    assert.deepEqual(nextAdoption(world, NOW), { cat: 'cat-2', price: HOUSE_ADOPT[0]?.price, short: 0 });
    assert.equal(HOUSE_MAX_CATS, 5);
  });

  it('adopts the free second cat with a name and an owned fur, recorded in owned', () => {
    const world = withOwned(createWorld(), ['fur-orange']);
    run(world, { type: 'adoptCat', name: '麻糬', fur: 'fur-orange' }, '2026-11-22T01:00:00.000Z');
    assert.ok(world.settings.wardrobe?.owned.includes('adopt-cat-2'));
    const cat2 = houseCats(world).find((c) => c.id === 'cat-2');
    assert.equal(cat2?.name, '麻糬');
    assert.equal(cat2?.named, '麻糬');
    assert.deepEqual(cat2?.outfit, { fur: 'fur-orange' });
    assert.equal(world.settings.wardrobe?.cats?.['cat-2']?.nameAt, '2026-11-22T01:00:00.000Z');
    // 原本那隻不受影響
    assert.equal(world.settings.catName, undefined);
    assert.deepEqual(currentOutfit(world), {});
  });

  it('an unnamed adopted cat shows its default name; a fur she does not own is ignored', () => {
    const world = createWorld();
    run(world, { type: 'adoptCat', fur: 'fur-black' });
    const cat2 = houseCats(world).find((c) => c.id === 'cat-2');
    assert.equal(cat2?.name, HOUSE_ADOPT[0]?.defaultName);
    assert.equal(cat2?.named, null);
    assert.deepEqual(cat2?.outfit, {});
  });

  it('later cats cost fish: not enough fish does nothing, enough fish spends exactly the price', () => {
    const poor = createWorld();
    run(poor, { type: 'adoptCat' });
    const short = nextAdoption(poor, NOW);
    assert.equal(short?.cat, 'cat-3');
    const balance = fishBalance(poor, NOW).raw;
    if ((short?.price ?? 0) > balance) {
      assert.equal(short?.short, (short?.price ?? 0) - balance);
      run(poor, { type: 'adoptCat' });
      assert.equal(houseCats(poor).length, 2);
    }

    const world = rich(createWorld());
    run(world, { type: 'adoptCat' });
    const before = fishBalance(world, NOW).spent;
    run(world, { type: 'adoptCat' });
    assert.equal(houseCats(world).length, 3);
    assert.equal(fishBalance(world, NOW).spent - before, HOUSE_ADOPT[1]?.price);
  });

  it('stops at the house limit', () => {
    const world = rich(createWorld());
    adoptAll(world);
    assert.equal(houseCats(world).length, HOUSE_MAX_CATS);
    assert.equal(nextAdoption(world, NOW), null);
    const spent = fishBalance(world, NOW).spent;
    run(world, { type: 'adoptCat' });
    assert.equal(houseCats(world).length, HOUSE_MAX_CATS);
    assert.equal(fishBalance(world, NOW).spent, spent);
  });

  it('lists cats in house order and ignores cats this version does not know', () => {
    const world = withOwned(createWorld(), ['adopt-cat-3', 'adopt-cat-9']);
    world.settings.wardrobe = { ...world.settings.wardrobe!, cats: { 'cat-9': { name: '未來貓' } } };
    assert.deepEqual(
      houseCats(world).map((c) => c.id),
      [HOUSE_FIRST_CAT, 'cat-3'],
    );
    assert.equal(nextAdoption(world, NOW)?.cat, 'cat-2');
  });

  it('dresses each cat separately; the same item can be worn by several cats at once', () => {
    const world = withOwned(createWorld(), ['beanie', 'fur-orange']);
    run(world, { type: 'adoptCat' });
    run(world, { type: 'wear', slot: 'head-top', item: 'beanie' }, '2026-11-22T02:00:00.000Z');
    run(world, { type: 'wear', slot: 'head-top', item: 'beanie', cat: 'cat-2' }, '2026-11-22T02:01:00.000Z');
    run(world, { type: 'wear', slot: 'fur', item: 'fur-orange', cat: 'cat-2' }, '2026-11-22T02:02:00.000Z');
    assert.deepEqual(catOutfit(world, HOUSE_FIRST_CAT), { 'head-top': 'beanie' });
    assert.deepEqual(catOutfit(world, HOUSE_FIRST_CAT), currentOutfit(world));
    assert.deepEqual(catOutfit(world, 'cat-2'), { 'head-top': 'beanie', fur: 'fur-orange' });
    assert.equal(world.settings.wardrobe?.outfitAt, '2026-11-22T02:00:00.000Z');
    assert.equal(world.settings.wardrobe?.cats?.['cat-2']?.outfitAt, '2026-11-22T02:02:00.000Z');

    // 脫掉只脫那一隻
    run(world, { type: 'wear', slot: 'head-top', item: null, cat: 'cat-2' }, '2026-11-22T02:03:00.000Z');
    assert.deepEqual(catOutfit(world, 'cat-2'), { fur: 'fur-orange' });
    assert.deepEqual(catOutfit(world, HOUSE_FIRST_CAT), { 'head-top': 'beanie' });

    // 還沒領養的、沒買的：不動作
    run(world, { type: 'wear', slot: 'head-top', item: 'beanie', cat: 'cat-3' });
    assert.equal(world.settings.wardrobe?.cats?.['cat-3'], undefined);
    run(world, { type: 'wear', slot: 'fur', item: 'fur-black', cat: 'cat-2' });
    assert.deepEqual(catOutfit(world, 'cat-2'), { fur: 'fur-orange' });
  });

  it('change times only move forward, even when the clock does not', () => {
    const world = withOwned(createWorld(), ['beanie', 'scarf']);
    run(world, { type: 'adoptCat' });
    const t = '2026-11-22T02:00:00.000Z';
    run(world, { type: 'wear', slot: 'head-top', item: 'beanie', cat: 'cat-2' }, t);
    run(world, { type: 'setCatName', name: '麻糬', cat: 'cat-2' }, t);
    const first = world.settings.wardrobe?.cats?.['cat-2'];
    run(world, { type: 'wear', slot: 'head-top', item: null, cat: 'cat-2' }, t);
    run(world, { type: 'setCatName', name: '湯圓', cat: 'cat-2' }, t);
    const second = world.settings.wardrobe?.cats?.['cat-2'];
    assert.ok(Date.parse(second?.outfitAt ?? '') > Date.parse(first?.outfitAt ?? ''));
    assert.ok(Date.parse(second?.nameAt ?? '') > Date.parse(first?.nameAt ?? ''));
  });

  it('names each cat separately; without a cat the name goes to the first cat as before', () => {
    const world = createWorld();
    run(world, { type: 'adoptCat' });
    run(world, { type: 'setCatName', name: '阿福' }, '2026-11-22T03:00:00.000Z');
    run(world, { type: 'setCatName', name: '麻糬', cat: 'cat-2' }, '2026-11-22T03:01:00.000Z');
    assert.equal(world.settings.catName, '阿福');
    assert.equal(world.settings.catNameAt, '2026-11-22T03:00:00.000Z');
    assert.equal(houseCats(world).find((c) => c.id === 'cat-2')?.name, '麻糬');
    run(world, { type: 'setCatName', name: '', cat: 'cat-2' }, '2026-11-22T03:02:00.000Z');
    const cat2 = houseCats(world).find((c) => c.id === 'cat-2');
    assert.equal(cat2?.named, null);
    assert.equal(cat2?.name, HOUSE_ADOPT[0]?.defaultName);
    assert.equal(world.settings.wardrobe?.cats?.['cat-2']?.nameAt, '2026-11-22T03:02:00.000Z');
    // 還沒領養的不能取名
    run(world, { type: 'setCatName', name: '布丁', cat: 'cat-4' });
    assert.equal(world.settings.wardrobe?.cats?.['cat-4'], undefined);
  });

  it('takes the first few cats out by default, and never more than HOUSE.maxOut', () => {
    const world = rich(createWorld());
    adoptAll(world);
    const ids = houseCats(world).map((c) => c.id);
    assert.deepEqual(outingCats(world), ids.slice(0, HOUSE.maxOut));

    run(world, { type: 'setCatOuting', cat: 'cat-4', on: true });
    assert.deepEqual(outingCats(world), ids.slice(0, HOUSE.maxOut));
    run(world, { type: 'setCatOuting', cat: 'cat-2', on: false });
    run(world, { type: 'setCatOuting', cat: 'cat-4', on: true });
    assert.deepEqual(outingCats(world), [HOUSE_FIRST_CAT, 'cat-3', 'cat-4']);
    assert.deepEqual(
      houseCats(world).filter((c) => c.out).map((c) => c.id),
      [HOUSE_FIRST_CAT, 'cat-3', 'cat-4'],
    );
    // 可以一隻都不帶
    for (const id of outingCats(world)) run(world, { type: 'setCatOuting', cat: id, on: false });
    assert.deepEqual(outingCats(world), []);
  });

  it('has exactly one leader; a cat not in the house cannot lead', () => {
    const world = createWorld();
    run(world, { type: 'adoptCat' });
    run(world, { type: 'setLeader', cat: 'cat-2' });
    assert.equal(leaderCat(world), 'cat-2');
    assert.deepEqual(
      houseCats(world).filter((c) => c.leader).map((c) => c.id),
      ['cat-2'],
    );
    run(world, { type: 'setLeader', cat: 'cat-4' });
    assert.equal(leaderCat(world), 'cat-2');
    // 存檔裡的領頭不在家（例如另一台的資料）時，回到原本那隻
    world.settings.wardrobe = { ...world.settings.wardrobe!, leader: 'cat-5' };
    assert.equal(leaderCat(world), HOUSE_FIRST_CAT);
  });

  it('house settings (outing, leader) never touch the old fields the old app validates', () => {
    const world = createWorld();
    world.settings.accessory = 'bow';
    run(world, { type: 'adoptCat' });
    run(world, { type: 'setLeader', cat: 'cat-2' });
    run(world, { type: 'setCatOuting', cat: HOUSE_FIRST_CAT, on: false });
    assert.equal(world.settings.accessory, 'bow');
  });
});
