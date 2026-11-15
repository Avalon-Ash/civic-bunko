import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { ACCESSORIES, DAILY_GOAL_QUESTIONS, STAMPS_PER_REWARD } from '../core/constants/daily';
import { createWorld } from '../core/world';
import { currentAccessory, stampTotals, todayProgress, weekStamps } from './daily';

describe('daily selectors & accessory rules', () => {
  it('computes todayProgress missionsDone and stamp threshold at DAILY_GOAL_QUESTIONS', () => {
    const world = createWorld();
    const now = new Date('2026-11-18T12:00:00');

    assert.deepEqual(todayProgress(world, now), {
      count: 0,
      goal: DAILY_GOAL_QUESTIONS,
      missionsDone: 0,
      missionsTotal: 3,
      stamped: false,
    });

    world.dayLog.set('2026-11-18', 4);
    assert.equal(todayProgress(world, now).missionsDone, 0);
    assert.equal(todayProgress(world, now).stamped, false);

    world.dayLog.set('2026-11-18', 5);
    assert.equal(todayProgress(world, now).missionsDone, 1);

    world.dayLog.set('2026-11-18', 10);
    assert.equal(todayProgress(world, now).missionsDone, 2);

    world.dayLog.set('2026-11-18', 14);
    assert.equal(todayProgress(world, now).missionsDone, 2);
    assert.equal(todayProgress(world, now).stamped, false);

    world.dayLog.set('2026-11-18', 15);
    assert.deepEqual(todayProgress(world, now), {
      count: 15,
      goal: 15,
      missionsDone: 3,
      missionsTotal: 3,
      stamped: true,
    });

    world.dayLog.set('2026-11-18', 25);
    assert.equal(todayProgress(world, now).missionsDone, 3);
    assert.equal(todayProgress(world, now).stamped, true);
  });

  it('computes weekStamps from Monday to Sunday including Sunday boundary', () => {
    const world = createWorld();
    world.dayLog.set('2026-11-16', 15); // Monday: stamped
    world.dayLog.set('2026-11-22', 7);  // Sunday: not stamped

    const sundayNow = new Date('2026-11-22T20:00:00');
    const week = weekStamps(world, sundayNow);

    assert.equal(week.length, 7);
    assert.deepEqual(week[0], {
      date: '2026-11-16',
      label: '一',
      isToday: false,
      stamped: true,
      count: 15,
    });
    assert.deepEqual(week[6], {
      date: '2026-11-22',
      label: '日',
      isToday: true,
      stamped: false,
      count: 7,
    });
  });

  it('computes stampTotals and accessory unlock thresholds', () => {
    const world = createWorld();
    // Days with < 15 do not count as stamps
    world.dayLog.set('2026-11-01', 14);
    assert.deepEqual(stampTotals(world), {
      total: 0,
      unlocked: [],
      next: { id: 'bow', name: '蝴蝶結', need: STAMPS_PER_REWARD },
    });

    // 2 stamps -> still need 1 more for bow
    world.dayLog.set('2026-11-02', 15);
    world.dayLog.set('2026-11-03', 18);
    assert.deepEqual(stampTotals(world), {
      total: 2,
      unlocked: [],
      next: { id: 'bow', name: '蝴蝶結', need: 1 },
    });

    // 3rd stamp unlocks bow, next is straw-hat needing 3
    world.dayLog.set('2026-11-04', 15);
    assert.deepEqual(stampTotals(world), {
      total: 3,
      unlocked: ['bow'],
      next: { id: 'straw-hat', name: '草帽', need: 3 },
    });

    // 4th stamp -> straw-hat needs 2
    world.dayLog.set('2026-11-05', 15);
    assert.deepEqual(stampTotals(world), {
      total: 4,
      unlocked: ['bow'],
      next: { id: 'straw-hat', name: '草帽', need: 2 },
    });

    // Unlock all 6 accessories at 18 stamps
    for (let d = 6; d <= 19; d += 1) {
      world.dayLog.set(`2026-11-${String(d).padStart(2, '0')}`, 15);
    }
    const allUnlocked = stampTotals(world);
    assert.equal(allUnlocked.total, 18);
    assert.deepEqual(
      allUnlocked.unlocked,
      ACCESSORIES.map((a) => a.id),
    );
    assert.equal(allUnlocked.next, null);
  });

  it('only allows equipping unlocked accessories via setAccessory and currentAccessory', () => {
    const world = createWorld();
    let settingsEvents = 0;
    world.bus.on('settingsChanged', () => {
      settingsEvents += 1;
    });

    // Locked accessory is rejected
    dispatch(world, { type: 'setAccessory', accessory: 'bow' });
    assert.equal(world.settings.accessory, undefined);
    assert.equal(currentAccessory(world), null);
    assert.equal(settingsEvents, 0);

    // Even if settings.accessory somehow contains a locked ID, currentAccessory returns null
    world.settings.accessory = 'crown';
    assert.equal(currentAccessory(world), null);

    // Earn 3 stamps to unlock 'bow', while 'crown' remains locked
    world.dayLog.set('2026-11-01', 15);
    world.dayLog.set('2026-11-02', 15);
    world.dayLog.set('2026-11-03', 15);
    assert.equal(currentAccessory(world), null);

    // Equip unlocked 'bow'
    dispatch(world, { type: 'setAccessory', accessory: 'bow' });
    assert.equal(world.settings.accessory, 'bow');
    assert.equal(currentAccessory(world), 'bow');
    assert.equal(settingsEvents, 1);

    // Still rejects locked 'straw-hat'
    dispatch(world, { type: 'setAccessory', accessory: 'straw-hat' });
    assert.equal(currentAccessory(world), 'bow');
    assert.equal(settingsEvents, 1);

    // Unequip with null
    dispatch(world, { type: 'setAccessory', accessory: null });
    assert.equal(world.settings.accessory, null);
    assert.equal(currentAccessory(world), null);
    assert.equal(settingsEvents, 2);
  });
});
