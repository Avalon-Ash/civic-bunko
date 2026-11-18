import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../core/commands';
import { DAILY_GOAL_QUESTIONS, STAMPS_PER_REWARD } from '../core/constants/daily';
import {
  ACHIEVEMENTS,
  DAILY_TIERS,
  FISH_PER_QUESTION,
  QUESTS,
  QUEST_ROUND_MIN,
  SPRINT_DAYS,
  WARDROBE_START_DAY,
  WELCOME_FISH,
} from '../core/constants/wardrobe';
import { getVersion } from '../core/store';
import type { StudyCard } from '../core/types';
import { createWorld, type World } from '../core/world';
import { createTestWorld, makeConfig, makeSeededRng, testPaperA } from '../testing/fixture';
import { addDaysLocal, toLocalDateString } from './date';
import {
  attachWardrobe,
  currentOutfit,
  fishBalance,
  ownedItems,
  sprintOpen,
  todayQuest,
  unlockedAchievements,
  wardrobeMetrics,
} from './wardrobe';

function findDayForQuest(kind: string, world = createWorld()): { day: string; date: Date } {
  for (let i = 0; i < 60; i += 1) {
    const date = new Date(2026, 10, 17 + i, 12, 0, 0);
    const picked = todayQuest(world, date);
    if (picked?.quest.kind === kind) {
      return { day: toLocalDateString(date), date };
    }
  }
  throw new Error(`Could not find a day for quest kind ${kind}`);
}

function makeTestCard(id: string): StudyCard {
  return {
    id,
    kind: 'concept',
    subjectKey: null,
    title: id,
    hook: '重點',
    visual: null,
    faces: [{ heading: '面', lines: ['內容'] }],
    lawRefs: [],
    essay: null,
  };
}

describe('wardrobe system', () => {
  it('computes fish balance from WARDROBE_START_DAY, daily tiers, welcome, achievements, quests, spent, and skips unknown IDs', () => {
    const world = createWorld();
    const dayBefore = addDaysLocal(new Date(`${WARDROBE_START_DAY}T12:00:00`), -1);
    const dayOn = WARDROBE_START_DAY;
    const dayAfter = addDaysLocal(new Date(`${WARDROBE_START_DAY}T12:00:00`), 1);

    // Before WARDROBE_START_DAY: 0 fish for questions or tiers
    world.dayLog.set(dayBefore, 40);
    // On WARDROBE_START_DAY: 30 questions -> 每題的＋三個關卡
    world.dayLog.set(dayOn, 30);
    // Day after: 6 questions -> 每題的＋第一個關卡
    world.dayLog.set(dayAfter, 6);

    world.settings.wardrobe = {
      owned: ['beanie', 'unknown-shop-item'], // beanie = 80
      achievements: ['stamps-3', 'unknown-ach'], // 存檔裡的成就算數；不認得的略過
      quests: {
        [dayOn]: ['quiz-round', 'unknown-quest'], // 不認得的任務略過
      },
    };

    const expectedQuestions = 36 * FISH_PER_QUESTION;
    const expectedTiers =
      (DAILY_TIERS[0]!.fish + DAILY_TIERS[1]!.fish + DAILY_TIERS[2]!.fish) +
      DAILY_TIERS[0]!.fish;
    // 成就＝存檔裡的 ∪ 目前條件已達成的（這份紀錄也達成了幾個低門檻的）
    const unlocked = unlockedAchievements(world);
    assert.ok(unlocked.has('stamps-3'));
    const expectedAchievements = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).reduce((sum, a) => sum + a.fish, 0);
    const expectedQuests = QUESTS.find((q) => q.id === 'quiz-round')!.fish;
    const expectedEarned = expectedQuestions + expectedTiers + WELCOME_FISH + expectedAchievements + expectedQuests;
    const expectedSpent = 80;

    const fb = fishBalance(world, new Date(`${dayOn}T12:00:00`));
    assert.deepEqual(fb, {
      balance: expectedEarned - expectedSpent,
      raw: expectedEarned - expectedSpent,
      earned: expectedEarned,
      spent: expectedSpent,
      parts: {
        questions: expectedQuestions,
        tiers: expectedTiers,
        welcome: WELCOME_FISH,
        achievements: expectedAchievements,
        quests: expectedQuests,
      },
    });
  });

  it('handles negative fish balance when overspent across devices: balance is 0, raw is negative, cannot buy', () => {
    const world = createWorld();
    // Welcome fish is 150; spending 200 (wings = 300) puts raw = -150
    world.settings.wardrobe = {
      owned: ['wings'],
      achievements: [],
      quests: {},
    };

    const now = new Date('2026-11-17T12:00:00');
    const fb = fishBalance(world, now);
    assert.equal(fb.raw, WELCOME_FISH - 300);
    assert.equal(fb.balance, 0);

    let settingsEvents = 0;
    world.bus.on('settingsChanged', () => {
      settingsEvents += 1;
    });

    dispatch(world, { type: 'buyItem', id: 'star-clip' }, { now: () => now });
    assert.equal(world.settings.wardrobe.owned.includes('star-clip'), false);
    assert.equal(settingsEvents, 0);
  });

  it('grants ownership from stamps and unlocked achievements', () => {
    const world = createWorld();
    for (let i = 1; i <= STAMPS_PER_REWARD * 2; i += 1) {
      world.dayLog.set(`2026-10-${String(i).padStart(2, '0')}`, DAILY_GOAL_QUESTIONS);
    }
    world.settings.examHistory = [
      {
        paperId: 'p1',
        at: '2026-11-17T10:00:00.000Z',
        total: 50,
        answered: 50,
        correct: 40,
        score: 80,
      },
    ];

    const owned = ownedItems(world);
    assert.equal(owned.has('bow'), true);
    assert.equal(owned.has('straw-hat'), true);
    assert.equal(owned.has('scarf'), false);
    assert.equal(owned.has('grad-cap'), true);
    assert.equal(owned.has('monocle'), false);
  });

  it('computes stampStreak across gaps, backfills achievements without writing save, keeps saved achievements when metric drops, and celebrates once', () => {
    const world = createWorld();
    // Streak 1: Nov 1..2 (2 days), gap Nov 3, Streak 2: Nov 4..6 (3 days)
    world.dayLog.set('2026-11-01', 15);
    world.dayLog.set('2026-11-02', 15);
    world.dayLog.set('2026-11-03', 14);
    world.dayLog.set('2026-11-04', 20);
    world.dayLog.set('2026-11-05', 15);
    world.dayLog.set('2026-11-06', 15);
    assert.equal(wardrobeMetrics(world).stampStreak, 3);

    // Trigger passive check via bankLoaded with 300 questions in dayLog
    world.dayLog.clear();
    world.dayLog.set('2026-11-10', 150);
    world.dayLog.set('2026-11-11', 150);
    const rewardEvents: number[] = [];
    world.bus.on('rewardsEarned', (e) => rewardEvents.push(e.rewards.length));
    world.bus.emit({ type: 'bankLoaded', bankId: 'b', questionCount: 1 });

    assert.equal(unlockedAchievements(world).has('answered-100'), true);
    assert.equal(unlockedAchievements(world).has('answered-300'), true);
    // 補發的是「目前條件已達成」的全部成就，照 ACHIEVEMENTS 的順序，一次發完
    const backfilled = ACHIEVEMENTS.filter((a) => unlockedAchievements(world).has(a.id));
    assert.deepEqual(
      world.celebrations,
      backfilled.map((a) => ({ kind: 'achievement', id: a.id })),
    );
    const getWardrobe = (w: World) => w.settings.wardrobe;
    assert.equal(getWardrobe(world), undefined);
    assert.deepEqual(rewardEvents, [backfilled.length]);

    // Emitting bankLoaded again does not re-celebrate
    world.bus.emit({ type: 'bankLoaded', bankId: 'b', questionCount: 1 });
    assert.equal(world.celebrations.length, backfilled.length);

    // dayLogChanged persists achievements into wardrobe.achievements
    world.dayLog.set('2026-11-17', 1);
    world.bus.emit({ type: 'dayLogChanged', day: '2026-11-17', count: 1 });
    assert.deepEqual(
      getWardrobe(world)?.achievements,
      backfilled.map((a) => a.id),
    );
    assert.equal(world.celebrations.length, backfilled.length);

    // Even if dayLog drops below 300, saved achievements stay unlocked
    world.dayLog.clear();
    assert.equal(wardrobeMetrics(world).answeredTotal, 0);
    assert.equal(unlockedAchievements(world).has('answered-100'), true);
    assert.equal(unlockedAchievements(world).has('answered-300'), true);

    // dismissCelebrations clears world.celebrations and bumps store
    const beforeVer = getVersion(world);
    dispatch(world, { type: 'dismissCelebrations' });
    assert.deepEqual(world.celebrations, []);
    assert.equal(getVersion(world) > beforeVer, true);
  });

  it('picks deterministic todayQuest across two worlds, excludes unavailable quests, and validates completion rules', () => {
    const worldA = createWorld();
    const worldB = createWorld();
    const day = new Date('2026-11-17T09:00:00');

    // Give both a wrong question so pools are identical
    const wrongProg = {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'A' as const,
      lastAt: '2026-11-16T09:00:00.000Z',
      due: '2026-11-17',
    };
    worldA.progress.set('q1', { ...wrongProg });
    worldB.progress.set('q1', { ...wrongProg });

    assert.deepEqual(todayQuest(worldA, day), todayQuest(worldB, day));

    // Exclude new-card when cards loaded & all seen; exclude wrong-round when no wrong question
    const worldFiltered = createWorld();
    worldFiltered.cards = [makeTestCard('c1'), makeTestCard('c2')];
    worldFiltered.settings.cardsSeen = ['c1', 'c2'];
    // Test across 30 days: neither new-card nor wrong-round should ever be picked
    for (let i = 0; i < 30; i += 1) {
      const q = todayQuest(worldFiltered, new Date(2026, 10, 17 + i, 12, 0, 0));
      assert.ok(q !== null);
      assert.notEqual(q.quest.kind, 'new-card');
      assert.notEqual(q.quest.kind, 'wrong-round');
    }

    // Wrong quest kind or non-today event does NOT complete today's quest
    const quizDay = findDayForQuest('quiz-round', worldFiltered);
    attachWardrobe(worldFiltered, { now: () => quizDay.date });
    const yesterdayIso = new Date(
      quizDay.date.getFullYear(),
      quizDay.date.getMonth(),
      quizDay.date.getDate() - 1,
      12,
      0,
      0,
    ).toISOString();
    const todayIso = quizDay.date.toISOString();

    // Non-today event ignored
    worldFiltered.bus.emit({
      type: 'roundFinished',
      at: yesterdayIso,
      results: Array.from({ length: QUEST_ROUND_MIN }, (_, i) => ({
        id: `q${i}`,
        pick: 'A',
        correct: true,
      })),
      config: makeConfig({ study: 'quiz' }),
    });
    assert.equal(todayQuest(worldFiltered, quizDay.date)?.done, false);

    // Wrong kind (examFinished on a quiz-round day) ignored for quest
    worldFiltered.bus.emit({
      type: 'examFinished',
      record: { paperId: 'p1', at: todayIso, total: 10, answered: 10, correct: 5, score: 50 },
    });
    assert.equal(todayQuest(worldFiltered, quizDay.date)?.done, false);

    // Too few questions for quiz-round ignored
    worldFiltered.bus.emit({
      type: 'roundFinished',
      at: todayIso,
      results: Array.from({ length: QUEST_ROUND_MIN - 1 }, (_, i) => ({
        id: `q${i}`,
        pick: 'A',
        correct: true,
      })),
      config: makeConfig({ study: 'quiz' }),
    });
    assert.equal(todayQuest(worldFiltered, quizDay.date)?.done, false);

    // Matching quiz-round completes it once
    worldFiltered.bus.emit({
      type: 'roundFinished',
      at: todayIso,
      results: Array.from({ length: QUEST_ROUND_MIN }, (_, i) => ({
        id: `q${i}`,
        pick: 'A',
        correct: true,
      })),
      config: makeConfig({ study: 'quiz' }),
    });
    assert.equal(todayQuest(worldFiltered, quizDay.date)?.done, true);
    assert.deepEqual(worldFiltered.settings.wardrobe?.quests[quizDay.day], ['quiz-round']);
    const celebCountAfterDone = worldFiltered.celebrations.length;

    // Triggering again does not duplicate or re-celebrate
    worldFiltered.bus.emit({
      type: 'roundFinished',
      at: todayIso,
      results: Array.from({ length: QUEST_ROUND_MIN }, (_, i) => ({
        id: `q${i}`,
        pick: 'A',
        correct: true,
      })),
      config: makeConfig({ study: 'quiz' }),
    });
    assert.deepEqual(worldFiltered.settings.wardrobe?.quests[quizDay.day], ['quiz-round']);
    assert.equal(worldFiltered.celebrations.length, celebCountAfterDone);
  });

  it('completes wrong-round on last wrong question and new-card on last unseen card', () => {
    // 1. wrong-round finishing the very last wrong question
    const worldWrong = createTestWorld();
    worldWrong.progress.set('q-a1', {
      seen: 1,
      correct: 0,
      views: 0,
      streak: 0,
      lastPick: 'B',
      lastAt: '2026-11-16T10:00:00.000Z',
      due: '2026-11-17',
    });
    const wrongDay = findDayForQuest('wrong-round', worldWrong);
    attachWardrobe(worldWrong, { now: () => wrongDay.date });

    dispatch(
      worldWrong,
      { type: 'startRound', config: makeConfig({ mode: 'wrong', subjectKeys: ['subj-a'], ask: 'all' }) },
      { now: () => wrongDay.date, rng: makeSeededRng(1) },
    );
    dispatch(worldWrong, { type: 'answer', pick: 'A' }, { now: () => wrongDay.date });
    dispatch(worldWrong, { type: 'next' }, { now: () => wrongDay.date });

    assert.equal(todayQuest(worldWrong, wrongDay.date)?.done, true);
    assert.deepEqual(worldWrong.settings.wardrobe?.quests[wrongDay.day], ['wrong-round']);

    // 2. new-card finishing the very last unseen card
    const worldCard = createWorld();
    worldCard.cards = [makeTestCard('c1')];
    const cardDay = findDayForQuest('new-card', worldCard);
    attachWardrobe(worldCard, { now: () => cardDay.date });

    dispatch(worldCard, { type: 'markCardSeen', id: 'c1' }, { now: () => cardDay.date });
    assert.equal(todayQuest(worldCard, cardDay.date)?.done, true);
    assert.deepEqual(worldCard.settings.wardrobe?.quests[cardDay.day], ['new-card']);

    // 3. topic-round and exam quests
    const worldTopic = createWorld();
    const topicDay = findDayForQuest('topic-round', worldTopic);
    attachWardrobe(worldTopic, { now: () => topicDay.date });
    worldTopic.bus.emit({
      type: 'roundFinished',
      at: topicDay.date.toISOString(),
      results: [{ id: 'q-a1', pick: 'A', correct: true }],
      config: makeConfig({ topicIds: ['t-1'] }),
    });
    assert.equal(todayQuest(worldTopic, topicDay.date)?.done, true);

    const worldExam = createWorld();
    const examDay = findDayForQuest('exam', worldExam);
    attachWardrobe(worldExam, { now: () => examDay.date });
    worldExam.bus.emit({
      type: 'examFinished',
      record: {
        paperId: testPaperA.id,
        at: examDay.date.toISOString(),
        total: 10,
        answered: 10,
        correct: 8,
        score: 80,
      },
    });
    assert.equal(todayQuest(worldExam, examDay.date)?.done, true);
  });

  it('enforces buyItem and wear rules, sprint window, legacy accessory fallback, and does not touch settings.accessory', () => {
    const world = createTestWorld(); // testBank examDate = '2026-12-05', otherBank = '2026-12-10'
    // 2026-12-05 - 18 days = 2026-11-17
    const beforeSprint = new Date(2026, 10, 16, 12, 0, 0);
    const onSprintStart = new Date(2026, 10, 17, 12, 0, 0);
    const onExamDay = new Date(2026, 11, 5, 12, 0, 0);
    const afterExam = new Date(2026, 11, 11, 12, 0, 0);

    assert.equal(SPRINT_DAYS, 18);
    assert.equal(sprintOpen(world, beforeSprint), false);
    assert.equal(sprintOpen(world, onSprintStart), true);
    assert.equal(sprintOpen(world, onExamDay), true);
    assert.equal(sprintOpen(world, afterExam), false);

    // Cannot buy item too expensive before earning extra fish (WELCOME_FISH=150, wings=300)
    dispatch(world, { type: 'buyItem', id: 'wings' }, { now: () => onSprintStart });
    assert.equal(ownedItems(world).has('wings'), false);

    // Give 18 stamps so legacy 'crown' is unlocked
    for (let i = 1; i <= 18; i += 1) {
      world.dayLog.set(`2026-10-${String(i).padStart(2, '0')}`, DAILY_GOAL_QUESTIONS);
    }
    world.settings.accessory = 'crown';
    assert.deepEqual(currentOutfit(world), { 'head-top': 'crown' });

    // Cannot buy sprint item outside sprint window
    dispatch(world, { type: 'buyItem', id: 'hachimaki' }, { now: () => beforeSprint });
    assert.equal(ownedItems(world).has('hachimaki'), false);

    // Cannot buy non-shop item
    dispatch(world, { type: 'buyItem', id: 'bow' }, { now: () => onSprintStart });
    assert.equal(world.settings.wardrobe?.owned.includes('bow') ?? false, false);

    // Can buy sprint item inside sprint window (hachimaki = 60)
    dispatch(world, { type: 'buyItem', id: 'hachimaki' }, { now: () => onSprintStart });
    assert.equal(ownedItems(world).has('hachimaki'), true);
    // Bought sprint item remains owned after exam
    assert.equal(ownedItems(world).has('hachimaki'), true);

    // Buying already-owned item is a no-op
    let eventsOnDupBuy = 0;
    world.bus.on('settingsChanged', () => {
      eventsOnDupBuy += 1;
    });
    dispatch(world, { type: 'buyItem', id: 'hachimaki' }, { now: () => onSprintStart });
    assert.equal(eventsOnDupBuy, 0);

    // Wear rejects wrong slot or unowned item
    dispatch(world, { type: 'wear', slot: 'neck', item: 'hachimaki' });
    dispatch(world, { type: 'wear', slot: 'head-top', item: 'beanie' });
    assert.equal(eventsOnDupBuy, 0);
    assert.deepEqual(currentOutfit(world), { 'head-top': 'crown' });

    // Wear owned item initializes wardrobe.outfit from currentOutfit, preserves other slots, never edits settings.accessory
    dispatch(world, { type: 'wear', slot: 'head-side', item: 'bow' });
    assert.equal(world.settings.accessory, 'crown');
    assert.deepEqual(currentOutfit(world), { 'head-top': 'crown', 'head-side': 'bow' });

    // Unequip with null
    dispatch(world, { type: 'wear', slot: 'head-top', item: null });
    assert.equal(world.settings.accessory, 'crown');
    assert.deepEqual(currentOutfit(world), { 'head-side': 'bow' });
  });

  it('does not loop when settingsChanged is emitted with nothing new', () => {
    const world = createWorld();
    let count = 0;
    world.bus.on('settingsChanged', () => {
      count += 1;
    });

    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
    assert.equal(count, 1);
  });

  it('never fails when QUESTS has all 5 kinds', () => {
    assert.equal(QUESTS.length, 5);
  });
});
