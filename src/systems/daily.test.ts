import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../core/world';
import { attachDaily, backfillDayLogFromProgress, toDayKey } from './daily';

describe('daily system', () => {
  it('converts timestamps to YYYY-MM-DD with injectable timezone offset across midnight', () => {
    // 2026-11-15T16:30:00Z -> UTC+8 is 2026-11-16 00:30, UTC+0 is 2026-11-15 16:30
    const utcEvening = '2026-11-15T16:30:00.000Z';
    assert.equal(toDayKey(utcEvening, 480), '2026-11-16');
    assert.equal(toDayKey(utcEvening, 0), '2026-11-15');
    assert.equal(toDayKey(utcEvening, -300), '2026-11-15');

    // 2026-11-16T02:00:00Z -> UTC-5 is 2026-11-15 21:00, UTC+8 is 2026-11-16 10:00
    const utcEarly = '2026-11-16T02:00:00.000Z';
    assert.equal(toDayKey(utcEarly, -300), '2026-11-15');
    assert.equal(toDayKey(utcEarly, 480), '2026-11-16');

    assert.equal(toDayKey('not-a-date'), null);
  });

  it('counts answered and viewed events per local day and emits dayLogChanged', () => {
    const world = createWorld();
    attachDaily(world, { utcOffsetMinutes: 480 });

    const events: Array<{ day: string; count: number }> = [];
    world.bus.on('dayLogChanged', (e) => events.push({ day: e.day, count: e.count }));

    world.bus.emit({
      type: 'answered',
      id: 'q1',
      pick: 'A',
      correct: true,
      at: '2026-11-15T15:59:59.000Z', // 23:59:59 in UTC+8 -> 2026-11-15
    });
    world.bus.emit({
      type: 'viewed',
      id: 'q2',
      at: '2026-11-15T16:00:00.000Z', // 00:00:00 in UTC+8 -> 2026-11-16
    });
    world.bus.emit({
      type: 'answered',
      id: 'q3',
      pick: 'B',
      correct: false,
      at: '2026-11-16T08:00:00.000Z', // 16:00:00 in UTC+8 -> 2026-11-16
    });

    assert.equal(world.dayLog.get('2026-11-15'), 1);
    assert.equal(world.dayLog.get('2026-11-16'), 2);
    assert.deepEqual(events, [
      { day: '2026-11-15', count: 1 },
      { day: '2026-11-16', count: 1 },
      { day: '2026-11-16', count: 2 },
    ]);
  });

  it('backfills dayLog from legacy progress only once', () => {
    const world = createWorld();
    world.progress.set('q1', {
      seen: 2,
      correct: 1,
      views: 0,
      streak: 1,
      lastPick: 'A',
      lastAt: '2026-11-15T10:00:00.000Z',
      due: null,
    });
    world.progress.set('q2', {
      seen: 0,
      correct: 0,
      views: 1,
      streak: 0,
      lastPick: null,
      lastAt: '2026-11-15T17:00:00.000Z', // 2026-11-16 in UTC+8
      due: null,
    });
    world.progress.set('q-unused', {
      seen: 0,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: null,
      lastAt: '2026-11-14T10:00:00.000Z',
      due: null,
    });

    const first = backfillDayLogFromProgress(world, 480);
    assert.equal(first, true);
    assert.equal(world.dayLog.get('2026-11-15'), 1);
    assert.equal(world.dayLog.get('2026-11-16'), 1);
    assert.equal(world.dayLog.has('2026-11-14'), false);

    // Calling again must be a no-op
    const second = backfillDayLogFromProgress(world, 480);
    assert.equal(second, false);
    assert.equal(world.dayLog.get('2026-11-15'), 1);

    // Even if dayLog is cleared manually later, same world won't backfill twice
    world.dayLog.clear();
    const third = backfillDayLogFromProgress(world, 480);
    assert.equal(third, false);
    assert.equal(world.dayLog.size, 0);
  });
});
