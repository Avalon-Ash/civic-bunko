import type { World } from '../core/world';

export interface ProgressOverviewView {
  seenCount: number;
  lastAnsweredAt: string | null;
}

/** 讀取使用者是否已永久關閉「加到主畫面」引導（舊存檔缺欄位時視為 false）。 */
export function isInstallHintDismissed(world: World): boolean {
  return world.settings.installHintDismissed === true;
}

/** 統計已作答題數與最近一次作答時間（ISO 字串；無紀錄時為 null）。 */
export function progressOverview(world: World): ProgressOverviewView {
  let seenCount = 0;
  let latestMs = -Infinity;
  let lastAnsweredAt: string | null = null;

  for (const entry of world.progress.values()) {
    if (entry.seen <= 0) continue;
    seenCount += 1;
    const ms = Date.parse(entry.lastAt);
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      lastAnsweredAt = entry.lastAt;
    }
  }

  return { seenCount, lastAnsweredAt };
}
