import type {
  CatProfile,
  DayKey,
  ExamRecord,
  Progress,
  QuestId,
  QuestionId,
  WardrobeState,
} from '../core/types';

export type SyncWardrobe = Pick<WardrobeState, 'owned' | 'achievements' | 'quests' | 'saved' | 'repairs'>;

/** 衣櫥裡要同步的那幾欄（outfit、scorch 不同步）；沒有衣櫥資料就是空的 */
export function toSyncWardrobe(wardrobe: WardrobeState | undefined): SyncWardrobe {
  if (!wardrobe) return { owned: [], achievements: [], quests: {} };
  const saved = cleanSaved(wardrobe.saved);
  const repairs = cleanRepairs(wardrobe.repairs);
  return {
    owned: wardrobe.owned,
    achievements: wardrobe.achievements,
    quests: wardrobe.quests,
    ...(saved ? { saved } : {}),
    ...(repairs ? { repairs } : {}),
  };
}

/** 修過幾次燒焦：只留正的整數；沒有（或壞資料）回傳 undefined（那一欄就不寫） */
export function cleanRepairs(repairs: unknown): number | undefined {
  return typeof repairs === 'number' && Number.isFinite(repairs) && repairs >= 1 ? Math.floor(repairs) : undefined;
}

/** 特價省下的紀錄：只留正的整數，鍵照字典序；一筆都沒有回傳 undefined（那一欄就不寫） */
export function cleanSaved(saved: Readonly<Record<string, number>> | undefined): Record<string, number> | undefined {
  const entries = Object.entries(saved ?? {})
    .filter(([, amount]) => Number.isFinite(amount) && amount >= 1)
    .map(([id, amount]): [string, number] => [id, Math.floor(amount)])
    .sort(([a], [b]) => compareText(a, b));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** 兩份特價紀錄是不是一樣（清理過再比） */
export function sameSaved(a: Readonly<Record<string, number>> | undefined, b: Readonly<Record<string, number>> | undefined): boolean {
  return JSON.stringify(cleanSaved(a) ?? {}) === JSON.stringify(cleanSaved(b) ?? {});
}

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

function mergeSortedUnique(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].sort(compareText);
}

/**
 * 合併兩份衣櫥進度（owned、achievements、quests）：全部取聯集並排序，結果與參數順序無關。
 * saved（特價省下的）每件取兩邊較大值：只會變多，兩台各自記到的都留下。
 * repairs（修過幾次燒焦）取兩邊較大值：兩台各自離線修的不會加總（花掉的只會少算，不會多扣）。
 * 不含 outfit（目前穿著只存在各裝置）。
 */
export function mergeWardrobe(
  local: SyncWardrobe | undefined,
  remote: SyncWardrobe | undefined,
): SyncWardrobe {
  const owned = mergeSortedUnique(local?.owned ?? [], remote?.owned ?? []);
  const achievements = mergeSortedUnique(
    local?.achievements ?? [],
    remote?.achievements ?? [],
  );

  const dayKeys = mergeSortedUnique(
    Object.keys(local?.quests ?? {}),
    Object.keys(remote?.quests ?? {}),
  );
  const quests: Record<DayKey, QuestId[]> = {};
  for (const day of dayKeys) {
    const mergedIds = mergeSortedUnique(
      local?.quests[day] ?? [],
      remote?.quests[day] ?? [],
    );
    if (mergedIds.length > 0) {
      quests[day] = mergedIds;
    }
  }

  const savedAll: Record<string, number> = { ...cleanSaved(local?.saved) };
  for (const [id, amount] of Object.entries(cleanSaved(remote?.saved) ?? {})) {
    savedAll[id] = Math.max(savedAll[id] ?? 0, amount);
  }
  const saved = cleanSaved(savedAll);

  const repairs = cleanRepairs(Math.max(cleanRepairs(local?.repairs) ?? 0, cleanRepairs(remote?.repairs) ?? 0));

  return { owned, achievements, quests, ...(saved ? { saved } : {}), ...(repairs ? { repairs } : {}) };
}

/**
 * 合併兩台裝置的小貓個人設定：改動時間較新的那一包整包留下（不是誰後同步誰贏，兩台算出來一樣）。
 * 時間一樣或都不知道時：有名字的贏過沒名字的，再不行比名字的字串，確保結果與順序無關。
 */
export function mergeCatProfile(a: CatProfile | null, b: CatProfile | null): CatProfile | null {
  if (a === null) return b;
  if (b === null) return a;
  const byTime = compareTimestamp(a.at, b.at);
  if (byTime !== 0) return byTime > 0 ? a : b;
  if ((a.name === null) !== (b.name === null)) return a.name !== null ? a : b;
  return compareText(a.name ?? '', b.name ?? '') >= 0 ? a : b;
}

export function sameCatProfile(a: CatProfile | null, b: CatProfile | null): boolean {
  if (a === null || b === null) return a === b;
  return a.name === b.name && a.at === b.at;
}
