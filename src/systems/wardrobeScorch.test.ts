// 特殊動作與燒焦：哪身穿著有什麼動作、燒焦與修復、餘額、存檔、合併。開案書 docs/plans/cat-wardrobe.md §3.7。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dispatch } from '../core/commands';
import { STORAGE_KEY } from '../core/constants/round';
import { OUTFIT_SPECIALS, SCORCH } from '../core/constants/wardrobe';
import { createWorld, type World } from '../core/world';
import { createTestWorld } from '../testing/fixture';
import { attachPersistence, exportProgress, importProgress } from './persistence';
import { mergeWardrobe, toSyncWardrobe, type SyncWardrobe } from './syncMerge';
import { applySyncedWardrobe, fishBalance, outfitSpecialHints, outfitSpecials, parseScorchSpot, scorchSpotId, scorchedSpots } from './wardrobe';

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

describe('outfit specials', () => {
  it('needs every listed slot: a cape flies; fire needs the whole dino set plus the flame', () => {
    assert.deepEqual([...outfitSpecials({})], []);
    assert.deepEqual([...outfitSpecials({ back: 'cape' })], ['fly']);
    assert.deepEqual([...outfitSpecials({ back: 'wings' })], []);
    const dino = { 'head-top': 'dino-hood', body: 'dino-suit', 'face-low': 'fire-breath' };
    assert.deepEqual([...outfitSpecials(dino)], ['scorch']);
    assert.deepEqual([...outfitSpecials({ ...dino, 'face-low': 'carrot' })], []);
    assert.deepEqual([...outfitSpecials({ ...dino, body: 'bear-suit' })], []);
    assert.deepEqual([...outfitSpecials({ 'head-top': 'dino-hood', body: 'dino-suit' })], []);
    assert.deepEqual([...outfitSpecials({ ...dino, back: 'cape' })].sort(), ['fly', 'scorch']);
    // 其他四套：全套加自己的嘴邊裝飾才有；青蛙、兔子的頭套加連身裝就會一蹦一蹦（可以混搭）
    const set = (hood: string, suit: string, mouth?: string) => ({ 'head-top': hood, body: suit, ...(mouth ? { 'face-low': mouth } : {}) });
    assert.deepEqual([...outfitSpecials(set('frog-hood', 'frog-suit', 'frog-bubble'))].sort(), ['bubbles', 'hop']);
    assert.deepEqual([...outfitSpecials(set('frog-hood', 'frog-suit'))], ['hop']);
    assert.deepEqual([...outfitSpecials(set('bunny-hood', 'bunny-suit', 'carrot'))].sort(), ['binky', 'hop']);
    assert.deepEqual([...outfitSpecials(set('frog-hood', 'bunny-suit', 'carrot'))], ['hop']);
    assert.deepEqual([...outfitSpecials(set('bear-hood', 'bear-suit', 'honey-dipper'))], ['honey']);
    assert.deepEqual([...outfitSpecials(set('bear-hood', 'bear-suit', 'carrot'))], []);
    assert.deepEqual([...outfitSpecials(set('pajama-hood', 'pajama-suit', 'pacifier'))], ['dream']);
    assert.deepEqual([...outfitSpecials(set('pajama-hood', 'bear-suit', 'pacifier'))], []);
    // 表裡的每一列至少要有一個部位（空的條件會讓每隻貓都有那個動作）
    for (const special of OUTFIT_SPECIALS) assert.ok(Object.keys(special.wear).length > 0, special.id);
  });
});

describe('outfit special hints for the wardrobe', () => {
  it('lists what is active, and what is one piece away (naming the missing piece)', () => {
    assert.deepEqual(outfitSpecialHints({}), { active: [], near: [] });
    const fly = outfitSpecialHints({ back: 'cape' });
    assert.deepEqual(fly.active.map((fx) => fx.id), ['fly']);
    assert.deepEqual(fly.near, []);
    const twoThirds = outfitSpecialHints({ 'head-top': 'dino-hood', body: 'dino-suit' });
    assert.deepEqual(twoThirds.active, []);
    assert.deepEqual(twoThirds.near.map((fx) => [fx.id, fx.missing]), [['scorch', ['噴火']]]);
    const frog = outfitSpecialHints({ 'head-top': 'frog-hood', body: 'frog-suit' });
    assert.deepEqual(frog.active.map((fx) => fx.id), ['hop']);
    assert.deepEqual(frog.near.map((fx) => [fx.id, fx.missing]), [['bubbles', ['吹泡泡']]]);
    // 只戴青蛙頭套：差連身裝就會一蹦一蹦（青蛙裝或兔子裝都行）；差兩件的不提
    const hood = outfitSpecialHints({ 'head-top': 'frog-hood' });
    assert.deepEqual(hood.near.map((fx) => [fx.id, fx.missing]), [['hop', ['青蛙裝', '兔子裝']]]);
    // 單一件就成立的（披風）沒穿時不算「只差一件」
    assert.ok(!outfitSpecialHints({ 'head-top': 'crown' }).near.some((fx) => fx.id === 'fly'));
    for (const fx of outfitSpecialHints({ back: 'cape', 'head-top': 'dino-hood', body: 'dino-suit', 'face-low': 'fire-breath' }).active) {
      assert.ok(fx.name.length > 0 && fx.text.length > 0, fx.id);
    }
  });
});

describe('scorch and repair', () => {
  it('names a burnt spot by card and place; a spot saved without a place (first version) is the right side', () => {
    assert.equal(scorchSpotId('today-quest', 'l'), 'today-quest@l');
    for (const place of SCORCH.places) {
      assert.deepEqual(parseScorchSpot(scorchSpotId('cat-today', place)), { card: 'cat-today', place });
    }
    assert.deepEqual(parseScorchSpot('today-quest'), { card: 'today-quest', place: 'r' });
    assert.deepEqual(parseScorchSpot('future-spot-v9'), { card: 'future-spot-v9', place: 'r' });
    assert.deepEqual(parseScorchSpot('card@somewhere-new'), { card: 'card@somewhere-new', place: 'r' });
  });

  it('scorching is cosmetic and capped; repairing costs a few fish and is remembered', () => {
    const world = richWorld();
    const before = fishBalance(world).raw;

    dispatch(world, { type: 'scorch', spot: 'today-quest' });
    dispatch(world, { type: 'scorch', spot: 'today-quest' });
    assert.deepEqual(scorchedSpots(world), ['today-quest']);
    assert.equal(fishBalance(world).raw, before, '燒焦不扣小魚乾');

    for (let i = 0; i < SCORCH.max + 2; i += 1) dispatch(world, { type: 'scorch', spot: `spot-${i}` });
    assert.equal(scorchedSpots(world).length, SCORCH.max);

    dispatch(world, { type: 'repairScorch', spot: 'not-burnt' });
    assert.equal(fishBalance(world).raw, before, '沒燒焦的地方不能修、不扣錢');

    dispatch(world, { type: 'repairScorch', spot: 'today-quest' });
    assert.ok(!scorchedSpots(world).includes('today-quest'));
    assert.equal(world.settings.wardrobe?.repairs, 1);
    assert.equal(fishBalance(world).raw, before - SCORCH.repairFish);

    for (const spot of scorchedSpots(world)) dispatch(world, { type: 'repairScorch', spot });
    assert.equal(world.settings.wardrobe?.repairs, SCORCH.max);
    assert.equal(fishBalance(world).raw, before - SCORCH.repairFish * SCORCH.max);
    // 全部修好：scorch 那一欄不留
    assert.equal('scorch' in (world.settings.wardrobe ?? {}), false);
  });

  it('cannot repair without enough fish (the mark just stays)', () => {
    const world = createTestWorld();
    world.settings = { ...world.settings, wardrobe: { owned: ['wings', 'moon', 'cape'], achievements: [], quests: {} } };
    assert.ok(fishBalance(world).raw < SCORCH.repairFish);
    dispatch(world, { type: 'scorch', spot: 'today-quest' });
    dispatch(world, { type: 'repairScorch', spot: 'today-quest' });
    assert.deepEqual(scorchedSpots(world), ['today-quest']);
    assert.equal(world.settings.wardrobe?.repairs, undefined);
  });

  it('a world that never burnt anything keeps the old save shape', () => {
    const world = richWorld();
    dispatch(world, { type: 'buyItem', id: 'bell' });
    assert.equal('repairs' in (world.settings.wardrobe ?? {}), false);
    assert.equal('scorch' in (world.settings.wardrobe ?? {}), false);
    assert.equal('repairs' in toSyncWardrobe(world.settings.wardrobe), false);
  });

  it('syncs the repair count (larger wins, either order) but never the marks; marks on this device survive a sync', () => {
    const local: SyncWardrobe = { owned: ['bell'], achievements: [], quests: {}, repairs: 2 };
    const remote: SyncWardrobe = { owned: ['bell'], achievements: [], quests: {}, repairs: 5 };
    assert.equal(mergeWardrobe(local, remote).repairs, 5);
    assert.equal(mergeWardrobe(remote, local).repairs, 5);
    assert.equal(mergeWardrobe(local, { owned: [], achievements: [], quests: {} }).repairs, 2);
    assert.equal('repairs' in mergeWardrobe({ owned: [], achievements: [], quests: {} }, undefined), false);

    const world = richWorld();
    dispatch(world, { type: 'scorch', spot: 'today-quest' });
    assert.equal('scorch' in toSyncWardrobe(world.settings.wardrobe), false);
    applySyncedWardrobe(world, mergeWardrobe(toSyncWardrobe(world.settings.wardrobe), remote));
    assert.deepEqual(scorchedSpots(world), ['today-quest']);
    assert.equal(world.settings.wardrobe?.repairs, 5);
  });

  it('round-trips save-v6-wardrobe-scorch.json unchanged, and drops only bad values', () => {
    const raw = readFileSync(new URL('../testing/golden/save-v6-wardrobe-scorch.json', import.meta.url), 'utf8');
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const world = createWorld();
    attachPersistence(world, storage);
    assert.equal(world.settings.wardrobe?.repairs, 2);
    assert.deepEqual(world.settings.wardrobe?.scorch, ['today-quest', 'future-spot-v9']);
    assert.deepEqual(world.settings.wardrobe?.saved, { beanie: 24, 'future-item-v9': 7 });

    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY] ?? 'null'), JSON.parse(raw));

    const other = createWorld();
    assert.deepEqual(importProgress(other, exportProgress(world)), { ok: true });
    assert.deepEqual(other.settings.wardrobe, world.settings.wardrobe);

    const parsed = JSON.parse(raw) as { settings: { wardrobe: Record<string, unknown> } };
    for (const [repairs, scorch, wantRepairs, wantScorch] of [
      [-3, 'today-quest', undefined, undefined],
      ['two', [1, 2], undefined, undefined],
      [2.9, ['a', 'a', 'b'], 2, ['a', 'b']],
      [0, [], undefined, undefined],
    ] as const) {
      parsed.settings.wardrobe.repairs = repairs;
      parsed.settings.wardrobe.scorch = scorch;
      const target = createWorld();
      assert.deepEqual(importProgress(target, JSON.stringify(parsed)), { ok: true });
      assert.equal(target.settings.wardrobe?.repairs, wantRepairs);
      assert.deepEqual(target.settings.wardrobe?.scorch, wantScorch);
      assert.deepEqual(target.settings.wardrobe?.owned, ['beanie', 'future-item-v9', 'star-clip']);
      assert.equal(target.progress.size, 1);
    }
  });
});
