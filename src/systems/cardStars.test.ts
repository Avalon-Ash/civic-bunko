// 圖卡闖關的三顆星（ADR 0023）：看過、配對、實戰，只在 cardStars 導出；卡片有幾個步驟就有幾顆星。
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { COMIC_SCENES } from '../core/constants/comic';
import type { ComicSceneId, StudyCard } from '../core/types';
import { createTestWorld, testPaperFiles } from '../testing/fixture';
import { cardStars } from './cardStars';

const ids = testPaperFiles.flatMap((f) => f.questions.map((q) => q.id));
const scene = Object.keys(COMIC_SCENES)[0] as ComicSceneId;

function card(id: string, opts: { comic?: boolean; questions?: string[] } = {}): StudyCard {
  return {
    id,
    kind: 'concept',
    subjectKey: null,
    title: id,
    hook: 'h',
    visual: null,
    faces: [{ heading: '面', lines: ['甲', '乙'] }],
    lawRefs: [],
    essay: null,
    ...(opts.questions ? { questions: opts.questions } : {}),
    ...(opts.comic
      ? {
          comic: {
            layout: 'story' as const,
            panels: [0, 1].map((line) => ({ scene, actors: [], props: [], text: { from: 'line' as const, face: 0, line } })),
          },
        }
      : {}),
  };
}

function progress(correct: number) {
  return { seen: 1, correct, views: 0, streak: correct, lastPick: null, lastAt: '2026-11-27T00:00:00.000Z', due: null };
}

test('有漫畫又有題的卡有三顆星，各自從看過、配對過、題目都答對過導出', () => {
  const world = createTestWorld();
  const linked = ids.slice(0, 2);
  const c = card('c1', { comic: true, questions: linked });
  world.cards = [c];
  assert.deepEqual(cardStars(world, c), { seen: false, matched: false, cleared: false, earned: 0, total: 3, quizCleared: 0, quizTotal: 2 });

  world.settings = { ...world.settings, cardsSeen: ['c1'], cardsMatched: ['c1'] };
  world.progress.set(linked[0]!, progress(1));
  world.progress.set(linked[1]!, progress(0));
  assert.deepEqual(cardStars(world, c), { seen: true, matched: true, cleared: false, earned: 2, total: 3, quizCleared: 1, quizTotal: 2 });

  world.progress.set(linked[1]!, progress(2));
  assert.deepEqual(cardStars(world, c), { seen: true, matched: true, cleared: true, earned: 3, total: 3, quizCleared: 2, quizTotal: 2 });
});

test('沒有漫畫的卡沒有配對那顆；沒掛題的卡沒有實戰那顆', () => {
  const world = createTestWorld();
  const plain = card('p', { questions: ids.slice(0, 1) });
  const noQuiz = card('n', { comic: true });
  world.cards = [plain, noQuiz];
  world.settings = { ...world.settings, cardsSeen: ['n'], cardsMatched: ['n', 'p'] };
  assert.deepEqual(cardStars(world, plain), { seen: false, matched: null, cleared: false, earned: 0, total: 2, quizCleared: 0, quizTotal: 1 });
  assert.deepEqual(cardStars(world, noQuiz), { seen: true, matched: true, cleared: null, earned: 2, total: 2, quizCleared: 0, quizTotal: 0 });
});
