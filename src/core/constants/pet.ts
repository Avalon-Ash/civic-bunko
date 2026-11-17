// SSOT：有身體的小貓（姿勢表＝對位點、動線、速度與時間）。開案書 docs/plans/cat-wardrobe.md §7。
import type { PetLeg, PetPose, PetPoseSpec, RoamBehavior } from '../types';

/** 身體座標：0..PET_VIEW_W × 0..PET_VIEW_H，面向右；地面在 PET_GROUND */
export const PET_VIEW_W = 100;
export const PET_VIEW_H = 90;
export const PET_GROUND = 86;
/** 頭的臉中心（Cat 的 64×64 座標裡）：對位點把這一點放到身體座標上 */
export const HEAD_ORIGIN = { x: 32, y: 39 } as const;
/** 頭佔身體的比例 */
const HEAD = 0.62;
/** 背上配件（氣球、披風、翅膀）畫成頭像大小的幾成 */
const BACK = 0.55;

/** 站著時的四條腿（腳底剛好踩在地面） */
const STAND_LEGS: [PetLeg, PetLeg, PetLeg, PetLeg] = [
  { x: 36, y: 72, len: 12, rot: 0 },
  { x: 62, y: 72, len: 12, rot: 0 },
  { x: 41, y: 74, len: 10, rot: 0 },
  { x: 67, y: 74, len: 10, rot: 0 },
];
const TAIL_UP = 'M28 63 Q15 58 17 45 Q18 38 23 41';
const TAIL_GROUND = 'M33 84 Q52 92 72 85';
const TAIL_HANG = 'M50 74 Q46 84 51 89';

const stand: PetPoseSpec = {
  torso: { cx: 50, cy: 64, rx: 24, ry: 13, rot: 0 },
  legs: STAND_LEGS,
  tail: TAIL_UP,
  head: { x: 72, y: 44, rot: 0, scale: HEAD },
  back: { x: 47, y: 52, rot: 0, scale: BACK },
  mood: 'idle',
  motion: 'breathe',
};

export const PET_POSES: Readonly<Record<PetPose, PetPoseSpec>> = {
  stand,
  walk: { ...stand, motion: 'walk' },
  run: {
    torso: { cx: 50, cy: 63, rx: 27, ry: 12, rot: -3 },
    legs: [
      { x: 34, y: 70, len: 12, rot: 35 },
      { x: 64, y: 70, len: 12, rot: -35 },
      { x: 40, y: 72, len: 11, rot: -20 },
      { x: 70, y: 72, len: 11, rot: 25 },
    ],
    tail: 'M25 61 Q12 58 8 50',
    head: { x: 76, y: 46, rot: 6, scale: HEAD },
    back: { x: 47, y: 52, rot: -3, scale: BACK },
    mood: 'yay',
    motion: 'run',
  },
  sit: {
    torso: { cx: 47, cy: 68, rx: 17, ry: 17, rot: -12 },
    legs: [
      { x: 38, y: 80, len: 7, rot: 80 },
      { x: 56, y: 68, len: 18, rot: -4 },
      { x: 42, y: 82, len: 8, rot: 85 },
      { x: 62, y: 68, len: 18, rot: 2 },
    ],
    tail: TAIL_GROUND,
    head: { x: 58, y: 40, rot: 0, scale: HEAD },
    back: { x: 42, y: 54, rot: -12, scale: BACK },
    mood: 'idle',
    motion: 'breathe',
  },
  groom: {
    torso: { cx: 47, cy: 68, rx: 17, ry: 17, rot: -12 },
    legs: [
      { x: 38, y: 80, len: 7, rot: 80 },
      { x: 56, y: 68, len: 18, rot: -4 },
      { x: 42, y: 82, len: 8, rot: 85 },
      { x: 62, y: 66, len: 15, rot: -160 },
    ],
    tail: TAIL_GROUND,
    head: { x: 58, y: 41, rot: -10, scale: HEAD },
    back: { x: 42, y: 54, rot: -12, scale: BACK },
    mood: 'yay',
    motion: 'groom',
  },
  loaf: {
    torso: { cx: 50, cy: 75, rx: 26, ry: 11, rot: 0 },
    legs: [
      { x: 40, y: 80, len: 0, rot: 0 },
      { x: 62, y: 80, len: 0, rot: 0 },
      { x: 44, y: 80, len: 0, rot: 0 },
      { x: 66, y: 80, len: 0, rot: 0 },
    ],
    tail: 'M27 80 Q38 92 66 87',
    head: { x: 71, y: 62, rot: 4, scale: HEAD },
    back: { x: 46, y: 66, rot: 0, scale: BACK },
    mood: 'sleepy',
    motion: 'breathe',
  },
  hop: {
    torso: { cx: 50, cy: 58, rx: 23, ry: 14, rot: -6 },
    legs: [
      { x: 36, y: 66, len: 10, rot: 40 },
      { x: 62, y: 64, len: 10, rot: -40 },
      { x: 41, y: 68, len: 9, rot: 35 },
      { x: 67, y: 66, len: 9, rot: -35 },
    ],
    tail: 'M28 57 Q14 50 18 36',
    head: { x: 72, y: 37, rot: -4, scale: HEAD },
    back: { x: 47, y: 46, rot: -6, scale: BACK },
    mood: 'yay',
    motion: 'still',
  },
  stumble: {
    ...stand,
    torso: { cx: 50, cy: 65, rx: 24, ry: 13, rot: 7 },
    legs: [
      { x: 36, y: 72, len: 12, rot: -12 },
      { x: 62, y: 74, len: 11, rot: 25 },
      { x: 41, y: 74, len: 10, rot: -8 },
      { x: 67, y: 75, len: 10, rot: 30 },
    ],
    head: { x: 73, y: 50, rot: 16, scale: HEAD },
    mood: 'oops',
    motion: 'still',
  },
  dangle: {
    torso: { cx: 50, cy: 58, rx: 11, ry: 19, rot: 0 },
    legs: [
      { x: 46, y: 70, len: 12, rot: 6 },
      { x: 46, y: 50, len: 12, rot: 10 },
      { x: 54, y: 70, len: 12, rot: -6 },
      { x: 54, y: 50, len: 12, rot: -10 },
    ],
    tail: TAIL_HANG,
    head: { x: 50, y: 30, rot: 0, scale: HEAD },
    back: { x: 50, y: 50, rot: 0, scale: BACK },
    mood: 'idle',
    motion: 'swing',
  },
  fall: {
    torso: { cx: 50, cy: 58, rx: 12, ry: 18, rot: 0 },
    legs: [
      { x: 45, y: 70, len: 12, rot: 35 },
      { x: 45, y: 50, len: 12, rot: 55 },
      { x: 55, y: 70, len: 12, rot: -35 },
      { x: 55, y: 50, len: 12, rot: -55 },
    ],
    tail: 'M50 74 Q58 82 62 78',
    head: { x: 50, y: 30, rot: 0, scale: HEAD },
    back: { x: 50, y: 50, rot: 0, scale: BACK },
    mood: 'oops',
    motion: 'still',
  },
};

// ── 答題頁：沿進度條跑 ─────────────────────────────────────
/** 進度條上的小貓寬度（px） */
export const RUNNER_WIDTH = 42;
/** 跑到新位置的時間；進度條上的滑動動畫用同一個數（styles 讀 --runner-run-ms） */
export const RUNNER_RUN_MS = 600;
/** 答對跳一下、答錯踉蹌的時間 */
export const RUNNER_HOP_MS = 520;
export const RUNNER_STUMBLE_MS = 900;
/** 多久沒動靜開始理毛、再多久睡著 */
export const RUNNER_GROOM_AFTER_MS = 20_000;
export const RUNNER_GROOM_MS = 3_000;
export const RUNNER_SLEEP_AFTER_MS = 60_000;

// ── 其他分頁：從頭像鑽出來自由亂跑 ─────────────────────────
/** 亂跑的小貓寬度（px；高度照 PET_VIEW 比例） */
export const ROAM_WIDTH = 60;
/** 速度（px／秒）與重力（px／秒²） */
export const ROAM_WALK_SPEED = 45;
export const ROAM_RUN_SPEED = 190;
export const ROAM_GRAVITY = 2200;
/** 跳上卡片、從頭像跳下、跳回頭像時拋物線的最高點高出幾 px */
export const ROAM_JUMP_LIFT = 46;
export const ROAM_JUMP_MS = 520;
/** 離開地面或邊緣留的距離（px） */
export const ROAM_EDGE = 6;
/** 走路時，新目標至少離現在這麼遠（px） */
export const ROAM_MIN_TRIP = 60;
/** 每個動作持續多久（毫秒，範圍內隨機） */
export const ROAM_SIT_MS = { min: 4_000, max: 8_000 } as const;
export const ROAM_GROOM_MS = { min: 3_000, max: 5_000 } as const;
export const ROAM_NAP_MS = { min: 10_000, max: 20_000 } as const;
/** 落地時縮一下的時間 */
export const ROAM_LAND_MS = 320;
/** 按住多久或移動多遠就算「拎起來」，不然算點一下 */
export const ROAM_DRAG_HOLD_MS = 220;
export const ROAM_DRAG_SLOP = 6;
/** 拎起來時手抓的位置：從小貓頂端往下幾成（後頸） */
export const ROAM_GRAB_Y = 0.22;
/** 放開時離頭像多近（px）算放回家 */
export const ROAM_HOME_SNAP = 24;
/** 她捲動或點畫面後，小貓變淡讓路多久（毫秒） */
export const ROAM_SHY_MS = 900;
/** 她最近這麼久內有操作，就只做原地的動作（坐、理毛），不跑來跑去 */
export const ROAM_CALM_AFTER_INPUT_MS = 2_500;
/** 多久檢查一次腳下有沒有按鈕（有就走開） */
export const ROAM_BLOCK_CHECK_MS = 1_000;
/** 卡片頂邊要離畫面上緣、地面多遠才跳得上去（px） */
export const ROAM_PERCH_MARGIN = 60;

/** 每個分頁的動線：各種動作被挑中的權重（分頁 ID 照 TabBar） */
export const ROAM_ROUTES: Readonly<Record<string, Readonly<Record<RoamBehavior, number>>>> = {
  /** 今日：到處逛、常跳上倒數卡和任務卡 */
  today: { walk: 3, sit: 2, groom: 2, nap: 1, perch: 3, zoom: 1 },
  /** 圖卡：卡片排得很密，坐上去會蓋到上一張，所以只沿地面逛、偶爾暴衝 */
  cards: { walk: 3, sit: 2, groom: 2, nap: 1, perch: 0, zoom: 1 },
  /** 刷題設定：安靜，待在開始鈕上面 */
  quiz: { walk: 2, sit: 3, groom: 2, nap: 1, perch: 0, zoom: 0 },
  /** 小貓衣櫥：理毛、炫耀新衣服 */
  cat: { walk: 2, sit: 3, groom: 3, nap: 1, perch: 2, zoom: 1 },
  /** 集章：在集章本旁邊打盹 */
  stamps: { walk: 2, sit: 2, groom: 1, nap: 3, perch: 3, zoom: 0.5 },
};
