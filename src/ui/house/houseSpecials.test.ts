// 小屋裡的小貓也照穿著有套裝效果：步態（企鵝搖擺、肚子滑，青蛙兔子一蹦一蹦，乳牛站著走）、暴衝、披風飛、睡衣愛睡。
// 步態只讀 pet/petLogic 的 gaitFor（PET_GAITS），不另寫一份。本檔斷言不准為了讓測試通過而修改。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_SCENE } from '../../core/constants/house';
import { PET_GAIT_DEFAULT } from '../../core/constants/pet';
import type { OutfitSpecial } from '../../core/types';
import { gaitFor } from '../pet/petLogic';
import { actorPose, createInitialActors, decideNextAction, roomBounds, stepHouse, type HouseActor } from './houseLogic';

const BOUNDS = roomBounds(360, HOUSE_SCENE.height);
const specialsOf = (...ids: OutfitSpecial[]) => new Map([['cat-1', new Set<OutfitSpecial>(ids)]]);
const one = (rng: () => number = () => 0.5): HouseActor[] => createInitialActors(['cat-1'], BOUNDS, rng);

describe('house: outfit specials', () => {
  it('poses follow the gait: penguin waddles, rests upright and slides when zooming; plain cats unchanged', () => {
    const penguin = gaitFor(new Set<OutfitSpecial>(['slide', 'waddle']));
    const [a] = one();
    const base = { ...a!, hopMs: 0 };
    assert.equal(actorPose({ ...base, action: 'walk' }, penguin), penguin.walk);
    assert.equal(actorPose({ ...base, action: 'sit' }, penguin), penguin.rest);
    assert.equal(actorPose({ ...base, action: 'zoom' }, penguin), 'slide');
    assert.equal(actorPose({ ...base, action: 'groom' }, penguin), 'groom');
    assert.equal(actorPose({ ...base, action: 'loaf' }, penguin), 'loaf');
    // 不給步態＝平常的樣子（舊的呼叫照常）
    assert.equal(actorPose({ ...base, action: 'walk' }), PET_GAIT_DEFAULT.walk);
    assert.equal(actorPose({ ...base, action: 'zoom' }), PET_GAIT_DEFAULT.zoom);
    assert.equal(actorPose({ ...base, action: 'fly' }), 'fly');
  });

  it('a zoom runs to the far side of the room, faster than walking, and stays inside the floor', () => {
    const start = one(() => 0.2);
    // 挑動作的骰子擲到最後一格＝暴衝（zoom 排在可挑動作的最後）
    const next = decideNextAction('cat-1', start, BOUNDS, () => 0.999);
    const me = next[0]!;
    assert.equal(me.action, 'zoom');
    assert.ok(me.target);
    assert.ok(Math.abs(me.target!.x - start[0]!.x) >= (BOUNDS.maxX - BOUNDS.minX) / 2, 'goes far');
    assert.ok(me.target!.x >= BOUNDS.minX && me.target!.x <= BOUNDS.maxX);
    const moved = stepHouse(next, 100, BOUNDS, () => 0.5)[0]!;
    const walked = Math.hypot(moved.x - me.x, moved.y - me.y);
    assert.ok(walked > HOUSE_SCENE.walkSpeed * 0.1 * 1.5, `zoom moved ${walked}`);
  });

  it('reduced motion never zooms or flies', () => {
    const start = one();
    for (const r of [0, 0.3, 0.6, 0.999]) {
      const me = decideNextAction('cat-1', start, BOUNDS, () => r, { reducedMotion: true, specials: specialsOf('fly') })[0]!;
      assert.ok(me.action !== 'zoom' && me.action !== 'fly' && me.action !== 'walk', me.action);
    }
  });

  it('with a cape, a walk or zoom sometimes becomes a flight across the room (pose fly)', () => {
    const start = one(() => 0.2);
    // 骰子小於 flyChance：改用飛的
    const me = decideNextAction('cat-1', start, BOUNDS, () => 0.0, { specials: specialsOf('fly') })[0]!;
    assert.equal(me.action, 'fly');
    assert.equal(actorPose(me), 'fly');
    assert.ok(me.target && me.target.x >= BOUNDS.minX && me.target.x <= BOUNDS.maxX);
    // 沒有披風的不會飛
    const plain = decideNextAction('cat-1', start, BOUNDS, () => 0.0)[0]!;
    assert.notEqual(plain.action, 'fly');
  });

  it('the pajama set naps more often', () => {
    const start = one();
    const naps = (specials?: Map<string, Set<OutfitSpecial>>) => {
      let n = 0;
      for (let i = 0; i < 400; i += 1) {
        const r = (i + 0.5) / 400;
        const me = decideNextAction('cat-1', start, BOUNDS, () => r, specials ? { specials } : {})[0]!;
        if (me.action === 'loaf') n += 1;
      }
      return n;
    };
    assert.ok(naps(specialsOf('dream')) > naps() * 1.5, `${naps(specialsOf('dream'))} vs ${naps()}`);
  });
});
