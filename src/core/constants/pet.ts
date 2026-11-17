// SSOT：有身體的小貓（姿勢表＝對位點、動線、速度與時間）。開案書 docs/plans/cat-wardrobe.md §7。
import type { PetPose, PetPoseSpec, RoamBehavior } from '../types';

/** 身體座標：0..PET_VIEW_W × 0..PET_VIEW_H，面向右；地面在 PET_GROUND */
export const PET_VIEW_W = 100;
export const PET_VIEW_H = 90;
export const PET_GROUND = 86;
/** 頭的臉中心（Cat 的 64×64 座標裡）：對位點把這一點放到身體座標上 */
export const HEAD_ORIGIN = { x: 32, y: 39 } as const;
/** 背景配件（坐墊、月亮、彩虹）畫在頭像 64×64 座標裡；身體版把那張圖的中心放到這裡、放大到蓋住整隻貓 */
export const BACKDROP_ORIGIN = { x: 32, y: 32 } as const;
export const PET_BACKDROP = { x: PET_VIEW_W / 2, y: 46, rot: 0, scale: 1.25 } as const;
/** 外框粗細（頭像 64×64 座標）：頭、耳朵、五官共用 */
export const CAT_LINE_W = 2.5;
/** 身體上的頭是頭像的幾倍（大頭小身體）。頭、頭上的配件、線寬都跟著它縮 */
export const PET_HEAD_SCALE = 0.8;
/** 身體座標裡的外框粗細：跟縮小後的頭同粗，整隻貓的線才一致 */
export const PET_LINE_W = CAT_LINE_W * PET_HEAD_SCALE;
/** 腿與尾巴的粗細（身體座標） */
export const PET_LEG_W = 7.4;
export const PET_TAIL_W = 5.6;
/** 腳掌往前多出的長度、腳掌的高度（腿寬的幾倍） */
export const PET_PAW_TOE = 2.4;
export const PET_PAW_H = 0.8;
/** 身體是蛋形：最胖的地方往屁股那端偏（身體半長的幾成） */
export const PET_EGG_SHIFT = 0.2;
/**
 * 背上的花色：沿著身體輪廓的背側畫。front、rear＝從脖子那段、屁股那段輪廓的幾成處開始與結束（0–1），
 * drop＝花色下緣往肚子垂到身體半厚的幾成（負的在背側、正的過了身體中線）
 */
export const PET_SADDLE = { front: 0.3, rear: 0.82, drop: 0.1 } as const;
/** 背上配件沒有身體版圖時，照頭像的圖縮小接在背上 */
const BACK = 1;

const TAIL_UP = 'M30 64 Q17 61 17 48 Q17.5 39.5 24 42';
/** 坐著時尾巴從屁股往上捲成問號，靠在背後 */
const TAIL_SIT = 'M38 82.5 Q22.5 86 20.5 75 Q19.5 67 26 66.5';
const TAIL_HANG = 'M49.5 75 Q44.5 83 50 88.5';

const stand: PetPoseSpec = {
  torso: { cx: 47, cy: 66, rx: 19, ry: 11.5, rot: 0 },
  legs: [
    { x: 34.5, y: 74, len: 11, rot: 0 },
    { x: 54, y: 72, len: 13, rot: 0 },
    { x: 39.5, y: 75, len: 11, rot: 0 },
    { x: 58.5, y: 72.5, len: 13.5, rot: 0 },
  ],
  tail: TAIL_UP,
  head: { x: 67, y: 46, rot: 0, scale: PET_HEAD_SCALE },
  back: { x: 42, y: 56, rot: 0, scale: BACK },
  mood: 'idle',
  motion: 'breathe',
};

/** 坐姿：身體直起來（rot 接近 -90＝脖子朝上），前腿直直撐地，後腳掌從屁股下露出來 */
const sit: PetPoseSpec = {
  torso: { cx: 45, cy: 68.5, rx: 17, ry: 14, rot: -72 },
  legs: [
    { x: 44, y: 82, len: 0, rot: 0 },
    { x: 59.5, y: 71, len: 14.5, rot: -2 },
    { x: 48.5, y: 82, len: 4, rot: 0 },
    { x: 55, y: 70, len: 16, rot: 0 },
  ],
  tail: TAIL_SIT,
  head: { x: 54, y: 41, rot: 0, scale: PET_HEAD_SCALE },
  back: { x: 36, y: 60, rot: -10, scale: BACK },
  mood: 'idle',
  motion: 'breathe',
};

export const PET_POSES: Readonly<Record<PetPose, PetPoseSpec>> = {
  stand,
  walk: { ...stand, motion: 'walk' },
  run: {
    torso: { cx: 47, cy: 64, rx: 21, ry: 10.5, rot: -4 },
    legs: [
      { x: 33, y: 69, len: 13, rot: 42 },
      { x: 60, y: 69, len: 13, rot: -48 },
      { x: 37, y: 70, len: 13, rot: 30 },
      { x: 64, y: 70, len: 13, rot: -38 },
    ],
    tail: 'M27 62 Q14 59 8 51',
    head: { x: 71, y: 48, rot: 6, scale: PET_HEAD_SCALE },
    back: { x: 42, y: 54, rot: -4, scale: BACK },
    mood: 'yay',
    motion: 'run',
  },
  sit,
  groom: {
    ...sit,
    /** 近側前腳舉到臉旁邊擦臉 */
    legs: [sit.legs[0], sit.legs[1], sit.legs[2], { x: 56.5, y: 68, len: 15, rot: -152 }],
    head: { x: 54, y: 42, rot: -10, scale: PET_HEAD_SCALE },
    mood: 'yay',
    motion: 'groom',
  },
  loaf: {
    torso: { cx: 46, cy: 74.5, rx: 23, ry: 11.5, rot: 0 },
    legs: [
      { x: 40, y: 80, len: 0, rot: 0 },
      { x: 62, y: 80, len: 0, rot: 0 },
      { x: 44, y: 80, len: 0, rot: 0 },
      { x: 66, y: 80, len: 0, rot: 0 },
    ],
    /** 縮成一條吐司：尾巴整條收在身體底下（尾巴畫在身體後面，繞到前面會像墊了個盤子） */
    tail: 'M30 78 Q36 82 45 80',
    /** 頭靠在身體前端上，下巴壓進身體 */
    head: { x: 62, y: 63, rot: 4, scale: PET_HEAD_SCALE },
    back: { x: 40, y: 65, rot: 0, scale: BACK },
    mood: 'sleepy',
    motion: 'breathe',
  },
  /** 跳起來：離地不高，頭上戴高帽子時也不會頂出身體座標（試衣間的框會裁掉） */
  hop: {
    torso: { cx: 47, cy: 60, rx: 19, ry: 11.5, rot: -8 },
    legs: [
      { x: 35, y: 66, len: 11, rot: 38 },
      { x: 57, y: 64, len: 11, rot: -42 },
      { x: 39.5, y: 67, len: 11, rot: 30 },
      { x: 61.5, y: 65, len: 11, rot: -36 },
    ],
    tail: 'M29 59 Q15 53 18 39',
    head: { x: 66, y: 40, rot: -4, scale: PET_HEAD_SCALE },
    back: { x: 42, y: 50, rot: -8, scale: BACK },
    mood: 'yay',
    motion: 'still',
  },
  stumble: {
    ...stand,
    torso: { cx: 47, cy: 67, rx: 19, ry: 11.5, rot: 8 },
    legs: [
      { x: 35, y: 72, len: 13, rot: -14 },
      { x: 57, y: 75, len: 11, rot: 28 },
      { x: 39.5, y: 73, len: 13, rot: -8 },
      { x: 61.5, y: 76, len: 10, rot: 34 },
    ],
    head: { x: 68, y: 52, rot: 16, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 56, rot: 8, scale: BACK },
    mood: 'oops',
    motion: 'still',
  },
  /** 被拎著後頸：身體垂直（rot -90），四條腿垂下來 */
  dangle: {
    torso: { cx: 50, cy: 60, rx: 17, ry: 10.5, rot: -90 },
    legs: [
      { x: 45.5, y: 73, len: 12, rot: 8 },
      { x: 42, y: 54, len: 11, rot: 26 },
      { x: 54.5, y: 73, len: 12, rot: -6 },
      { x: 57, y: 55, len: 11, rot: -20 },
    ],
    tail: TAIL_HANG,
    head: { x: 50, y: 31, rot: 0, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 54, rot: -22, scale: BACK },
    mood: 'idle',
    motion: 'swing',
  },
  fall: {
    torso: { cx: 50, cy: 59, rx: 17, ry: 10.5, rot: -90 },
    legs: [
      { x: 45, y: 72, len: 12, rot: 36 },
      { x: 42, y: 52, len: 11, rot: 62 },
      { x: 55, y: 72, len: 12, rot: -36 },
      { x: 58, y: 53, len: 11, rot: -62 },
    ],
    tail: 'M50 74 Q58 82 62 78',
    head: { x: 50, y: 30, rot: 0, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 53, rot: -22, scale: BACK },
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
export const ROAM_WIDTH = 80;
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
