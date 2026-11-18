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
/** 腿與尾巴的粗細（身體座標）：腿短而胖，才有軟軟的感覺 */
export const PET_LEG_W = 8;
export const PET_TAIL_W = 6.2;
/** 腳掌往前多出的長度、腳掌的高度（腿寬的幾倍） */
export const PET_PAW_TOE = 1.8;
export const PET_PAW_H = 0.62;
/** 背線、肚子線從胸口滑到屁股的緩急：兩端的把手占這段長度的幾成（越大越像 S 形） */
export const PET_BACK_EASE = 0.45;
/**
 * 背上的花色：沿著身體輪廓的背側畫。front、rear＝從脖子那段、屁股那段輪廓的幾成處開始與結束（0–1），
 * easeRear、easeFront＝下緣從兩端往中間彎進去多遠（身體半長的幾成；兩個控制點都要落在身體輪廓內）。
 * 下緣垂到哪裡跟體型有關，在 PetBuild.patch
 */
export const PET_SADDLE = { front: 0.35, rear: 0.7, easeRear: 0.3, easeFront: 0.45 } as const;
/** 背上配件沒有身體版圖時，照頭像的圖縮小接在背上 */
const BACK = 1;

/**
 * 身體輪廓的參數（身體座標的長度）。torso 的 rx＝身體的半長、ry＝屁股那端的半厚（背那一側）；
 * 這裡補上其餘的：屁股比胸口厚、肚子比背厚，身體才是軟的，不是一顆對稱的蛋。
 */
export interface PetBuild {
  /** 胸口那端的半厚 */
  chest: number;
  /** 胸口最厚的地方離脖子那端多遠、屁股最厚的地方離屁股那端多遠 */
  shoulder: number;
  hip: number;
  /** 肚子那側是背那側的幾倍厚（大於 1＝肚子下垂） */
  belly: number;
  /** 屁股那端多方（0＝圓，1＝方角）：趴著時兩端收成吐司的方角 */
  flat: number;
  /** 背上花色的下緣垂到屁股半厚的幾成（負的留在背那側、正的過了身體中線） */
  patch: number;
}
/**
 * 姿勢表的一格：PetPoseSpec 加上畫法才用得到的欄位。
 * crease＝身體上的摺線（坐著時大腿前緣的弧線；身體座標），沒有就給 null。
 */
export type PetPoseDef = PetPoseSpec & { build: PetBuild; crease: string | null };

/** 站著、走、跳：一顆豆子，屁股比胸口大一點、肚子微微下垂 */
const BEAN: PetBuild = { chest: 12, shoulder: 12, hip: 14, belly: 1.06, flat: 0, patch: 0.05 };
/** 跑：拉長的豆子 */
const STRETCH: PetBuild = { chest: 10, shoulder: 10, hip: 11.5, belly: 1.05, flat: 0, patch: 0.05 };
/** 坐：身體斜著，圓圓的大屁股坐在地上（hip＝ry，屁股那端是正圓），胸口在前上方、比屁股小；花色留在背那側 */
const SEATED: PetBuild = { chest: 12, shoulder: 11, hip: 14.5, belly: 1, flat: 0, patch: -0.15 };
/** 趴成吐司：兩端圓、上下平 */
const LOAF: PetBuild = { chest: 11.5, shoulder: 9, hip: 9, belly: 1, flat: 0.15, patch: 0.05 };
/** 被拎著：身體垂下來，肉都往下掉 */
const HANG: PetBuild = { chest: 9.5, shoulder: 9, hip: 12, belly: 1.1, flat: 0, patch: 0.05 };

const TAIL_UP = 'M31 62 Q17.5 60 16.5 47.5 Q17 39.5 23.5 42';
/** 坐著時尾巴從屁股後面貼著地伸出來，尾巴尖往上捲回身體旁邊 */
const TAIL_SIT = 'M33 80 Q19.5 83.6 17 76 Q15.6 70 21.5 69';
const TAIL_HANG = 'M49.5 75 Q44.5 83 50 88.5';
/** 坐著時大腿前緣的弧線：從後腳掌往上、往背彎回去 */
const CREASE_SIT = 'M50.6 80.5 Q52.5 69 43.5 64.5';

const stand: PetPoseDef = {
  torso: { cx: 47, cy: 66.5, rx: 19, ry: 14, rot: 0 },
  build: BEAN,
  legs: [
    { x: 37, y: 76, len: 10, rot: 0 },
    { x: 53.5, y: 76, len: 10, rot: 0 },
    { x: 41.5, y: 76, len: 10, rot: 0 },
    { x: 57.5, y: 75, len: 11, rot: 0 },
  ],
  tail: TAIL_UP,
  head: { x: 66, y: 47.5, rot: 0, scale: PET_HEAD_SCALE },
  back: { x: 42, y: 54, rot: 0, scale: BACK },
  crease: null,
  mood: 'idle',
  motion: 'breathe',
};

/**
 * 坐姿的骨架（照貓坐著的樣子）：脊椎是斜的（rot -48），屁股在頭的後下方坐在地上、胸口在頭的正下方；
 * 兩隻前腳從胸口直直撐到地上，是整隻貓最前面的著地點（遠側那隻在胸口後面露出半邊）；
 * 後腳掌貼地往前伸，從大腿下露出來，停在前腳後面。
 * 屁股那端是半徑 ry 的圓，圓心在身體中心往屁股退 (rx - hip)；圓的最低點要剛好落在 PET_GROUND。
 */
const sit: PetPoseDef = {
  torso: { cx: 47.4, cy: 66.7, rx: 21, ry: 14.5, rot: -48 },
  build: SEATED,
  legs: [
    { x: 44, y: 82, len: 0, rot: 0 },
    { x: 61.5, y: 69, len: 17, rot: 0 },
    { x: 44.5, y: 82.2, len: 3.8, rot: 0 },
    { x: 56, y: 71, len: 15, rot: 0 },
  ],
  tail: TAIL_SIT,
  head: { x: 57, y: 41.5, rot: 0, scale: PET_HEAD_SCALE },
  back: { x: 36.5, y: 60, rot: -20, scale: BACK },
  crease: CREASE_SIT,
  mood: 'idle',
  motion: 'breathe',
};

export const PET_POSES: Readonly<Record<PetPose, PetPoseDef>> = {
  stand,
  walk: { ...stand, motion: 'walk' },
  run: {
    torso: { cx: 47, cy: 65, rx: 21, ry: 11.5, rot: -4 },
    build: STRETCH,
    legs: [
      { x: 34, y: 70, len: 11, rot: 42 },
      { x: 59, y: 70, len: 11, rot: -48 },
      { x: 38, y: 71, len: 11, rot: 30 },
      { x: 63, y: 71, len: 11, rot: -38 },
    ],
    tail: 'M27.5 62 Q14 59 8 51',
    head: { x: 71, y: 49, rot: 6, scale: PET_HEAD_SCALE },
    back: { x: 42, y: 54, rot: -4, scale: BACK },
      crease: null,
    mood: 'yay',
    motion: 'run',
  },
  sit,
  groom: {
    ...sit,
    /** 近側前腳舉到臉旁邊擦臉 */
    legs: [sit.legs[0], sit.legs[1], sit.legs[2], { x: 56.5, y: 69, len: 14, rot: -152 }],
    head: { x: 57, y: 42.5, rot: -8, scale: PET_HEAD_SCALE },
    mood: 'yay',
    motion: 'groom',
  },
  loaf: {
    torso: { cx: 46, cy: 73.5, rx: 22, ry: 12.5, rot: 0 },
    build: LOAF,
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
    back: { x: 40, y: 63, rot: 0, scale: BACK },
      crease: null,
    mood: 'sleepy',
    motion: 'breathe',
  },
  /** 跳起來：離地不高，頭上戴高帽子時也不會頂出身體座標（試衣間的框會裁掉） */
  hop: {
    torso: { cx: 47, cy: 60, rx: 19, ry: 14, rot: -8 },
    build: BEAN,
    legs: [
      { x: 36, y: 67, len: 10, rot: 38 },
      { x: 57, y: 66, len: 10, rot: -42 },
      { x: 40.5, y: 68, len: 10, rot: 30 },
      { x: 61, y: 66, len: 10, rot: -36 },
    ],
    tail: 'M30 57 Q16 52 18 39',
    head: { x: 66, y: 41, rot: -4, scale: PET_HEAD_SCALE },
    back: { x: 42, y: 49, rot: -8, scale: BACK },
      crease: null,
    mood: 'yay',
    motion: 'still',
  },
  stumble: {
    ...stand,
    torso: { cx: 47, cy: 67, rx: 19, ry: 14, rot: 8 },
    legs: [
      { x: 36, y: 73, len: 12, rot: -14 },
      { x: 57, y: 76, len: 10, rot: 28 },
      { x: 40.5, y: 74, len: 12, rot: -8 },
      { x: 61, y: 75, len: 11, rot: 34 },
    ],
    head: { x: 67, y: 53, rot: 16, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 55, rot: 8, scale: BACK },
    mood: 'oops',
    motion: 'still',
  },
  /** 被拎著後頸：身體垂直（rot -90），四條腿垂下來 */
  dangle: {
    torso: { cx: 50, cy: 60, rx: 17, ry: 13, rot: -90 },
    build: HANG,
    legs: [
      { x: 45, y: 71, len: 11, rot: 8 },
      { x: 43, y: 54, len: 10, rot: 26 },
      { x: 55.5, y: 71, len: 11, rot: -6 },
      { x: 57.5, y: 55, len: 10, rot: -20 },
    ],
    tail: TAIL_HANG,
    head: { x: 50, y: 31, rot: 0, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 54, rot: -22, scale: BACK },
      crease: null,
    mood: 'idle',
    motion: 'swing',
  },
  fall: {
    torso: { cx: 50, cy: 59, rx: 17, ry: 13, rot: -90 },
    build: HANG,
    legs: [
      { x: 44.5, y: 70, len: 11, rot: 36 },
      { x: 43, y: 52, len: 10, rot: 62 },
      { x: 56, y: 70, len: 11, rot: -36 },
      { x: 58, y: 53, len: 10, rot: -62 },
    ],
    tail: 'M50 74 Q58 82 62 78',
    head: { x: 50, y: 30, rot: 0, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 53, rot: -22, scale: BACK },
      crease: null,
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
