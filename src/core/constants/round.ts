// SSOT：回合與複習的數值。
export const ROUND_COUNT_MIN = 5;
export const ROUND_COUNT_MAX = 100;
export const ROUND_COUNT_STEP = 5;
export const ROUND_COUNT_DEFAULT = 10;
export const ROUND_COUNT_PRESETS = [5, 10, 20, 30, 50] as const;

/** 快刷模式答對後自動跳下一題的等待時間 */
export const FAST_ADVANCE_MS = 1200;
/** 估計每題作答秒數，用來顯示「大概幾分鐘」 */
export const SECONDS_PER_QUESTION = 24;

/** 答錯後第幾天再出現；連續答對時依序往後推，用完就畢業 */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7] as const;
/** 連對幾次算畢業 */
export const GRADUATE_STREAK = 2;

export const STORAGE_KEY = 'civic-bunko/v1';
