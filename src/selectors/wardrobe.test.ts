import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, DAILY_TIERS, ITEMS } from '../core/constants/wardrobe';
import { createWorld } from '../core/world';
import { createTestWorld } from '../testing/fixture';
import {
  achievementStatuses,
  currentOutfit,
  dailyTierStatus,
  itemStatuses,
} from './wardrobe';

describe('wardrobe selectors', () => {
  it('itemStatuses returns every item in ITEMS order with exact state, price, need, and achievement', () => {
    const world = createTestWorld(); // testBank examDate = '2026-12-05'
    // 1 stamp (need 2 more for 'bow' which requires 3)
    world.dayLog.set('2026-11-17', 15);
    world.settings.wardrobe = {
      owned: ['beanie', 'hachimaki'], // beanie = 80, hachimaki (sprint) = 60 -> spent = 140
      achievements: [],
      quests: {},
    };
    // Earned = 15 (questions) + 5 + 10 (tiers) + 150 (welcome) = 180; raw = 40 -> < 60 (short for star-clip)

    const outsideSprint = new Date(2026, 10, 16, 12, 0, 0);
    const statusesOutside = itemStatuses(world, outsideSprint);
    assert.equal(statusesOutside.length, ITEMS.length);
    assert.deepEqual(
      statusesOutside.map((s) => s.item.id),
      ITEMS.map((i) => i.id),
    );

    const byIdOutside = new Map(statusesOutside.map((s) => [s.item.id, s]));
    assert.deepEqual(byIdOutside.get('bow')?.state, 'stamps');
    assert.equal(byIdOutside.get('bow')?.need, 2);
    assert.equal(byIdOutside.get('beanie')?.state, 'owned');
    // Already-owned sprint item stays 'owned' even outside sprint window
    assert.equal(byIdOutside.get('hachimaki')?.state, 'owned');
    // Unowned sprint item is 'off' outside sprint window
    assert.equal(byIdOutside.get('clover')?.state, 'off');
    assert.equal(byIdOutside.get('clover')?.price, 60);
    // Achievement item
    assert.equal(byIdOutside.get('grad-cap')?.state, 'achievement');
    assert.equal(byIdOutside.get('grad-cap')?.achievement, 'exam-80');
    // Shop item too expensive (raw=40 < 60)
    assert.equal(byIdOutside.get('star-clip')?.state, 'short');
    assert.equal(byIdOutside.get('star-clip')?.price, 60);

    // Add 20 more questions on 2026-11-18 -> +20 + 5 + 10 = +35 -> raw = 75 (>= 60)
    world.dayLog.set('2026-11-18', 20);
    const insideSprint = new Date(2026, 10, 18, 12, 0, 0);
    const byIdInside = new Map(itemStatuses(world, insideSprint).map((s) => [s.item.id, s]));
    assert.equal(byIdInside.get('clover')?.state, 'buyable');
    assert.equal(byIdInside.get('star-clip')?.state, 'buyable');
    assert.equal(byIdInside.get('wings')?.state, 'short');
  });

  it('dailyTierStatus reports today count and reached flags for DAILY_TIERS', () => {
    const world = createWorld();
    const now = new Date('2026-11-17T12:00:00');
    world.dayLog.set('2026-11-17', 16);

    const status = dailyTierStatus(world, now);
    assert.equal(status.count, 16);
    assert.deepEqual(status.tiers, [
      { at: DAILY_TIERS[0]!.at, fish: DAILY_TIERS[0]!.fish, reached: true },
      { at: DAILY_TIERS[1]!.at, fish: DAILY_TIERS[1]!.fish, reached: true },
      { at: DAILY_TIERS[2]!.at, fish: DAILY_TIERS[2]!.fish, reached: false },
    ]);
  });

  it('achievementStatuses reports all ACHIEVEMENTS with current metric values and unlocked state', () => {
    const world = createWorld();
    world.progress.set('q1', {
      seen: 3,
      correct: 3,
      views: 0,
      streak: 3,
      lastPick: 'A',
      lastAt: '2026-11-17T10:00:00.000Z',
      due: null,
    });
    world.settings.cardsSeen = ['c1', 'c2'];
    world.settings.examHistory = [
      { paperId: 'p1', at: '2026-11-17T10:00:00.000Z', total: 10, answered: 10, correct: 7, score: 70 },
    ];

    const list = achievementStatuses(world);
    assert.equal(list.length, ACHIEVEMENTS.length);

    const byId = new Map(list.map((entry) => [entry.achievement.id, entry]));
    assert.equal(byId.get('mastered-50')?.value, 1);
    assert.equal(byId.get('mastered-50')?.unlocked, false);
    assert.equal(byId.get('cards-10')?.value, 2);
    assert.equal(byId.get('exam-1')?.value, 1);
    assert.equal(byId.get('exam-1')?.unlocked, true);
    assert.equal(byId.get('exam-60')?.value, 70);
    assert.equal(byId.get('exam-60')?.unlocked, true);
    assert.equal(byId.get('exam-80')?.unlocked, false);
  });

  it('currentOutfit filters out unowned items, slot mismatches, and unknown IDs', () => {
    const world = createWorld();
    world.settings.wardrobe = {
      owned: ['beanie'],
      achievements: [],
      quests: {},
      outfit: {
        'head-top': 'beanie',
        neck: 'beanie', // wrong slot
        'head-side': 'bow', // not owned
        back: 'future-wings', // unknown
      },
    };
    assert.deepEqual(currentOutfit(world), { 'head-top': 'beanie' });
  });
});
