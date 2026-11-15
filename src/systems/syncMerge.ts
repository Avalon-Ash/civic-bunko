import type { Progress, QuestionId } from '../core/types';

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
