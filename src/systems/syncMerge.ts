import type { DayKey, ExamRecord, Progress, QuestionId } from '../core/types';

function compareTimestamp(a: string, b: string): number {
  const msA = Date.parse(a);
  const msB = Date.parse(b);
  const validA = !Number.isNaN(msA);
  const validB = !Number.isNaN(msB);

  if (validA && validB) {
    if (msA !== msB) return msA > msB ? 1 : -1;
  } else if (validA !== validB) {
    return validA ? 1 : -1;
  }
  return 0;
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

function pickWinner(a: Progress, b: Progress): Progress {
  const timeCmp = compareTimestamp(a.lastAt, b.lastAt);
  if (timeCmp !== 0) return timeCmp > 0 ? a : b;

  if (a.seen !== b.seen) return a.seen > b.seen ? a : b;
  if (a.correct !== b.correct) return a.correct > b.correct ? a : b;
  if (a.streak !== b.streak) return a.streak > b.streak ? a : b;

  const dueCmp = compareText(a.due ?? '', b.due ?? '');
  if (dueCmp !== 0) return dueCmp > 0 ? a : b;

  const pickCmp = compareText(a.lastPick ?? '', b.lastPick ?? '');
  if (pickCmp !== 0) return pickCmp > 0 ? a : b;

  const atCmp = compareText(a.lastAt, b.lastAt);
  if (atCmp !== 0) return atCmp > 0 ? a : b;

  return a;
}

function mergeEntry(a: Progress, b: Progress): Progress {
  const winner = pickWinner(a, b);
  return {
    ...winner,
    views: Math.max(a.views, b.views),
  };
}

/**
 * 逐題合併兩份進度：
 * - 只有一邊有就取那邊
 * - 兩邊都有取 lastAt 較晚的整筆（views 取兩邊較大值）
 * - lastAt 相同取 seen 較大的（同分依確定性規則裁決，保證交換律）
 */
export function mergeProgress(
  local: ReadonlyMap<QuestionId, Progress>,
  remote: ReadonlyMap<QuestionId, Progress>,
): Map<QuestionId, Progress> {
  const result = new Map<QuestionId, Progress>();
  const allIds = new Set<QuestionId>([...local.keys(), ...remote.keys()]);

  for (const id of allIds) {
    const a = local.get(id);
    const b = remote.get(id);
    if (a && b) {
      result.set(id, mergeEntry(a, b));
    } else if (a) {
      result.set(id, { ...a });
    } else if (b) {
      result.set(id, { ...b });
    }
  }

  return result;
}

/**
 * 合併兩份每日作答紀錄：每個日期取兩邊較大值，確保單調不減且符合交換律。
 */
export function mergeDays(
  local: ReadonlyMap<DayKey, number>,
  remote: ReadonlyMap<DayKey, number>,
): Map<DayKey, number> {
  const result = new Map<DayKey, number>();
  for (const [day, count] of local) {
    result.set(day, count);
  }
  for (const [day, count] of remote) {
    const existing = result.get(day);
    result.set(day, existing === undefined ? count : Math.max(existing, count));
  }
  return result;
}

/**
 * 合併兩份「看過的卡片」：聯集。先保留本機順序，再接上遠端多出來的（依字典序，確保結果與遠端順序無關）。
 */
export function mergeCardsSeen(local: readonly string[], remote: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of local) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  const extra = [...new Set(remote)].filter((id) => !seen.has(id)).sort(compareText);
  result.push(...extra);
  return result;
}

function examKey(record: ExamRecord): string {
  return `${record.at}|${record.paperId}`;
}

/**
 * 合併兩份模擬考歷次成績：以「交卷時間＋試卷」當鍵取聯集，舊到新排序，只留最後 max 筆。
 * 同一鍵兩邊都有時取本機那筆（內容應相同）。
 */
export function mergeExamHistory(
  local: readonly ExamRecord[],
  remote: readonly ExamRecord[],
  max: number,
): ExamRecord[] {
  const byKey = new Map<string, ExamRecord>();
  for (const record of remote) {
    byKey.set(examKey(record), record);
  }
  for (const record of local) {
    byKey.set(examKey(record), record);
  }
  const merged = [...byKey.entries()]
    .sort(([keyA, a], [keyB, b]) => {
      const timeCmp = compareTimestamp(a.at, b.at);
      return timeCmp !== 0 ? timeCmp : compareText(keyA, keyB);
    })
    .map(([, record]) => ({ ...record }));
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}
