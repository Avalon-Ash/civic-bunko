import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../core/bus';
import { dispatch } from '../core/commands';
import { getVersion, subscribe } from '../core/store';
import { createWorld } from '../core/world';
import { loadBank } from './bankLoader';
import {
  makeConfig,
  makeSeededRng,
  otherBank,
  sampleRichEnrichFile,
  testBank,
  testEnrich,
  testEnrichFile,
  testGroup,
  testPaperFiles,
} from '../testing/fixture';

describe('bus & store & bankLoader', () => {
  it('calls bus handlers synchronously in subscription order and supports unsubscribe', () => {
    const bus = createBus();
    const order: string[] = [];

    const unsub1 = bus.on('bankLoaded', (e) => order.push(`first:${e.bankId}`));
    bus.on('bankLoaded', (e) => order.push(`second:${e.questionCount}`));

    bus.emit({ type: 'bankLoaded', bankId: 'b1', questionCount: 5 });
    assert.deepEqual(order, ['first:b1', 'second:5']);

    unsub1();
    bus.emit({ type: 'bankLoaded', bankId: 'b2', questionCount: 2 });
    assert.deepEqual(order, ['first:b1', 'second:5', 'second:2']);
  });

  it('loads banks, papers, questions (including needs_review), groups, and enrich', () => {
    const world = createWorld();
    const events: Array<{ bankId: string; questionCount: number }> = [];
    world.bus.on('bankLoaded', (e) => {
      events.push({ bankId: e.bankId, questionCount: e.questionCount });
    });

    const initialVersion = getVersion(world);
    loadBank(world, [testBank, otherBank], testPaperFiles, testEnrich);

    assert.equal(world.banks.length, 2);
    assert.equal(world.papers.size, 3);
    assert.equal(world.questions.size, 7);
    assert.equal(world.questions.get('q-a4-bad')?.parseStatus, 'needs_review');
    assert.deepEqual(world.groups.get(testGroup.id), testGroup);
    assert.equal(world.enrich.get('q-a1')?.mnemonic, '測試口訣 1');

    assert.deepEqual(events, [
      { bankId: 'test-bank', questionCount: 6 },
      { bankId: 'other-bank', questionCount: 1 },
    ]);
    assert.equal(getVersion(world), initialVersion + 2);
  });

  it('indexes EnrichFile.items into world.enrich by question id', () => {
    const world = createWorld();
    loadBank(world, [testBank], testPaperFiles, [testEnrichFile, sampleRichEnrichFile]);

    assert.equal(world.enrich.size, 2);
    assert.equal(world.enrich.get('q-a1')?.mnemonic, '測試口訣 1');
    assert.equal(world.enrich.get('q-b1')?.visual?.kind, 'versus');
    assert.equal(world.enrich.get('q-b1')?.confidence, 'low');
    assert.ok(world.enrich.get('q-b1')?.lawChanged);
  });

  it('increments store version and notifies subscribers on events and next', () => {
    const world = createWorld();
    loadBank(world, [testBank], testPaperFiles);
    let notifications = 0;
    const unsub = subscribe(world, () => {
      notifications += 1;
    });

    const v0 = getVersion(world);
    dispatch(world, { type: 'startRound', config: makeConfig({ count: 2 }) }, {
      now: () => new Date('2026-11-15T10:00:00'),
      rng: makeSeededRng(1),
    });
    const vAfterStart = getVersion(world);
    assert.ok(vAfterStart > v0);

    dispatch(world, { type: 'answer', pick: 'A' }, {
      now: () => new Date('2026-11-15T10:00:05'),
    });
    const vAfterAnswer = getVersion(world);
    assert.ok(vAfterAnswer > vAfterStart);

    dispatch(world, { type: 'next' });
    const vAfterNext = getVersion(world);
    assert.equal(vAfterNext, vAfterAnswer + 1);
    assert.ok(notifications >= 3);

    unsub();
    const countBeforeUnsub = notifications;
    dispatch(world, { type: 'setTheme', theme: 'dark' });
    assert.equal(notifications, countBeforeUnsub);
  });
});
