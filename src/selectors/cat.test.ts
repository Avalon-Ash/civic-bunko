import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dispatch } from '../core/commands';
import { CAT_CHARACTER } from '../core/constants/catLines';
import { DAILY_GOAL_QUESTIONS } from '../core/constants/daily';
import type { CatTap } from '../core/types';
import { createTestWorld, testBank } from '../testing/fixture';
import { EMPTY_CAT_MEMORY, catDisplayName, catName, catSays, catSituation } from './cat';

const TAP: CatTap = { mood: 'idle', place: 'avatar' };
/** 考試日前 n 天的中午（用題庫自己的考試日算，不寫死日期） */
function daysBeforeExam(n: number): Date {
  const [y, m, d] = testBank.examDate.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d - n, 12, 0, 0);
}
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('cat selectors', () => {
  it('reads the time, today\'s count and the days left from the world', () => {
    const world = createTestWorld();
    const now = daysBeforeExam(12);
    world.dayLog.set(dayKey(now), 7);
    const s = catSituation(world, TAP, 2, now);
    assert.equal(s.hour, 12);
    assert.equal(s.daysToExam, 12);
    assert.equal(s.todayCount, 7);
    assert.equal(s.dailyGoal, DAILY_GOAL_QUESTIONS);
    assert.equal(s.taps, 2);
    assert.equal(s.name, null);
    assert.equal(s.wearing, 0);
  });

  it('exam day is 0 days, and after the exam there is no countdown at all', () => {
    const world = createTestWorld();
    assert.equal(catSituation(world, TAP, 1, daysBeforeExam(0)).daysToExam, 0);
    assert.equal(catSituation(world, TAP, 1, daysBeforeExam(-1)).daysToExam, null);
    assert.equal(catSituation(world, TAP, 1, daysBeforeExam(-40)).daysToExam, null);
  });

  it('counts the stamp streak up to today, or up to yesterday when today is not stamped yet', () => {
    const world = createTestWorld();
    const now = daysBeforeExam(10);
    for (const back of [1, 2, 3]) world.dayLog.set(dayKey(daysBeforeExam(10 + back)), DAILY_GOAL_QUESTIONS);
    world.dayLog.set(dayKey(daysBeforeExam(10 + 5)), DAILY_GOAL_QUESTIONS);
    assert.equal(catSituation(world, TAP, 1, now).streak, 3);

    world.dayLog.set(dayKey(now), DAILY_GOAL_QUESTIONS - 1);
    assert.equal(catSituation(world, TAP, 1, now).streak, 3);
    world.dayLog.set(dayKey(now), DAILY_GOAL_QUESTIONS);
    assert.equal(catSituation(world, TAP, 1, now).streak, 4);

    world.dayLog.delete(dayKey(daysBeforeExam(11)));
    assert.equal(catSituation(world, TAP, 1, now).streak, 1);
  });

  it('uses the name the user gave, and the pack\'s default when there is none', () => {
    const world = createTestWorld();
    assert.equal(catName(world), null);
    assert.equal(catDisplayName(world), CAT_CHARACTER.defaultName);
    dispatch(world, { type: 'setCatName', name: '麻糬' });
    assert.equal(catName(world), '麻糬');
    assert.equal(catDisplayName(world), '麻糬');
    assert.equal(catSituation(world, TAP, 1, daysBeforeExam(10)).name, '麻糬');
  });

  it('says a line and hands back the memory to keep for the next tap', () => {
    const world = createTestWorld();
    const now = daysBeforeExam(10);
    const first = catSays(world, TAP, EMPTY_CAT_MEMORY, now, () => 0.3);
    assert.ok(first.line && first.line.text.length > 0);
    assert.equal(first.memory.taps, 1);
    assert.deepEqual(first.memory.recentLines, [first.line.text]);

    const second = catSays(world, TAP, first.memory, new Date(now.getTime() + 500), () => 0.3);
    assert.equal(second.memory.taps, 2);
    assert.notEqual(second.line?.topic, first.line.topic);
  });

  it('a different character pack can be swapped in without touching anything else', () => {
    const world = createTestWorld();
    const pack = { id: 'other', defaultName: '阿橘', topics: [{ id: 'only', when: [], weight: 1, lines: ['{NAME}來了'] }] };
    const result = catSays(world, TAP, EMPTY_CAT_MEMORY, daysBeforeExam(10), () => 0, pack);
    assert.deepEqual(result.line, { text: '阿橘來了', topic: 'only' });
  });
});
