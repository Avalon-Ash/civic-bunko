import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAT_DAY_PARTS } from '../../core/constants/cat';
import { HOUSE_SCENE } from '../../core/constants/house';
import {
  activeNuzzlePair,
  actorPose,
  createEnteringActor,
  createInitialActors,
  dayPartOfHour,
  decideNextAction,
  doorPosition,
  hopActor,
  roomBounds,
  stepHouse,
  syncActorsWithCats,
  type HouseActor,
} from './houseLogic';

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

const BOUNDS = roomBounds(360, HOUSE_SCENE.height);

describe('houseLogic: bounds and movement', () => {
  it('every walk target and stepped position stays inside the room floor bounds', () => {
    const initial = createInitialActors(['cat-1', 'cat-2', 'cat-3'], BOUNDS, seq(0.1, 0.7, 0.3, 0.9, 0.2, 0.5));
    for (const actor of initial) {
      assert.ok(actor.x >= BOUNDS.minX && actor.x <= BOUNDS.maxX, `init x=${actor.x}`);
      assert.ok(actor.y >= BOUNDS.minY && actor.y <= BOUNDS.maxY, `init y=${actor.y}`);
    }

    for (const roll of [0, 0.05, 0.15, 0.35, 0.6, 0.85, 0.99]) {
      const next = decideNextAction('cat-1', initial, BOUNDS, seq(0.99, roll, 0.2, 0.8));
      const cat = next.find((a) => a.id === 'cat-1')!;
      if (cat.action === 'walk') {
        assert.ok(cat.target, 'walk must have target');
        assert.ok(cat.target.x >= BOUNDS.minX && cat.target.x <= BOUNDS.maxX, `target x=${cat.target.x}`);
        assert.ok(cat.target.y >= BOUNDS.minY && cat.target.y <= BOUNDS.maxY, `target y=${cat.target.y}`);
      }
    }

    // 連續推進多步，全部小貓都在範圍內
    let actors = initial;
    const rng = seq(0.05, 0.9, 0.15, 0.75, 0.4, 0.6, 0.25, 0.8);
    for (let step = 0; step < 80; step += 1) {
      actors = stepHouse(actors, 250, BOUNDS, rng);
      for (const a of actors) {
        assert.ok(a.x >= BOUNDS.minX && a.x <= BOUNDS.maxX, `step ${step} x=${a.x}`);
        assert.ok(a.y >= BOUNDS.minY && a.y <= BOUNDS.maxY, `step ${step} y=${a.y}`);
      }
    }
  });

  it('newly adopted cat starts at the right doorway and walks into the room facing left', () => {
    const door = doorPosition(BOUNDS);
    const entering = createEnteringActor('cat-2', BOUNDS, seq(0.5, 0.4));
    assert.equal(entering.x, door.x);
    assert.equal(entering.y, door.y);
    assert.equal(entering.facing, 'left');
    assert.equal(entering.action, 'walk');
    assert.ok(entering.target, 'entering cat should walk inward');
    assert.ok(entering.target.x >= BOUNDS.minX && entering.target.x <= BOUNDS.maxX);
    assert.ok(entering.target.x < door.x, 'target should be inside the room to the left of the door');

    // 往前走一步後往左移動
    const [afterStep] = stepHouse([entering], 500, BOUNDS, () => 0.5);
    assert.ok(afterStep && afterStep.x < door.x);

    // syncActorsWithCats 新增小貓時起點也在門口
    const existing = createInitialActors(['cat-1'], BOUNDS, () => 0.5);
    const synced = syncActorsWithCats(existing, ['cat-1', 'cat-2'], BOUNDS, () => 0.5, { enteringId: 'cat-2' });
    const newcomer = synced.find((a) => a.id === 'cat-2')!;
    assert.equal(newcomer.x, door.x);
    assert.equal(newcomer.facing, 'left');
  });
});

describe('houseLogic: nuzzle rules', () => {
  const makeCat = (id: string, x: number, y: number, action: HouseActor['action'] = 'sit'): HouseActor => ({
    id,
    x,
    y,
    facing: 'right',
    action,
    remainMs: 3000,
    hopMs: 0,
  });

  it('only nuzzles when two cats are closer than HOUSE_SCENE.nuzzle.dist, facing each other', () => {
    const farApart = [
      makeCat('cat-1', 60, 40),
      makeCat('cat-2', 60 + HOUSE_SCENE.nuzzle.dist, 40),
    ];
    // 即使 rng 給 0（最容易觸發蹭蹭），距離等於門檻也不會蹭蹭
    const farNext = decideNextAction('cat-1', farApart, BOUNDS, () => 0);
    assert.notEqual(farNext[0]!.action, 'nuzzle');
    assert.notEqual(farNext[1]!.action, 'nuzzle');

    const close = [
      makeCat('cat-1', 100, 40),
      makeCat('cat-2', 100 + HOUSE_SCENE.nuzzle.dist - 10, 40),
    ];
    const closeNext = decideNextAction('cat-1', close, BOUNDS, () => 0);
    assert.equal(closeNext[0]!.action, 'nuzzle');
    assert.equal(closeNext[1]!.action, 'nuzzle');
    assert.equal(closeNext[0]!.partnerId, 'cat-2');
    assert.equal(closeNext[1]!.partnerId, 'cat-1');
    // 兩隻互看：左邊的面右、右邊的面左
    assert.equal(closeNext[0]!.facing, 'right');
    assert.equal(closeNext[1]!.facing, 'left');

    const pair = activeNuzzlePair(closeNext);
    assert.ok(pair !== null);
    assert.equal(pair.x, (close[0]!.x + close[1]!.x) / 2);
  });

  it('allows at most one nuzzling pair at the same time', () => {
    const twoClosePairs = [
      makeCat('cat-1', 60, 30),
      makeCat('cat-2', 90, 30),
      makeCat('cat-3', 240, 30),
      makeCat('cat-4', 270, 30),
    ];
    // 第一對先進入蹭蹭
    const afterFirst = decideNextAction('cat-1', twoClosePairs, BOUNDS, () => 0);
    assert.equal(afterFirst[0]!.action, 'nuzzle');
    assert.equal(afterFirst[1]!.action, 'nuzzle');

    // 第二對距離也很近且 rng 為 0，但場上已有一對，不能再蹭蹭
    const afterSecond = decideNextAction('cat-3', afterFirst, BOUNDS, () => 0);
    assert.notEqual(afterSecond[2]!.action, 'nuzzle');
    assert.notEqual(afterSecond[3]!.action, 'nuzzle');
    assert.equal(afterSecond.filter((a) => a.action === 'nuzzle').length, 2);

    // 蹭蹭結束後兩隻一起結束，不會剩單獨一隻在蹭蹭
    const ended = decideNextAction('cat-1', afterFirst, BOUNDS, () => 0.9);
    assert.equal(ended.filter((a) => a.action === 'nuzzle').length, 0);
  });
});

describe('houseLogic: prefers-reduced-motion', () => {
  it('never walks or changes position when reducedMotion is true (only sit, groom, loaf)', () => {
    const start = createInitialActors(['cat-1', 'cat-2'], BOUNDS, seq(0.2, 0.8, 0.5, 0.1), {
      reducedMotion: true,
    });
    const allowed = new Set(['sit', 'groom', 'loaf']);
    for (const a of start) {
      assert.ok(allowed.has(a.action), `init action=${a.action}`);
    }

    // 各種固定亂數下都不會挑到 walk 或 nuzzle，位置完全不變
    for (let i = 0; i < 20; i += 1) {
      const r = i / 20;
      const next = decideNextAction('cat-1', start, BOUNDS, () => r, { reducedMotion: true });
      assert.ok(allowed.has(next[0]!.action), `roll ${r} got ${next[0]!.action}`);
      assert.equal(next[0]!.target, undefined);
      assert.equal(next[0]!.x, start[0]!.x);
      assert.equal(next[0]!.y, start[0]!.y);
    }

    // 即使原本在走路，開啟 reducedMotion 推進一步也會停下來且不移動
    const walking: HouseActor[] = [
      { id: 'cat-1', x: 100, y: 40, facing: 'right', action: 'walk', target: { x: 250, y: 50 }, remainMs: 0, hopMs: 0 },
    ];
    const stepped = stepHouse(walking, 500, BOUNDS, () => 0, { reducedMotion: true });
    assert.ok(allowed.has(stepped[0]!.action));
    assert.equal(stepped[0]!.x, 100);
    assert.equal(stepped[0]!.y, 40);
  });
});

describe('houseLogic: day parts and hop pose', () => {
  it('maps hours using CAT_DAY_PARTS boundaries', () => {
    assert.equal(dayPartOfHour(CAT_DAY_PARTS.morning), 'day');
    assert.equal(dayPartOfHour(CAT_DAY_PARTS.evening - 1), 'day');
    assert.equal(dayPartOfHour(CAT_DAY_PARTS.evening), 'dusk');
    assert.equal(dayPartOfHour(CAT_DAY_PARTS.lateNight - 1), 'dusk');
    assert.equal(dayPartOfHour(CAT_DAY_PARTS.lateNight), 'night');
    assert.equal(dayPartOfHour(0), 'night');
    assert.equal(dayPartOfHour(CAT_DAY_PARTS.morning - 1), 'night');
  });

  it('hopActor sets hop pose until hopMs elapses', () => {
    const [cat] = createInitialActors(['cat-1'], BOUNDS, () => 0.5);
    const hopped = hopActor([cat!], 'cat-1');
    assert.equal(actorPose(hopped[0]!), 'hop');
    const landed = stepHouse(hopped, HOUSE_SCENE.hopMs + 10, BOUNDS, () => 0.5);
    assert.notEqual(actorPose(landed[0]!), 'hop');
  });
});
