import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import type { Settings } from '../core/types';
import { createTestWorld, makeConfig, makeSeededRng } from '../testing/fixture';

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
});
