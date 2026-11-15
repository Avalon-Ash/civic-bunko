const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 將 Date 轉為當地日曆日期（YYYY-MM-DD）。 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 以當地日曆日期為基準加上指定天數，回傳 YYYY-MM-DD。 */
export function addDaysLocal(date: Date, days: number): string {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return toLocalDateString(next);
}

/** 判斷題目複習到期日是否已到期（含當天）。 */
export function isDue(due: string | null, now: Date): boolean {
  if (due === null) return false;
  if (ISO_DATE_RE.test(due)) {
    return due <= toLocalDateString(now);
  }
  const ts = Date.parse(due);
  return !Number.isNaN(ts) && ts <= now.getTime();
}

/** 計算目標 ISO 日期（YYYY-MM-DD）距離當地今天的剩餘天數，最小為 0。 */
export function localDaysUntil(targetIsoDate: string, now: Date): number {
  const match = ISO_DATE_RE.exec(targetIsoDate);
  if (!match) return 0;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const targetUtc = Date.UTC(y, m - 1, d);
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((targetUtc - nowUtc) / MS_PER_DAY));
}
