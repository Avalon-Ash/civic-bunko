import { ACHIEVEMENTS, DAILY_TIERS, ITEMS, SLOTS } from '../core/constants/wardrobe';
import type { Achievement, AchievementId, ItemId, Outfit, SlotId, TryOn, WardrobeItem } from '../core/types';
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
  type OutfitSpecialView,
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
  type OutfitSpecialView,
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

export interface TryOnBasketView {
  items: ItemStatusView[];
  shop: ItemStatusView[];
  total: number;
  base: number;
  short: number;
  tryOn: TryOn;
}

/** 切換試穿：同部位試穿同一件就脫掉，不然換成這件；回傳新物件不改動輸入。 */
export function toggleTryOn(tryOn: TryOn, item: WardrobeItem): TryOn {
  const next: TryOn = { ...tryOn };
  if (next[item.slot] === item.id) {
    delete next[item.slot];
  } else {
    next[item.slot] = item.id;
  }
  return next;
}

/** 把試穿中的配件疊在目前穿著上，供預覽小貓與套裝效果使用。 */
export function tryOnPreview(outfit: Outfit, tryOn: TryOn): Outfit {
  const next: Outfit = { ...outfit };
  for (const [slot, id] of Object.entries(tryOn) as Array<[SlotId, ItemId | undefined]>) {
    if (id !== undefined) {
      next[slot] = id;
    }
  }
  return next;
}

/** 過濾出仍有效的試穿配件（照 SLOTS 排序），計算整籃售價、原價與尚缺小魚乾（唯一判斷買不買得起處）。 */
export function tryOnBasket(
  statuses: readonly ItemStatusView[],
  tryOn: TryOn,
  raw: number,
): TryOnBasketView {
  const byId = new Map<ItemId, ItemStatusView>(statuses.map((s) => [s.item.id, s]));
  const items: ItemStatusView[] = [];
  const validTryOn: TryOn = {};

  for (const slot of SLOTS) {
    const id = tryOn[slot.id];
    if (!id) continue;
    const status = byId.get(id);
    if (!status || status.item.slot !== slot.id) continue;
    if (status.state === 'owned' || status.state === 'off') continue;
    items.push(status);
    validTryOn[slot.id] = id;
  }

  const shop = items.filter((s) => s.state === 'buyable' || s.state === 'short');
  let total = 0;
  let base = 0;
  for (const s of shop) {
    if (s.price !== undefined) {
      total += s.price;
      base += s.base !== undefined ? s.base : s.price;
    }
  }

  const short = total > 0 ? Math.max(0, total - raw) : 0;
  return { items, shop, total, base, short, tryOn: validTryOn };
}

/** 計算含試穿後的套裝效果，並標出哪些效果是要買下來才有的（pending）。 */
export function tryOnEffects(
  outfit: Outfit,
  tryOn: TryOn,
): {
  active: Array<OutfitSpecialView & { pending: boolean }>;
  near: Array<OutfitSpecialView & { missing: string[] }>;
} {
  const ownedActive = new Set(outfitSpecialHints(outfit).active.map((fx) => fx.id));
  const hints = outfitSpecialHints(tryOnPreview(outfit, tryOn));
  return {
    active: hints.active.map((fx) => ({ ...fx, pending: !ownedActive.has(fx.id) })),
    near: hints.near,
  };
}
