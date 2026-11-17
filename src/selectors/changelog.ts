import { CHANGELOG } from '../core/constants/changelog';
import type { ChangelogEntry } from '../core/types';
import type { World } from '../core/world';

/** 最新一則更新紀錄（沒有任何紀錄時為 null）。 */
export function latestChangelog(entries: readonly ChangelogEntry[] = CHANGELOG): ChangelogEntry | null {
  return entries[0] ?? null;
}

/**
 * 還沒看過的更新紀錄（新到舊）：
 * - 看過的 ID 在清單裡：回傳比它新的那幾則；
 * - 沒看過任何一則、或看過的 ID 已經不在清單裡：只回傳最新一則（不把整份歷史倒給她）。
 */
export function unseenChangelog(
  world: World,
  entries: readonly ChangelogEntry[] = CHANGELOG,
): ChangelogEntry[] {
  const latest = latestChangelog(entries);
  if (!latest) return [];
  const seen = world.settings.changelogSeen;
  if (seen === latest.id) return [];
  const idx = seen === undefined ? -1 : entries.findIndex((e) => e.id === seen);
  return idx > 0 ? entries.slice(0, idx) : [latest];
}
