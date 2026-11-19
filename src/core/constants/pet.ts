// SSOT：有身體的小貓（姿勢表＝對位點、動線、速度與時間）。開案書 docs/plans/cat-wardrobe.md §7。
import type { CatEmote, CatMood, PetBuild, PetPose, PetPoseSpec, RoamBehavior } from '../types';

/** 身體座標：0..PET_VIEW_W × 0..PET_VIEW_H，面向右；地面在 PET_GROUND */
export const PET_VIEW_W = 100;
export const PET_VIEW_H = 90;
export const PET_GROUND = 86;
/** 頭的臉中心（Cat 的 64×64 座標裡）：對位點把這一點放到身體座標上 */
export const HEAD_ORIGIN = { x: 32, y: 39 } as const;
/** 頭的橢圓半徑（Cat 的 64×64 座標，不含耳朵）：畫頭、算下巴蓋到身體哪裡都讀它 */
export const HEAD_RADIUS = { x: 26, y: 21 } as const;
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
/** 每種表情冒什麼表情符號泡泡（沒有就不冒）。泡泡畫在所有配件上面，帽子、頭套擋不到 */
export const CAT_EMOTES: Readonly<Record<CatMood, CatEmote | null>> = {
  idle: null,
  yay: { glyph: 'note', hold: 'once' },
  oops: { glyph: 'sweat', hold: 'stay' },
  sleepy: { glyph: 'zzz', hold: 'stay' },
};
/**
 * 表情符號泡泡的大小與位置。r＝泡泡半徑（小貓圖的座標；頭像 64、身體 100 都用同一個數）；
 * minPx＝泡泡在畫面上的直徑至少幾 px（小貓縮得很小時泡泡不跟著縮，不然又看不到）；
 * corner＝泡泡的尖角指在頭的哪裡（從臉中心往旁邊、往上各是頭半徑的幾成）；
 * reach＝泡泡的圓心離尖角多遠（半徑的幾倍，往斜上方）；onceMs＝hold 是 once 的泡泡停多久（wardrobe.css 讀 --emote-once-ms）
 */
export const EMOTE = { r: 8, minPx: 16, corner: { x: 0.72, y: 0.86 }, reach: 0.95, onceMs: 1800 } as const;
/** 背上配件沒有身體版圖時，照頭像的圖縮小接在背上 */
const BACK = 1;

/** 站著、走、跳：一顆豆子，屁股比胸口大一點、肚子微微下垂 */
const BEAN: PetBuild = { chest: 12, shoulder: 12, hip: 14, belly: 1.06, flat: 0, patch: 0.05 };
/** 跑：拉長的豆子 */
const STRETCH: PetBuild = { chest: 10, shoulder: 10, hip: 11.5, belly: 1.05, flat: 0, patch: 0.05 };
/** 正面坐：下大上小的蛋形，比頭窄一點；左右對稱（belly＝1），兩側是花色、中間留白肚子 */
const FRONT: PetBuild = { chest: 13, shoulder: 10, hip: 12, belly: 1, flat: 0.25, patch: -0.45 };
/** 趴成吐司：兩端圓、上下平 */
const LOAF: PetBuild = { chest: 11.5, shoulder: 9, hip: 9, belly: 1, flat: 0.15, patch: 0.05 };
/** 被拎著：身體垂下來，肉都往下掉 */
const HANG: PetBuild = { chest: 9.5, shoulder: 9, hip: 12, belly: 1.1, flat: 0, patch: 0.05 };

const TAIL_UP = 'M31 62 Q17.5 60 16.5 47.5 Q17 39.5 23.5 42';
/** 坐著時尾巴從身體後面往旁邊翹出來 */
const TAIL_SIT = 'M37 80 Q24.5 81 22 70';
const TAIL_HANG = 'M49.5 75 Q44.5 83 50 88.5';
const stand: PetPoseSpec = {
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
  frontal: false,
  backFront: false,
  mood: 'idle',
  motion: 'breathe',
};

/** 正面坐的中線，和身體的半高（脖子端到屁股端的一半）。身體直立，屁股端貼著 PET_GROUND */
const SIT_X = PET_VIEW_W / 2;
const SIT_HALF = 16;
/** 兩隻前腳各往中線左右偏多少：比腿寬的一半少一點，兩隻腳併在一起、中間共用一條線 */
const SIT_PAW = PET_LEG_W / 2 - 0.1;
/** 前腳從身體的哪個高度開始看得到（腿根），腳掌踩在 PET_GROUND */
const SIT_LEG_TOP = 74;
/**
 * 正面坐時舉起來的手臂（理毛、招手）：從肩膀整隻舉起來，腳掌到臉頰旁邊，像招財貓。
 * out＝肩膀離中線多遠、y＝肩膀的高度（在頭的下緣底下，手臂才看得到是從身體長出來的）、
 * len＝手臂長度、rot＝舉起的角度（-180＝筆直朝上，越接近 -90 越往外張）
 */
const SIT_ARM = { out: 10.5, y: 63, len: 15.5, rot: -138 } as const;

/**
 * 坐姿（正面，面向你）：小小的蛋形身體在頭的正下方、頭壓住上端看不到脖子，
 * 兩隻前腳併在身體中間，尾巴從旁邊翹出來；後腳收在身體下面，看不到。
 */
const sit: PetPoseSpec = {
  torso: { cx: SIT_X, cy: PET_GROUND - SIT_HALF, rx: SIT_HALF, ry: 18, rot: -90 },
  build: FRONT,
  legs: [
    { x: SIT_X, y: PET_GROUND, len: 0, rot: 0 },
    { x: SIT_X - SIT_PAW, y: SIT_LEG_TOP, len: PET_GROUND - SIT_LEG_TOP, rot: 0 },
    { x: SIT_X, y: PET_GROUND, len: 0, rot: 0 },
    { x: SIT_X + SIT_PAW, y: SIT_LEG_TOP, len: PET_GROUND - SIT_LEG_TOP, rot: 0 },
  ],
  tail: TAIL_SIT,
  head: { x: SIT_X, y: 40.5, rot: 0, scale: PET_HEAD_SCALE },
  back: { x: 36, y: 63, rot: -12, scale: BACK },
  frontal: true,
  backFront: true,
  mood: 'idle',
  motion: 'breathe',
};

export const PET_POSES: Readonly<Record<PetPose, PetPoseSpec>> = {
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
    frontal: false,
    backFront: false,
    mood: 'yay',
    quiet: true,
    motion: 'run',
  },
  sit,
  groom: {
    ...sit,
    /** 一隻手從肩膀舉到臉頰旁邊擦臉；另一隻前腳留在原地 */
    legs: [
      sit.legs[0],
      sit.legs[1],
      sit.legs[2],
      { x: SIT_X + SIT_ARM.out, y: SIT_ARM.y, len: SIT_ARM.len, rot: SIT_ARM.rot, shoulder: true },
    ],
    head: { x: SIT_X, y: 41.5, rot: -8, scale: PET_HEAD_SCALE },
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
    head: { x: 62, y: 62, rot: 4, scale: PET_HEAD_SCALE },
    back: { x: 40, y: 63, rot: 0, scale: BACK },
    frontal: false,
    backFront: false,
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
    frontal: false,
    backFront: false,
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
    head: { x: 50, y: 32.5, rot: 0, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 54, rot: -22, scale: BACK },
    frontal: false,
    backFront: true,
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
    head: { x: 50, y: 32.5, rot: 0, scale: PET_HEAD_SCALE },
    back: { x: 41, y: 53, rot: -22, scale: BACK },
    frontal: false,
    backFront: true,
    mood: 'oops',
    motion: 'still',
  },
  /**
   * 披著披風飛：身體打橫、後腿往後拖、近側的前腳從肩膀往前伸直（超人的姿勢），尾巴往後飄。
   * 只有穿著披風亂跑時會用到（OUTFIT_SPECIALS 的 fly）。
   */
  fly: {
    torso: { cx: 46, cy: 60, rx: 21, ry: 11.5, rot: -5 },
    build: STRETCH,
    legs: [
      { x: 31, y: 63, len: 11, rot: 72 },
      { x: 58, y: 66, len: 9, rot: -62 },
      { x: 34, y: 65, len: 11, rot: 80 },
      { x: 61, y: 66.5, len: 17, rot: -94, shoulder: true },
    ],
    tail: 'M27 59 Q15 60 6 55',
    head: { x: 70, y: 47, rot: -3, scale: PET_HEAD_SCALE },
    back: { x: 42, y: 50, rot: -5, scale: BACK },
    frontal: false,
    backFront: false,
    mood: 'yay',
    quiet: true,
    motion: 'fly',
  },
};

/**
 * 會移動的小貓換姿勢或轉身時，畫面上留在原地的那一點（支點）在頭和身體中心之間的哪裡：0＝身體中心、1＝頭。
 * 取中點時，頭和身體的位移一樣大，兩者中較大的那個最小（側身走換成正面坐、左右轉身都是）。
 */
export const PET_PIVOT_HEAD = 0.5;
/**
 * 每個姿勢要往右平移多少（身體座標，面向右），支點才會落在 PET_VIEW_W / 2；由姿勢表導出。
 * 面向左時整張圖已經沿中線翻面，平移量取負。CatBody 的 pivot 讀它。
 */
export const PET_PIVOT_SHIFT = Object.fromEntries(
  Object.entries(PET_POSES).map(([pose, { head, torso }]) => [
    pose,
    PET_VIEW_W / 2 - (torso.cx + (head.x - torso.cx) * PET_PIVOT_HEAD),
  ]),
) as Readonly<Record<PetPose, number>>;

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

/**
 * 想太久的提示：一題停太久沒作答，小貓跳到某個選項上猜一個（不保證對）。
 * 等多久看題目長短：minMs 起跳、每個字加 msPerChar、最多 maxMs，再上下浮動 jitter（比例）；
 * chance＝牠猜對的機率；revealMs＝作答後牠得意或心虛的樣子維持多久；minTop＝選項離畫面上緣至少多遠才跳（不然牠會頂出畫面）；
 * seat＝牠坐在選項的哪裡：dx＝圖的左緣離選項左緣多遠（負的＝往外凸一點，讓身體正好蓋在代號上）、up＝腳離選項下緣多高
 */
export const CAT_HINT = { minMs: 5_000, maxMs: 25_000, msPerChar: 120, jitter: 0.15, chance: 0.7, revealMs: 1_800, minTop: 70, seat: { dx: -12, up: 8 } } as const;

/**
 * 披風飛行（OUTFIT_SPECIALS 的 fly）：要走路或暴衝時有 chance 的機率改用飛的，飛到另一邊。
 * lift＝弧線最高點比地面高多少（px）、speed＝水平速度（px／秒）、minTrip＝至少要飛這麼遠才飛（太近就用走的）
 */
export const PET_FLY = { chance: 0.4, lift: 96, speed: 150, minTrip: 100 } as const;
/**
 * 噴火燒卡片（OUTFIT_SPECIALS 的 scorch）：放出來後 firstMs 內噴第一次，之後每隔 everyMs 一次（範圍內隨機）；
 * retryMs＝時間到了但畫面上沒有可以燒的卡片，多久後再看一次；
 * blastMs＝對著卡片噴多久、sorryMs＝燒焦後心虛多久；
 * mark＝焦痕的大小（px）、它離卡片右緣多遠（inset）、比卡片上緣高出多少（rise）——小貓站在它左邊對著它噴
 */
export const PET_SCORCH = {
  firstMs: { min: 8_000, max: 16_000 },
  everyMs: { min: 45_000, max: 90_000 },
  retryMs: 4_000,
  blastMs: 1_500,
  sorryMs: 1_600,
  mark: { w: 58, h: 40, inset: 10, rise: 20 },
} as const;

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
  /** 答題中（刷題、看答案）：只在地面安靜地待著，不跳上題目和選項擋字；跳到選項上只有「想太久的提示」 */
  round: { walk: 2, sit: 3, groom: 2, nap: 1, perch: 0, zoom: 0 },
  /** 刷題設定：安靜，待在開始鈕上面 */
  quiz: { walk: 2, sit: 3, groom: 2, nap: 1, perch: 0, zoom: 0 },
  /** 小貓衣櫥：理毛、炫耀新衣服 */
  cat: { walk: 2, sit: 3, groom: 3, nap: 1, perch: 2, zoom: 1 },
  /** 集章：在集章本旁邊打盹 */
  stamps: { walk: 2, sit: 2, groom: 1, nap: 3, perch: 3, zoom: 0.5 },
};
