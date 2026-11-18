// SSOT：小貓大腦的門檻（什麼算早上、什麼算快考試了…）與取名規則。台詞在 catLines.ts，判斷在 systems/catBrain.ts。

/** 一天的時段：每段從 from 點開始（含），到下一段開始為止；深夜跨過午夜 */
export const CAT_DAY_PARTS = {
  morning: 5,
  midday: 11,
  afternoon: 14,
  evening: 18,
  lateNight: 23,
} as const;

/** 離考試幾天以內算「快到了」（examNear）；超過 CAT_EXAM_FAR_DAYS 算「還很久」（examFar），中間是 examMid */
export const CAT_EXAM_NEAR_DAYS = 7;
export const CAT_EXAM_FAR_DAYS = 30;
/** 考前一天（examEve） */
export const CAT_EXAM_EVE_DAYS = 1;

/** 連續蓋章幾天以上才拿出來誇 */
export const CAT_STREAK_MIN = 3;

/** 兩下之間隔多久以內算「連續點」（毫秒）；連點幾下算摸牠（petted）、幾下算摸很多下（pettedALot） */
export const CAT_TAP_WINDOW_MS = 4_000;
export const CAT_PETTED_TAPS = 3;
export const CAT_PETTED_A_LOT_TAPS = 6;

/** 記得最近說過的幾句，挑句子時避開 */
export const CAT_MEMORY_LINES = 12;

/** 泡泡停留多久（毫秒） */
export const CAT_BUBBLE_MS = 2_600;

/** 名字最多幾個字（以一個字元算，表情符號也算一個） */
export const CAT_NAME_MAX = 6;
/**
 * 一句台詞最多幾個字（佔位符填好之後）。泡泡最寬 240px、每行約 16 個字，這個長度最多兩行；
 * 測試會用最長的名字和三位數把每一句填滿來量。
 */
export const CAT_LINE_MAX = 24;
