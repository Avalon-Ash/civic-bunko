import { ACHIEVEMENTS, DAILY_TIERS, ITEMS } from '../core/constants/wardrobe';
import type { Achievement, AchievementId, WardrobeItem } from '../core/types';
import type { World } from '../core/world';
import { countTotalStamps, toDayKey } from '../systems/daily';
import { toLocalDateString } from '../systems/date';
import {
  currentOutfit,
  fishBalance,
  itemPrice,
  outfitSpecialHints,
  outfitSpecials,
  ownedItems,
  parseScorchSpot,
  saleItems,
  scorchSpotId,
  scorchedSpots,
  sprintOpen,
  todayQuest,
  unlockedAchievements,
  wardrobeMetrics,
  type FishBalanceView,
  type ItemPriceView,
  type TodayQuestView,
} from '../systems/wardrobe';

export {
  currentOutfit,
  fishBalance,
  itemPrice,
  outfitSpecialHints,
  outfitSpecials,
  ownedItems,
  parseScorchSpot,
  saleItems,
  scorchSpotId,
  scorchedSpots,
  sprintOpen,
  todayQuest,
  unlockedAchievements,
  wardrobeMetrics,
  type FishBalanceView,
  type ItemPriceView,
  type TodayQuestView,
};

export type ItemStatusState =
  | 'owned'
  | 'buyable'
  | 'short'
  | 'stamps'
  | 'achievement'
  | 'off';

export interface ItemStatusView {
  item: WardrobeItem;
  state: ItemStatusState;
  /** 今天買要付多少（已擁有的是原價） */
  price?: number;
  /** 今天特價時的原價（沒特價就沒有這欄） */
  base?: number;
  need?: number;
  achievement?: AchievementId;
}

export interface DailyTierStatusView {
  count: number;
  tiers: Array<{ at: number; fish: number; reached: boolean }>;
}

export interface AchievementStatusView {
  achievement: Achievement;
  value: number;
  unlocked: boolean;
}

/** 依 ITEMS 順序列出每件配件的取得狀態、價格與尚缺條件。 */
export function itemStatuses(world: World, now: Date): ItemStatusView[] {
  const owned = ownedItems(world);
  const totalStamps = countTotalStamps(world);
  const { raw } = fishBalance(world, now);
  const isSprint = sprintOpen(world, now);

  return ITEMS.map((item): ItemStatusView => {
    if (owned.has(item.id)) {
      return {
        item,
        state: 'owned',
        ...(item.source.kind === 'shop' ? { price: item.source.price } : {}),
      };
    }

    if (item.source.kind === 'stamps') {
      return {
        item,
        state: 'stamps',
        need: Math.max(0, item.source.stamps - totalStamps),
      };
    }

    if (item.source.kind === 'achievement') {
      return {
        item,
        state: 'achievement',
        achievement: item.source.achievement,
      };
    }

    if (item.sprint && !isSprint) {
      return { item, state: 'off', price: item.source.price };
    }
    const cost = itemPrice(world, item.id, now);
    const price = cost?.price ?? item.source.price;
    const base = cost?.sale ? { base: cost.base } : {};
    return { item, state: raw >= price ? 'buyable' : 'short', price, ...base };
  });
}

/** 讀取今日小魚乾題數關卡的達成進度。 */
export function dailyTierStatus(world: World, now: Date): DailyTierStatusView {
  const today = toDayKey(now) ?? toLocalDateString(now);
  const count = world.dayLog.get(today) ?? 0;
  return {
    count,
    tiers: DAILY_TIERS.map((tier) => ({
      at: tier.at,
      fish: tier.fish,
      reached: count >= tier.at,
    })),
  };
}

/** 依 ACHIEVEMENTS 順序列出所有成就的目前進度與是否解鎖。 */
export function achievementStatuses(world: World): AchievementStatusView[] {
  const metrics = wardrobeMetrics(world);
  const unlocked = unlockedAchievements(world);
  return ACHIEVEMENTS.map((achievement) => ({
    achievement,
    value: metrics[achievement.metric],
    unlocked: unlocked.has(achievement.id),
  }));
}
