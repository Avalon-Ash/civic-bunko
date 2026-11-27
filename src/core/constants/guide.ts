// SSOT：引導的落點與目的地（docs/plans/ux-cleanup.md §2.2、ADR 0019）。
// 任務的目的地寫在 QUESTS 每一列的 go（constants/wardrobe.ts），共用的目的地從這裡取；
// 其他「叫她去做某件事」的地方一律讀這裡，畫面只經 ui/useGuide.ts 的 go() 換頁與落點。
import type { AchievementMetric, GuideAnchor, GuidePreset, GuideTarget } from '../types';

/** 每個落點標在哪裡（畫面用 guideAnchor(id) 標上；同一個 id 只標一個元素） */
export const GUIDE_ANCHORS: Readonly<Record<GuideAnchor, string>> = {
  'quiz-start': '刷題設定頁的「開始刷」',
  'quiz-topic': '刷題設定頁的弱點回合＋高頻回合那一列',
  'quiz-exam': '刷題設定頁的模擬考',
  'today-quick': '今日頁「3 回快刷」的第一張',
  'cards-unseen': '圖卡頁第一張還沒看過的卡（都看過就不標）',
  'cat-wardrobe': '小貓頁的試衣間（換裝）',
  'cat-achievements': '小貓頁的成就區',
  'stamps-sync': '集章頁的同步與備份',
};

/** 每個預選到了之後做什麼 */
export const GUIDE_PRESETS: Readonly<Record<GuidePreset, string>> = {
  'wrong-mode': '刷題設定頁的出題模式改成「錯題」',
  'exam-sheet': '刷題設定頁打開模擬考的選卷抽屜',
  'open-sync': '集章頁展開同步與備份',
  'all-achievements': '小貓頁成就改成顯示全部',
};

// ── 共用的目的地 ──────────────────────────────────────────
/** 去刷題：落在「開始刷」（範圍與題數她自己定，不替她按） */
export const GO_START: GuideTarget = { tab: 'quiz', anchor: 'quiz-start' };
/** 去刷題、出題模式先選好錯題 */
export const GO_WRONG: GuideTarget = { tab: 'quiz', anchor: 'quiz-start', preset: 'wrong-mode' };
/** 去刷弱點或高頻：落在那一列，哪一顆她選 */
export const GO_TOPIC: GuideTarget = { tab: 'quiz', anchor: 'quiz-topic' };
/** 去考模擬考：打開選卷抽屜（要選卷，不能直接開始） */
export const GO_EXAM: GuideTarget = { tab: 'quiz', anchor: 'quiz-exam', preset: 'exam-sheet' };
/** 去今日頁的 3 回快刷 */
export const GO_QUICK: GuideTarget = { tab: 'today', anchor: 'today-quick' };
/** 去看第一張沒看過的圖卡 */
export const GO_UNSEEN_CARD: GuideTarget = { tab: 'cards', anchor: 'cards-unseen' };
/** 去幫小貓換裝 */
export const GO_WARDROBE: GuideTarget = { tab: 'cat', anchor: 'cat-wardrobe' };
/** 去看全部成就 */
export const GO_ACHIEVEMENTS: GuideTarget = { tab: 'cat', anchor: 'cat-achievements', preset: 'all-achievements' };
/** 回合已經開好：換到刷題分頁就是題目頁（不落點、不預選） */
export const GO_ROUND: GuideTarget = { tab: 'quiz' };
/** 去同步與備份（自動展開） */
export const GO_SYNC: GuideTarget = { tab: 'stamps', anchor: 'stamps-sync', preset: 'open-sync' };

/** 成就卡：照它算的數字決定去哪裡做 */
export const ACHIEVEMENT_GO: Readonly<Record<AchievementMetric, GuideTarget>> = {
  answeredTotal: GO_START,
  mastered: GO_START,
  stamps: GO_QUICK,
  stampStreak: GO_QUICK,
  cardsSeen: GO_UNSEEN_CARD,
  examCount: GO_EXAM,
  examBest: GO_EXAM,
};

/** 其他「叫她去做某件事」的地方 */
export const GUIDE = {
  /** 今日任務做完了：去換裝 */
  questDone: GO_WARDROBE,
  /** 題數獎勵 5／15／30 題 */
  fishBonus: GO_START,
  /** 配件「再 N 個章」 */
  stampsItem: GO_QUICK,
  /** 配件「成就獎勵」 */
  achievementItem: GO_ACHIEVEMENTS,
  /** 集章頁：再多刷幾題才有弱點排行 */
  weakEmpty: GO_START,
  /** 今日頁：同步出錯 */
  syncError: GO_SYNC,
  /** 集章頁：幫小貓換裝 */
  dressCat: GO_WARDROBE,
  /** 圖卡頁：還在準備中，先去刷題 */
  cardsEmpty: GO_START,
  /** 領養抽屜、試衣間：還差 N 條小魚乾 */
  fishShort: GO_START,
  /** 完成提示（任務、成就） */
  rewardToast: GO_WARDROBE,
  /** 圖卡抽屜「刷這張卡的題」 */
  cardRound: GO_ROUND,
  /** 今日頁的快刷、續玩，集章頁的弱點與高頻回合：開好回合就去作答 */
  roundStarted: GO_ROUND,
  /** 今日頁：沒有可刷的題，去刷題設定調範圍 */
  noMissions: GO_START,
} as const satisfies Record<string, GuideTarget>;
