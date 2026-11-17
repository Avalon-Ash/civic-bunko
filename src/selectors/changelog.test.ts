import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHANGELOG } from '../core/constants/changelog';
import { dispatch } from '../core/commands';
import type { ChangelogEntry } from '../core/types';
import { createWorld } from '../core/world';
import { latestChangelog, unseenChangelog } from './changelog';
import { soundOn } from './sound';

const entries: ChangelogEntry[] = [
  { id: 'c', date: '2026-11-19', title: 'C', items: ['c'] },
  { id: 'b', date: '2026-11-18', title: 'B', items: ['b'] },
  { id: 'a', date: '2026-11-17', title: 'A', items: ['a'] },
];

describe('changelog selectors', () => {
  it('shows only the latest entry when nothing has been seen yet', () => {
    const world = createWorld();
    assert.deepEqual(unseenChangelog(world, entries).map((e) => e.id), ['c']);
  });

  it('shows every entry newer than the one already seen', () => {
    const world = createWorld();
    world.settings = { ...world.settings, changelogSeen: 'a' };
    assert.deepEqual(unseenChangelog(world, entries).map((e) => e.id), ['c', 'b']);
  });

  it('shows nothing once the latest has been seen, and only the latest when the seen ID is unknown', () => {
    const world = createWorld();
    world.settings = { ...world.settings, changelogSeen: 'c' };
    assert.deepEqual(unseenChangelog(world, entries), []);
    world.settings = { ...world.settings, changelogSeen: 'gone' };
    assert.deepEqual(unseenChangelog(world, entries).map((e) => e.id), ['c']);
  });

  it('markChangelogSeen stores the ID and is a no-op when unchanged', () => {
    const world = createWorld();
    let writes = 0;
    world.bus.on('settingsChanged', () => {
      writes += 1;
    });
    dispatch(world, { type: 'markChangelogSeen', id: 'c' });
    dispatch(world, { type: 'markChangelogSeen', id: 'c' });
    assert.equal(world.settings.changelogSeen, 'c');
    assert.equal(writes, 1);
  });

  it('sound defaults to on and can be turned off', () => {
    const world = createWorld();
    assert.equal(soundOn(world), true);
    dispatch(world, { type: 'setSound', on: false });
    assert.equal(soundOn(world), false);
  });

  it('real changelog: unique IDs, newest first, latest exists', () => {
    const ids = CHANGELOG.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    const dates = CHANGELOG.map((e) => e.date);
    assert.deepEqual([...dates].sort().reverse(), dates);
    assert.ok(latestChangelog());
  });
});
