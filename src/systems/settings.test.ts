import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { EXAM_HISTORY_MAX } from '../core/constants/exam';
import type { Settings } from '../core/types';
import { createTestWorld, makeConfig, makeSeededRng, testPaperA } from '../testing/fixture';

describe('settings system', () => {
  it('updates theme and remembers lastRound on roundStarted', () => {
    const world = createTestWorld();
    const emitted: Settings[] = [];
    world.bus.on('settingsChanged', (e) => emitted.push(e.settings));

    assert.equal(world.settings.theme, 'system');
    assert.equal(world.settings.lastRound, null);

    dispatch(world, { type: 'setTheme', theme: 'dark' });
    assert.equal(world.settings.theme, 'dark');
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.theme, 'dark');

    const config = makeConfig({ subjectKeys: ['subj-b'], count: 5, fast: true });
    dispatch(
      world,
      { type: 'startRound', config },
      { now: () => new Date('2026-11-15T10:00:00'), rng: makeSeededRng(1) },
    );

    assert.deepEqual(world.settings.lastRound, config);
    assert.equal(emitted.length, 2);
    assert.deepEqual(emitted[1]?.lastRound, config);

    dispatch(world, { type: 'dismissInstallHint' });
    assert.equal(world.settings.installHintDismissed, true);
    assert.equal(emitted.length, 3);
    assert.equal(emitted[2]?.installHintDismissed, true);
  });

  it('appends examFinished records to settings.examHistory up to EXAM_HISTORY_MAX', () => {
    const world = createTestWorld();
    const emitted: Settings[] = [];
    world.bus.on('settingsChanged', (e) => emitted.push(e.settings));

    for (let i = 0; i < EXAM_HISTORY_MAX + 3; i += 1) {
      world.bus.emit({
        type: 'examFinished',
        record: {
          paperId: testPaperA.id,
          at: `2026-11-16T10:${String(i).padStart(2, '0')}:00.000Z`,
          total: 50,
          answered: 50,
          correct: i % 51,
          score: Math.round(((i % 51) / 50) * 100),
        },
      });
    }

    const history = world.settings.examHistory ?? [];
    assert.equal(history.length, EXAM_HISTORY_MAX);
    assert.equal(history[0]?.at, '2026-11-16T10:03:00.000Z');
    assert.equal(
      history[EXAM_HISTORY_MAX - 1]?.at,
      `2026-11-16T10:${String(EXAM_HISTORY_MAX + 2).padStart(2, '0')}:00.000Z`,
    );
    assert.equal(emitted.length, EXAM_HISTORY_MAX + 3);
  });
});
