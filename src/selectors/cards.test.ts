import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import type { Paper, StudyCard } from '../core/types';
import { createWorld } from '../core/world';
import { otherBank, testBank } from '../testing/fixture';
import { cardById, cardDecks, cardSubjects, cardsOfKind } from './cards';

function makeCard(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: 'card-1',
    kind: 'concept',
    subjectKey: 'subj-a',
    title: '測試卡片',
    hook: '一句話重點',
    visual: null,
    faces: [{ heading: '重點', lines: ['第一行'] }],
    lawRefs: [],
    essay: null,
    ...overrides,
  };
}

describe('cards selectors', () => {
  it('returns decks in concept -> newlaw -> essay order, skipping empty kinds and counting seen', () => {
    const world = createWorld();
    assert.deepEqual(cardDecks(world), []);

    world.cards = [
      makeCard({ id: 'e1', kind: 'essay', essay: { paperId: 'p1', no: 1 } }),
      makeCard({ id: 'c1', kind: 'concept' }),
      makeCard({ id: 'c2', kind: 'concept' }),
    ];
    dispatch(world, { type: 'markCardSeen', id: 'c2' });

    // newlaw has 0 cards so it must not appear
    assert.deepEqual(cardDecks(world), [
      { kind: 'concept', label: '觀念', total: 2, seen: 1 },
      { kind: 'essay', label: '申論', total: 1, seen: 0 },
    ]);

    world.cards.push(makeCard({ id: 'n1', kind: 'newlaw' }));
    dispatch(world, { type: 'markCardSeen', id: 'n1' });

    assert.deepEqual(cardDecks(world), [
      { kind: 'concept', label: '觀念', total: 2, seen: 1 },
      { kind: 'newlaw', label: '新法', total: 1, seen: 1 },
      { kind: 'essay', label: '申論', total: 1, seen: 0 },
    ]);
  });

  it('preserves card order in cardsOfKind and resolves seen, subjectShort, and null fallback', () => {
    const world = createWorld();
    world.banks = [testBank, otherBank];
    world.cards = [
      makeCard({ id: 'c-first', kind: 'concept', subjectKey: 'subj-b' }),
      makeCard({ id: 'n-other', kind: 'newlaw', subjectKey: 'subj-x' }),
      makeCard({ id: 'c-second', kind: 'concept', subjectKey: 'unknown-subj' }),
      makeCard({ id: 'c-third', kind: 'concept', subjectKey: null }),
    ];
    dispatch(world, { type: 'markCardSeen', id: 'c-second' });

    const concepts = cardsOfKind(world, 'concept');
    assert.deepEqual(
      concepts.map((c) => c.id),
      ['c-first', 'c-second', 'c-third'],
    );
    assert.equal(concepts[0]?.seen, false);
    assert.equal(concepts[0]?.subjectShort, '乙科');
    assert.equal(concepts[0]?.paperLabel, null);

    assert.equal(concepts[1]?.seen, true);
    assert.equal(concepts[1]?.subjectShort, null);

    assert.equal(concepts[2]?.seen, false);
    assert.equal(concepts[2]?.subjectShort, null);

    const newlaws = cardsOfKind(world, 'newlaw');
    assert.equal(newlaws.length, 1);
    assert.equal(newlaws[0]?.subjectShort, '丙科');
  });

  it('formats paperLabel from world.papers for general and local4 essay cards', () => {
    const world = createWorld();
    world.banks = [testBank];

    const generalPaper: Paper = {
      id: '113-general-local-gov',
      bankId: testBank.id,
      year: 113,
      exam: 'general',
      subjectKey: 'subj-a',
      subjectName: '地方自治概要',
      examCode: '113080',
      mcqCount: 25,
      sources: {
        q: { url: '', file: '', sha256: '' },
        s: { url: '', file: '', sha256: '' },
        m: null,
      },
    };
    const local4Paper: Paper = {
      ...generalPaper,
      id: '114-local4-local-gov',
      year: 114,
      exam: 'local4',
    };
    world.papers.set(generalPaper.id, generalPaper);
    world.papers.set(local4Paper.id, local4Paper);

    world.cards = [
      makeCard({
        id: 'essay-1',
        kind: 'essay',
        subjectKey: 'subj-a',
        essay: { paperId: generalPaper.id, no: 1 },
        essayText: '申論題原文 1',
      }),
      makeCard({
        id: 'essay-2',
        kind: 'essay',
        subjectKey: 'subj-a',
        essay: { paperId: local4Paper.id, no: 2 },
        essayText: '申論題原文 2',
      }),
      makeCard({
        id: 'essay-missing-paper',
        kind: 'essay',
        subjectKey: 'subj-a',
        essay: { paperId: 'missing-paper', no: 3 },
      }),
    ];

    const essays = cardsOfKind(world, 'essay');
    assert.equal(essays[0]?.paperLabel, '113 年普考・申論第 1 題');
    assert.equal(essays[1]?.paperLabel, '114 年地特四等・申論第 2 題');
    assert.equal(essays[2]?.paperLabel, '申論第 3 題');
  });

  it('looks up single card with cardById and returns null when missing', () => {
    const world = createWorld();
    world.banks = [testBank];
    world.cards = [makeCard({ id: 'c-1', subjectKey: 'subj-a' })];
    dispatch(world, { type: 'markCardSeen', id: 'c-1' });

    const found = cardById(world, 'c-1');
    assert.ok(found);
    assert.equal(found.id, 'c-1');
    assert.equal(found.seen, true);
    assert.equal(found.subjectShort, '甲科');
    assert.equal(found.paperLabel, null);

    assert.equal(cardById(world, 'not-exist'), null);
  });
  it('lists subjects of a card group in first-seen order with counts, skipping cards without a subject', () => {
    const world = createWorld();
    world.banks = [testBank];
    world.cards = [
      makeCard({ id: 'c-1', subjectKey: 'subj-b' }),
      makeCard({ id: 'c-2', subjectKey: 'subj-a' }),
      makeCard({ id: 'c-3', subjectKey: 'subj-b' }),
      makeCard({ id: 'c-4', subjectKey: null }),
    ];

    const subjects = cardSubjects(cardsOfKind(world, 'concept'));
    assert.deepEqual(subjects, [
      { key: 'subj-b', short: '乙科', count: 2 },
      { key: 'subj-a', short: '甲科', count: 1 },
    ]);
    assert.deepEqual(cardSubjects([]), []);
  });
});
