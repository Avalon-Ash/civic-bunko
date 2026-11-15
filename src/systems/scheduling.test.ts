import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRADUATE_STREAK, REVIEW_INTERVAL_DAYS } from '../core/constants/round';
import { createWorld } from '../core/world';
import { addDaysLocal } from './date';

describe('scheduling system', () => {
  const day0 = new Date('2026-11-15T10:00:00');
  const day1 = new Date('2026-11-16T10:00:00');
  const day4 = new Date('2026-11-19T10:00:00');

  it('graduates a brand-new question immediately if answered right on first try', () => {
    const world = createWorld();
    const changed: string[][] = [];
    world.bus.on('progressChanged', (e) => changed.push(e.ids));

    world.bus.emit({
      type: 'answered',
      id: 'q1',
      pick: 'A',
      correct: true,
      at: day0.toISOString(),
    });

    const prog = world.progress.get('q1');
    assert.ok(prog);
    assert.equal(prog.seen, 1);
    assert.equal(prog.correct, 1);
    assert.equal(prog.streak, 1);
    assert.equal(prog.lastPick, 'A');
    assert.equal(prog.due, null);
    assert.deepEqual(changed, [['q1']]);
  });

  it('schedules intervals on wrong -> right -> graduate and resets streak on wrong', () => {
    const world = createWorld();

    // 1. Wrong on first try -> streak 0, due in REVIEW_INTERVAL_DAYS[0] (1 day)
    world.bus.emit({
      type: 'answered',
      id: 'q2',
      pick: 'B',
      correct: false,
      at: day0.toISOString(),
    });
    let prog = world.progress.get('q2')!;
    assert.equal(prog.seen, 1);
    assert.equal(prog.correct, 0);
    assert.equal(prog.streak, 0);
    assert.equal(prog.due, addDaysLocal(day0, REVIEW_INTERVAL_DAYS[0]));

    // 2. Right on review -> streak 1 (< GRADUATE_STREAK=2), due in REVIEW_INTERVAL_DAYS[1] (3 days)
    world.bus.emit({
      type: 'answered',
      id: 'q2',
      pick: 'A',
      correct: true,
      at: day1.toISOString(),
    });
    prog = world.progress.get('q2')!;
    assert.equal(prog.seen, 2);
    assert.equal(prog.correct, 1);
    assert.equal(prog.streak, 1);
    assert.equal(prog.due, addDaysLocal(day1, REVIEW_INTERVAL_DAYS[1]));

    // 3. Wrong again -> streak resets to 0, due in REVIEW_INTERVAL_DAYS[0] (1 day)
    world.bus.emit({
      type: 'answered',
      id: 'q2',
      pick: 'C',
      correct: false,
      at: day4.toISOString(),
    });
    prog = world.progress.get('q2')!;
    assert.equal(prog.seen, 3);
    assert.equal(prog.correct, 1);
    assert.equal(prog.streak, 0);
    assert.equal(prog.due, addDaysLocal(day4, REVIEW_INTERVAL_DAYS[0]));

    // 4. Right twice in a row -> reaches GRADUATE_STREAK -> due = null
    for (let s = 1; s <= GRADUATE_STREAK; s += 1) {
      const d = new Date(day4.getTime() + s * 86_400_000);
      world.bus.emit({
        type: 'answered',
        id: 'q2',
        pick: 'A',
        correct: true,
        at: d.toISOString(),
      });
    }
    prog = world.progress.get('q2')!;
    assert.equal(prog.streak, GRADUATE_STREAK);
    assert.equal(prog.due, null);
  });
});
