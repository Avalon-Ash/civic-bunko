import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RoamBehavior } from '../../core/types';
import { ROAM_ROUTES } from '../../core/constants/pet';
import { clamp, jumpPoint, perchOffset, pickBehavior, pickWalkTarget, stepWalk } from './petLogic';

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

const weights: Record<RoamBehavior, number> = { walk: 1, sit: 1, groom: 1, nap: 1, perch: 1, zoom: 1 };

describe('pet logic', () => {
  it('pickBehavior follows the weights and skips zero-weight behaviors', () => {
    assert.equal(pickBehavior(weights, () => 0), 'walk');
    assert.equal(pickBehavior(weights, () => 0.999), 'zoom');
    assert.equal(pickBehavior({ ...weights, walk: 0 }, () => 0), 'sit');
  });

  it('calm mode only picks staying-put behaviors', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const b = pickBehavior(weights, () => r, { calm: true });
      assert.ok(['sit', 'groom', 'nap'].includes(b), b);
    }
  });

  it('unavailable behaviors are never picked, and an empty pool falls back to sit', () => {
    for (let r = 0; r < 1; r += 0.05) {
      assert.notEqual(pickBehavior(weights, () => r, { unavailable: new Set<RoamBehavior>(['perch']) }), 'perch');
    }
    const none: Record<RoamBehavior, number> = { walk: 0, sit: 0, groom: 0, nap: 0, perch: 0, zoom: 0 };
    assert.equal(pickBehavior(none, () => 0.5), 'sit');
  });

  it('every tab route has at least one staying-put behavior', () => {
    for (const [tab, route] of Object.entries(ROAM_ROUTES)) {
      assert.ok(route.sit + route.groom + route.nap > 0, tab);
    }
  });

  it('pickWalkTarget keeps a minimum trip, avoids blocked spots, and gives up with null', () => {
    assert.equal(pickWalkTarget(100, 0, 300, 60, seq(0.4, 0.9), () => false), 270);
    assert.equal(pickWalkTarget(100, 0, 300, 60, seq(0.9, 0.1), (x) => x > 200), 30);
    assert.equal(pickWalkTarget(100, 0, 300, 60, () => 0.9, () => true), null);
    assert.equal(pickWalkTarget(0, 50, 40, 60, () => 0.5, () => false), null);
  });

  it('jumpPoint starts and ends on the given points and rises above both', () => {
    const a = { x: 0, y: 100 };
    const b = { x: 100, y: 50 };
    assert.deepEqual(jumpPoint(a, b, 40, 0), a);
    assert.deepEqual(jumpPoint(a, b, 40, 1), b);
    const mid = jumpPoint(a, b, 40, 0.5);
    assert.ok(mid.y < 50, `mid ${mid.y} should be above both ends`);
  });

  it('clamp handles an inverted range', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(20, 0, 10), 10);
    assert.equal(clamp(5, 10, 0), 10);
  });
});

describe('walking on a card', () => {
  it('stepWalk moves toward the target and stops exactly on it', () => {
    assert.deepEqual(stepWalk(10, 50, 100, 0.1), { x: 20, arrived: false });
    assert.deepEqual(stepWalk(50, 10, 100, 0.1), { x: 40, arrived: false });
    assert.deepEqual(stepWalk(45, 50, 100, 0.1), { x: 50, arrived: true });
    assert.deepEqual(stepWalk(50, 50, 100, 0.1), { x: 50, arrived: true });
  });

  it('the spot reached by walking is where the next staying-put action happens', () => {
    const perchLeft = 30;
    // 跳上卡片時落在離左緣 20 的地方，接著在卡片上往右走到 x＝130
    let dx = perchOffset(50, perchLeft);
    let x = perchLeft + dx;
    for (let i = 0; i < 100; i += 1) {
      const step = stepWalk(x, 130, 40, 0.05);
      x = step.x;
      dx = perchOffset(x, perchLeft);
      if (step.arrived) break;
    }
    // 換成原地動作（坐、理毛）或點一下原地跳時，位置由 dx 算回來：要留在走到的地方
    assert.equal(perchLeft + dx, 130);
    // 卡片跟著頁面橫移時，小貓跟著卡片
    assert.equal(perchLeft + 12 + dx, 142);
  });
});
