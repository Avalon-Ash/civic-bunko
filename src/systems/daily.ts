import { ACCESSORIES, DAILY_GOAL_QUESTIONS, STAMPS_PER_REWARD } from '../core/constants/daily';
import { bumpStore } from '../core/store';
import type { AccessoryId, DayKey } from '../core/types';
import type { World } from '../core/world';

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const dailyUnsubs = new WeakMap<World, () => void>();
const backfilledWorlds = new WeakSet<World>();

/** 檢查字串是否為合法的 YYYY-MM-DD 日期鍵與實際日曆日。 */
export function isValidDayKey(key: string): boolean {
  if (!DAY_KEY_RE.test(key)) return false;
  const [yStr, mStr, dStr] = key.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const check = new Date(Date.UTC(y, m - 1, d));
  return (
    check.getUTCFullYear() === y &&
    check.getUTCMonth() + 1 === m &&
    check.getUTCDate() === d
  );
}

/**
 * 將時間轉為當地日曆日期（YYYY-MM-DD）。
 * @param at ISO 時間字串或 Date 物件
 * @param utcOffsetMinutes 相對 UTC 的分鐘偏移（例如 UTC+8 為 480）；省略時使用執行環境當地時區。
 */
export function toDayKey(at: string | Date, utcOffsetMinutes?: number): DayKey | null {
  const date = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (utcOffsetMinutes === undefined) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const shifted = new Date(date.getTime() + utcOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 驗證並解析 `{ [DayKey]: number }` 紀錄；格式不符時回傳 null。 */
export function parseDaysRecord(raw: unknown): Map<DayKey, number> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const result = new Map<DayKey, number>();
  for (const [key, value] of Object.entries(raw)) {
    if (!isValidDayKey(key)) {
      return null;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return null;
    }
    result.set(key, value);
  }
  return result;
}

/** 計算目前累積已蓋的總章數（每日題數達 DAILY_GOAL_QUESTIONS 即算 1 個章）。 */
export function countTotalStamps(world: World): number {
  let total = 0;
  for (const count of world.dayLog.values()) {
    if (count >= DAILY_GOAL_QUESTIONS) {
      total += 1;
    }
  }
  return total;
}

/** 依目前累積章數回傳已解鎖的配件 ID 清單。 */
export function unlockedAccessories(world: World): AccessoryId[] {
  const total = countTotalStamps(world);
  const unlocked: AccessoryId[] = [];
  for (let i = 0; i < ACCESSORIES.length; i += 1) {
    const item = ACCESSORIES[i];
    if (!item) continue;
    const need = (i + 1) * STAMPS_PER_REWARD;
    if (total >= need) {
      unlocked.push(item.id);
    }
  }
  return unlocked;
}

/**
 * 舊資料補登：若 dayLog 為空且已有作答或觀看進度，依每題 lastAt 的當地日期統計一次作為初始值。
 * 同一個 World 只會補登一次。
 */
export function backfillDayLogFromProgress(world: World, utcOffsetMinutes?: number): boolean {
  if (world.dayLog.size > 0 || backfilledWorlds.has(world) || world.progress.size === 0) {
    return false;
  }

  backfilledWorlds.add(world);

  for (const entry of world.progress.values()) {
    if (entry.seen <= 0 && entry.views <= 0) continue;
    const day = toDayKey(entry.lastAt, utcOffsetMinutes);
    if (!day) continue;
    world.dayLog.set(day, (world.dayLog.get(day) ?? 0) + 1);
  }

  return world.dayLog.size > 0;
}

/** 清除補登標記（供匯入舊版無 days 備份檔時重新統計）。 */
export function clearBackfillMark(world: World): void {
  backfilledWorlds.delete(world);
}

/**
 * 訂閱 answered 與 viewed 事件，累計當地日期刷題次數並發出 dayLogChanged。
 * 同一個 World 重複呼叫時會先解除舊的監聽。
 */
export function attachDaily(
  world: World,
  options?: { utcOffsetMinutes?: number },
): () => void {
  const prevUnsub = dailyUnsubs.get(world);
  if (prevUnsub) {
    prevUnsub();
  }

  const recordAt = (at: string) => {
    const day = toDayKey(at, options?.utcOffsetMinutes);
    if (!day) return;
    const nextCount = (world.dayLog.get(day) ?? 0) + 1;
    world.dayLog.set(day, nextCount);
    world.bus.emit({
      type: 'dayLogChanged',
      day,
      count: nextCount,
    });
  };

  const unsubAnswered = world.bus.on('answered', (event) => {
    recordAt(event.at);
  });

  const unsubViewed = world.bus.on('viewed', (event) => {
    recordAt(event.at);
  });

  const unsubDayLog = world.bus.on('dayLogChanged', () => {
    bumpStore(world);
  });

  const unsubAll = () => {
    unsubAnswered();
    unsubViewed();
    unsubDayLog();
    if (dailyUnsubs.get(world) === unsubAll) {
      dailyUnsubs.delete(world);
    }
  };

  dailyUnsubs.set(world, unsubAll);
  return unsubAll;
}
