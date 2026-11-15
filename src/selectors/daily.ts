import {
  ACCESSORIES,
  DAILY_GOAL_QUESTIONS,
  MISSION_SIZE,
  STAMPS_PER_REWARD,
} from '../core/constants/daily';
import type { AccessoryId, DayKey } from '../core/types';
import type { World } from '../core/world';
import { countTotalStamps, toDayKey, unlockedAccessories } from '../systems/daily';
import { toLocalDateString } from '../systems/date';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

export interface TodayProgressView {
  count: number;
  goal: number;
  missionsDone: number;
  missionsTotal: number;
  stamped: boolean;
}

export interface WeekStampView {
  date: DayKey;
  label: string;
  isToday: boolean;
  stamped: boolean;
  count: number;
}

export interface NextAccessoryView {
  id: AccessoryId;
  name: string;
  need: number;
}

export interface StampTotalsView {
  total: number;
  unlocked: AccessoryId[];
  next: NextAccessoryView | null;
}

/** 讀取今日刷題進度（題數、目標、已完成小任務數、今日是否已蓋章）。 */
export function todayProgress(world: World, now: Date): TodayProgressView {
  const todayKey = toDayKey(now) ?? toLocalDateString(now);
  const count = world.dayLog.get(todayKey) ?? 0;
  const missionsTotal = Math.floor(DAILY_GOAL_QUESTIONS / MISSION_SIZE);
  const missionsDone = Math.min(missionsTotal, Math.floor(count / MISSION_SIZE));
  return {
    count,
    goal: DAILY_GOAL_QUESTIONS,
    missionsDone,
    missionsTotal,
    stamped: count >= DAILY_GOAL_QUESTIONS,
  };
}

/** 計算本週（週一到週日）每日的刷題數與蓋章狀態。 */
export function weekStamps(world: World, now: Date): WeekStampView[] {
  const todayStr = toLocalDateString(now);
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return WEEKDAY_LABELS.map((label, idx) => {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + idx);
    const date = toLocalDateString(dayDate);
    const count = world.dayLog.get(date) ?? 0;
    return {
      date,
      label,
      isToday: date === todayStr,
      stamped: count >= DAILY_GOAL_QUESTIONS,
      count,
    };
  });
}

/** 計算累積總章數、已解鎖配件清單與下一個待解鎖配件所需章數。 */
export function stampTotals(world: World): StampTotalsView {
  const total = countTotalStamps(world);
  const unlocked = unlockedAccessories(world);

  let next: NextAccessoryView | null = null;
  for (let i = 0; i < ACCESSORIES.length; i += 1) {
    const item = ACCESSORIES[i];
    if (!item) continue;
    const threshold = (i + 1) * STAMPS_PER_REWARD;
    if (total < threshold) {
      next = {
        id: item.id,
        name: item.name,
        need: threshold - total,
      };
      break;
    }
  }

  return { total, unlocked, next };
}

/** 讀取貓目前配戴的配件；若尚未解鎖則回傳 null。 */
export function currentAccessory(world: World): AccessoryId | null {
  const chosen = world.settings.accessory ?? null;
  if (chosen === null) {
    return null;
  }
  return unlockedAccessories(world).includes(chosen) ? chosen : null;
}
