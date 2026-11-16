import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getVersion } from '../core/store';
import type { CardFile, PaperFile, StudyCard } from '../core/types';
import { createWorld } from '../core/world';
import { testPaperA, testPaperB } from '../testing/fixture';
import { loadCards } from './cardLoader';

function makeStudyCard(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: 'card-1',
    kind: 'concept',
    subjectKey: 'subj-a',
    title: '測試圖卡',
    hook: '重點一句話',
    visual: null,
    faces: [{ heading: '重點', lines: ['內容'] }],
    lawRefs: [],
    essay: null,
    ...overrides,
  };
}

describe('cardLoader', () => {
  it('populates essayText from official essays, skips missing essays, deduplicates ids, and emits cardsLoaded', () => {
    const world = createWorld();
    const emitted: number[] = [];
    world.bus.on('cardsLoaded', (e) => {
      emitted.push(e.count);
    });
    const initialVersion = getVersion(world);

    const paperFiles: PaperFile[] = [
      {
        paper: testPaperA,
        groups: [],
        questions: [],
        essays: [
          { no: 1, text: '115 普考甲科申論第一題官方原文。' },
        ],
      },
      {
        paper: testPaperB,
        groups: [],
        questions: [],
        essays: [],
      },
    ];

    const cardFiles: CardFile[] = [
      {
        deck: 'concept',
        title: '觀念卡',
        cards: [
          makeStudyCard({ id: 'dup-id', title: '第一張保留' }),
          makeStudyCard({ id: 'dup-id', title: '同檔重複捨棄' }),
        ],
      },
      {
        deck: 'essay',
        title: '申論卡',
        cards: [
          makeStudyCard({ id: 'dup-id', title: '跨檔重複捨棄' }),
          makeStudyCard({
            id: 'essay-valid',
            kind: 'essay',
            title: '有對應申論題',
            essay: { paperId: testPaperA.id, no: 1 },
          }),
          makeStudyCard({
            id: 'essay-missing-no',
            kind: 'essay',
            title: '題號不存在',
            essay: { paperId: testPaperA.id, no: 2 },
          }),
          makeStudyCard({
            id: 'essay-missing-paper',
            kind: 'essay',
            title: '試卷不存在',
            essay: { paperId: 'missing-paper-id', no: 1 },
          }),
        ],
      },
    ];

    loadCards(world, cardFiles, paperFiles);

    assert.equal(world.cards.length, 2);
    assert.equal(world.cards[0]?.id, 'dup-id');
    assert.equal(world.cards[0]?.title, '第一張保留');
    assert.equal(world.cards[0]?.essayText, undefined);

    assert.equal(world.cards[1]?.id, 'essay-valid');
    assert.equal(world.cards[1]?.essayText, '115 普考甲科申論第一題官方原文。');

    assert.deepEqual(emitted, [2]);
    assert.equal(getVersion(world), initialVersion + 1);
  });
});
