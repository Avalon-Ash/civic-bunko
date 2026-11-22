// 鴨子裝與背飾單件特效的純函式（docs/plans/back-specials.md）：亂跑的小貓與小屋共用。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_SCENE } from '../../core/constants/house';
import { PET_DUCK, PET_FLOAT, PET_GLIDE, PET_ROCKET, PET_SLIME } from '../../core/constants/pet';
import type { OutfitSpecial } from '../../core/types';
import { outfitSpecials } from '../../selectors/wardrobe';
import { actorLift, houseMark, stepDucks, stepHouse, type HouseActor } from '../house/houseLogic';
import { ducklingTargets, fallCap, floatHeight, gaitFor, landsSoftly, pushTrail, speedFactor } from './petLogic';

const set = (...ids: OutfitSpecial[]) => new Set<OutfitSpecial>(ids);

describe('back items and the duck suit: shared rules', () => {
  it('speed: the snail is slow, the balloon a bit slow, the rocket only speeds up a zoom', () => {
    assert.equal(speedFactor(set(), false), 1);
    assert.equal(speedFactor(set('slime'), false), PET_SLIME.speed);
    assert.equal(speedFactor(set('float'), true), PET_FLOAT.speed);
    assert.equal(speedFactor(set('rocket'), false), 1);
    assert.equal(speedFactor(set('rocket'), true), PET_ROCKET.speed);
  });

  it('falling: wings and balloon cap the fall speed (balloon slower) and land without stumbling', () => {
    assert.equal(fallCap(set()), Number.POSITIVE_INFINITY);
    assert.equal(fallCap(set('glide')), PET_GLIDE.maxVy);
    assert.equal(fallCap(set('float', 'glide')), PET_FLOAT.maxVy);
    assert.ok(PET_FLOAT.maxVy < PET_GLIDE.maxVy);
    assert.equal(landsSoftly(set('fly')), false);
    assert.equal(landsSoftly(set('glide')), true);
  });

  it('the balloon floats above the ground while walking, bobbing around its lift', () => {
    for (let t = 0; t < 4000; t += 250) {
      const h = floatHeight(t);
      assert.ok(h >= PET_FLOAT.lift - PET_FLOAT.bob - 1e-9 && h <= PET_FLOAT.lift + PET_FLOAT.bob + 1e-9);
    }
  });

  it('the duck suit waddles; the full set also feeds', () => {
    const suit = outfitSpecials({ 'head-top': 'duck-hood', body: 'duck-suit' });
    assert.equal(gaitFor(suit).walk, 'waddle');
    assert.equal(gaitFor(suit).rest, 'sit');
  });

  it('ducklings line up along the path the cat walked, gap apart; with no path they wait behind', () => {
    let trail: number[] = [];
    for (let x = 0; x <= 200; x += 5) trail = pushTrail(trail, x, 5);
    assert.deepEqual(ducklingTargets(trail, 200, 2, 30, -1), [170, 140]);
    assert.deepEqual(ducklingTargets([], 100, 2, 30, 1), [130, 160]);
    // 走回頭：小鴨沿著原路，不抄近路
    let back = trail;
    for (let x = 195; x >= 180; x -= 5) back = pushTrail(back, x, 5);
    assert.deepEqual(ducklingTargets(back, 180, 1, 30, -1), [190]);
    // 只留最近的 PET_DUCK.trail 點
    let long: number[] = [];
    for (let x = 0; x < PET_DUCK.trail * 3; x += 1) long = pushTrail(long, x * 10, 5);
    assert.equal(long.length, PET_DUCK.trail);
  });
});

describe('house: ducklings, wings and balloon', () => {
  const bounds = { minX: 40, maxX: 320, minY: 10, maxY: 70, width: 360, floorHeight: 78 };
  const base: HouseActor = { id: 'cat-1', x: 200, y: 40, facing: 'right', action: 'sit', remainMs: 5_000, hopMs: 0 };

  it('ducklings appear behind the cat only while it wears the duck suit, and follow one after another', () => {
    const on = stepDucks(base, true, 16);
    assert.equal(on.ducks?.length, HOUSE_SCENE.duck.count);
    assert.ok((on.ducks?.[0]?.x ?? 0) < base.x, 'facing right → behind is to the left');
    assert.equal(stepDucks(on, false, 16).ducks, undefined);

    // 小貓走遠了：第一隻追小貓、第二隻追第一隻，都停在 gap 外
    let a: HouseActor = { ...on, x: 320 };
    for (let i = 0; i < 300; i += 1) a = stepDucks(a, true, 50);
    const [d1, d2] = a.ducks ?? [];
    assert.ok(d1 && d2);
    assert.ok(Math.abs(Math.hypot(a.x - d1.x, a.y - d1.y) - HOUSE_SCENE.duck.gap) < 0.5);
    assert.ok(Math.abs(Math.hypot(d1.x - d2.x, d1.y - d2.y) - HOUSE_SCENE.duck.gap) < 0.5);
    assert.equal(d1.walking, false);
  });

  it('stepHouse keeps ducks for duck-suit cats only', () => {
    const specials = new Map([['cat-1', outfitSpecials({ 'head-top': 'duck-hood', body: 'duck-suit' })]]);
    const [withDucks] = stepHouse([base], 16, bounds, () => 0.5, { specials });
    assert.equal(withDucks?.ducks?.length, HOUSE_SCENE.duck.count);
    const [plain] = stepHouse([base], 16, bounds, () => 0.5, {});
    assert.equal(plain?.ducks, undefined);
  });

  it('wings hover: rise fast, then come down slowly; balloon floats only while walking', () => {
    const hover: HouseActor = { ...base, action: 'hover', origin: { x: 100, y: 40 }, target: { x: 300, y: 40 }, x: 100 };
    const at = (x: number) => actorLift({ ...hover, x });
    assert.equal(at(100), 0);
    assert.ok(Math.abs(at(100 + 200 * HOUSE_SCENE.hoverRise) - HOUSE_SCENE.flyLift) < 1e-9);
    assert.ok(at(250) > 0 && at(250) < HOUSE_SCENE.flyLift);
    assert.ok(Math.abs(at(300)) < 1e-9);

    const walk: HouseActor = { ...base, action: 'walk', origin: { x: 100, y: 40 }, target: { x: 300, y: 40 }, x: 200 };
    const balloon = outfitSpecials({ back: 'balloon' });
    assert.ok(actorLift(walk, undefined, balloon) > 0);
    assert.equal(actorLift(walk), 0);
    assert.equal(actorLift({ ...walk, x: 100 }, undefined, balloon), 0, 'starts on the ground');
    assert.equal(actorLift({ ...base }, undefined, balloon), 0, 'sitting is on the ground');
  });

  it('the snail leaves a trail while walking, the rocket puffs behind it while zooming, stride apart', () => {
    const snail = outfitSpecials({ back: 'snail-shell' });
    const rocket = outfitSpecials({ back: 'rocket-pack' });
    const walk: HouseActor = { ...base, action: 'walk', target: { x: 300, y: 40 }, origin: { x: 100, y: 40 } };
    assert.deepEqual(houseMark(walk, snail, undefined, 20), { kind: 'trail', x: 200, y: 40 });
    assert.equal(houseMark(walk, snail, { x: 200 - PET_SLIME.stride / 2, y: 40 }, 20), null, 'too close to the last one');
    assert.ok(houseMark(walk, snail, { x: 200 - PET_SLIME.stride, y: 40 }, 20));
    assert.equal(houseMark({ ...walk, action: 'sit' }, snail, undefined, 20), null);
    assert.equal(houseMark(walk, rocket, undefined, 20), null, 'rocket only puffs on a zoom');
    const zoom: HouseActor = { ...walk, action: 'zoom' };
    assert.deepEqual(houseMark(zoom, rocket, undefined, 20), { kind: 'puff', x: 180, y: 40 }, 'facing right → puff on the left');
    assert.deepEqual(houseMark({ ...zoom, facing: 'left' }, rocket, undefined, 20), { kind: 'puff', x: 220, y: 40 });
    assert.equal(houseMark(zoom, rocket, { x: 200 - PET_ROCKET.stride / 2, y: 40 }, 20), null);
    assert.equal(houseMark(zoom, undefined, undefined, 20), null);
  });
});
