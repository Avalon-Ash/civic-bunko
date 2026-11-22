// SSOT：有身體的小貓（姿勢表＝對位點、動線、速度與時間）。開案書 docs/plans/cat-wardrobe.md §7。
import type { CatEmote, CatMood, OutfitSpecial, PetBuild, PetGait, PetPose, PetPoseSpec, RoamBehavior } from '../types';

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

/** 用兩隻腳站著：身體直立、下面粗一點（屁股坐不下去，肉往下沉），比被拎著的身體寬一點 */
const UPRIGHT: PetBuild = { chest: 10.5, shoulder: 10, hip: 13, belly: 1.08, flat: 0.1, patch: 0.05 };
/**
 * 站起來（乳牛、企鵝的特殊動作）：照被拎著的直立身體，往下放到後腳踩在地上；前腳是垂在兩側的手。
 * 頭不比被拎著時高（高帽子才不會頂出身體座標）。leg＝後腳從身體哪裡長出來、多長（腳掌踩在 PET_GROUND）
 */
const UP_LEG = { y: 74, len: PET_GROUND - 74 } as const;
const upright: PetPoseSpec = {
  torso: { cx: 50, cy: 61, rx: 16, ry: 14, rot: -90 },
  build: UPRIGHT,
  legs: [
    { x: 44.5, y: UP_LEG.y, len: UP_LEG.len, rot: 0 },
    { x: 42.5, y: 55, len: 11, rot: 14 },
    { x: 55.5, y: UP_LEG.y, len: UP_LEG.len, rot: 0 },
    { x: 57.5, y: 56, len: 11, rot: -14 },
  ],
  tail: 'M43 75 Q31 76 29 64',
  head: { x: 50, y: 36, rot: 0, scale: PET_HEAD_SCALE },
  back: { x: 41, y: 57, rot: -22, scale: BACK },
  frontal: false,
  backFront: true,
  mood: 'idle',
  motion: 'breathe',
};
/**
 * 舉起大斧頭（乳牛全套）：近側的手從肩膀整隻舉過頭，斧頭接在手上（CatBody 的 held）；
 * 劈下去的動作是 CSS 的 cb-pet-motion-chop（手臂往前轉）。arm＝舉起來的手臂（長度、角度，-180＝筆直朝上）
 */
export const PET_CHOP_ARM = { x: 57.5, y: 55, len: 13, rot: -158 } as const;
/** 整個姿勢往下移 dy（身體座標）：趴在地上滑的姿勢＝飛的姿勢貼到地面 */
function lowered(spec: PetPoseSpec, dy: number): PetPoseSpec {
  return {
    ...spec,
    torso: { ...spec.torso, cy: spec.torso.cy + dy },
    legs: spec.legs.map((leg) => ({ ...leg, y: leg.y + dy })) as PetPoseSpec['legs'],
    tail: spec.tail.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${x} ${Number(y) + dy}`),
    head: { ...spec.head, y: spec.head.y + dy },
    back: { ...spec.back, y: spec.back.y + dy },
  };
}

const BASE_POSES = {
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
  upright,
  /** 直立著走：對角的手腳一起擺（走路的動畫照用），看起來是左腳配右手 */
  upwalk: { ...upright, motion: 'walk' },
  /** 搖搖擺擺（企鵝）：兩隻手往外張開，整隻左右搖 */
  waddle: {
    ...upright,
    legs: [upright.legs[0], { ...upright.legs[1], rot: 34 }, upright.legs[2], { ...upright.legs[3], rot: -34 }],
    motion: 'waddle',
  },
  chop: {
    ...upright,
    legs: [upright.legs[0], upright.legs[1], upright.legs[2], { ...PET_CHOP_ARM, shoulder: true }],
    head: { ...upright.head, rot: 4 },
    mood: 'yay',
    motion: 'chop',
  },
  /** 撲過去之前（老虎全套）：前面壓低、屁股翹高，尾巴豎著，屁股左右扭 */
  crouch: {
    torso: { cx: 45, cy: 70, rx: 19, ry: 13, rot: 10 },
    build: BEAN,
    legs: [
      { x: 33, y: 76, len: 10, rot: 0 },
      { x: 55, y: 80, len: 6, rot: 0 },
      { x: 38, y: 77, len: 9, rot: 0 },
      { x: 59, y: 80, len: 6, rot: 0 },
    ],
    tail: 'M28 64 Q20 52 26 44',
    head: { x: 67, y: 58, rot: 6, scale: PET_HEAD_SCALE },
    back: { x: 40, y: 60, rot: 10, scale: BACK },
    frontal: false,
    backFront: false,
    mood: 'idle',
    motion: 'wiggle',
  },
} satisfies Record<Exclude<PetPose, 'slide'>, PetPoseSpec>;

/** 趴下來用肚子滑的身體離地面多高：飛的姿勢整隻往下放這麼多，肚子剛好貼地 */
const SLIDE_DROP = 13;
export const PET_POSES: Readonly<Record<PetPose, PetPoseSpec>> = {
  ...BASE_POSES,
  /** 用肚子滑（企鵝全套）：飛的姿勢貼到地上，一隻手往前伸 */
  slide: { ...lowered(BASE_POSES.fly, SLIDE_DROP), motion: 'still' },
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

/**
 * 各套娃娃裝的玩法（OUTFIT_SPECIALS）：
 * hop＝一蹦一蹦地走：每 stride px 跳一下、跳多高（px）；
 * bubble＝吹泡泡：坐著或站著時每 everyMs 冒一顆、飄 lifeMs 後消失、直徑範圍（px）、往上飄多高、左右飄多遠；
 * paw＝蜂蜜腳印：每走 stride px 留一個、lifeMs 後淡掉、大小（px）；
 * binky＝點牠時高高跳起來轉一圈：跳多高、多久；
 * dream＝愛睡：睡覺的權重乘上 napWeight，睡著時每 everyMs 說一句夢話；
 * maxBits＝畫面上最多同時幾個泡泡加腳印
 */
export const PET_PLAY = {
  hop: { stride: 44, lift: 16 },
  bubble: { everyMs: 1_400, lifeMs: 4_500, size: { min: 12, max: 24 }, rise: 170, drift: 30 },
  paw: { stride: 24, lifeMs: 4_000, size: 14 },
  binky: { lift: 92, ms: 760 },
  dream: { napWeight: 4, everyMs: 7_000 },
  maxBits: 14,
} as const;

/**
 * 乳牛全套的大斧頭（OUTFIT_SPECIALS 的 axe）：和噴火一樣定時（第一次也照 PET_SCORCH.firstMs）跳上一張有 data-cat-burn 的卡片（挑上緣還沒燒焦的一處），
 * 舉起斧頭劈 swings 下（每下 swingMs，CSS 的 --pet-chop-ms 讀它），卡片被劈歪 sagMs 後彈回來、裂痕跟著消失。只在畫面上，不存檔。
 * hitAt＝每一下在動畫的幾成處劈到底（要跟 pet.css 的 cb-pet-chop 關鍵影格 70% 一起改）；
 * reach＝劈到的地方在小貓圖寬的幾成處（面向右；面向左鏡像）；chips＝劈下去時噴出幾片碎屑、飛多久
 */
export const PET_AXE = {
  everyMs: { min: 40_000, max: 80_000 },
  retryMs: 4_000,
  swingMs: 520,
  swings: 3,
  hitAt: 0.7,
  sagMs: 5_000,
  reach: 0.86,
  chips: { count: 4, ms: 700, size: 7 },
} as const;
/**
 * 老虎全套的虎撲（pounce）：要走路或暴衝時有 chance 的機率改成撲過去——先伏低扭屁股 crouchMs，再撲到至少 minTrip 外的地面；
 * 撲的速度（px／秒）與拋物線多高；落地吼一聲，看得到的卡片抖 shakeMs。答題頁不撲
 */
export const PET_POUNCE = {
  chance: 0.45,
  crouchMs: 1_100,
  minTrip: 120,
  speed: 420,
  lift: 60,
  roarMs: 1_400,
  shakeMs: 450,
  /** 撲到卡片上（畫面上有卡片可以撲時，有 onCard 的機率撲卡片、不然撲地面）：前腳那裡的卡片上緣留下爪痕，clawMs 後淡掉（畫法在 ui/pet/petMarks.tsx） */
  onCard: 0.7,
  clawMs: 6_000,
} as const;
/** 乳牛裝直立著走：每隔 everyMs 哞一聲（泡泡＋音效）；企鵝暴衝改成用肚子滑時，有 chance 的機率喊一聲 */
export const PET_MOO = { everyMs: 4_500 } as const;
/**
 * 企鵝全套用肚子滑：有 cheer 的機率喊一聲；滑到底時畫面上看得到的卡片結冰 freezeMs：上緣堆雪、下緣掛冰柱，
 * 都畫在卡片邊緣外面、不蓋內容、不擋點擊（畫法在 ui/pet/petMarks.tsx）
 */
export const PET_SLIDE = { cheer: 0.5, freezeMs: 6_000 } as const;

/** 平常的步態 */
export const PET_GAIT_DEFAULT: PetGait = { walk: 'walk', zoom: 'run', home: 'run', rest: 'sit' };
/**
 * 套裝效果換掉的步態：照順序第一個符合的生效（企鵝全套同時有 slide 和 waddle，slide 在前）。
 * 站起來的（乳牛、企鵝）本來坐著的時候改成站著
 */
export const PET_GAITS: ReadonlyArray<{ when: OutfitSpecial; gait: PetGait }> = [
  { when: 'hop', gait: { walk: 'hop', zoom: 'hop', home: 'run', rest: 'sit', hop: true } },
  { when: 'slide', gait: { walk: 'waddle', zoom: 'slide', home: 'slide', rest: 'upright' } },
  { when: 'waddle', gait: { walk: 'waddle', zoom: 'waddle', home: 'waddle', rest: 'upright' } },
  { when: 'moo', gait: { walk: 'upwalk', zoom: 'upwalk', home: 'upwalk', rest: 'upright' } },
  // 小鴨裝：鴨子搖搖擺擺地走（坐著照常坐，小鴨才窩得到旁邊）
  { when: 'ducklings', gait: { walk: 'waddle', zoom: 'waddle', home: 'waddle', rest: 'sit' } },
];

// ── 鴨子裝與背飾單件的特效（docs/plans/back-specials.md）──────────
/**
 * 小鴨跟班（OUTFIT_SPECIALS 的 ducklings、feed）：count 隻小鴨排成一列跟著小貓走過的路（第 n 隻落後 n × gap px），
 * size＝小鴨的寬（px，亂跑的小貓是 ROAM_WIDTH）；trail＝記住小貓走過的幾個點（要夠 count × gap 用）；
 * catchUp＝小鴨追上排隊位置的速度（px／秒）、hop＝小鴨走路一跳一跳的高度（px）與步距；
 * quackMs＝多久呱一聲（範圍內隨機；答題頁不叫）；
 * crumb＝餵小鴨：坐著時每 everyMs 撒一把 count 顆麵包屑（半徑 spread px 內、每顆 size px），lifeMs 後淡掉，小鴨跑過去啄
 */
export const PET_DUCK = {
  count: 2,
  gap: 30,
  size: 26,
  trail: 120,
  catchUp: 120,
  hop: { lift: 5, stride: 14 },
  quackMs: { min: 9_000, max: 18_000 },
  crumb: { everyMs: 6_000, count: 4, spread: 26, size: 5, lifeMs: 4_500 },
} as const;
/**
 * 天使翅膀緩降（glide）：往下掉的速度最多 maxVy（px／秒），左右晃 sway px、每 swayMs 一個來回；
 * drift＝從卡片飄下來時往落點橫移的速度（px／秒，氣球也用）；
 * 落地不踉蹌（直接站好）；perch＝挑到「跳上卡片」時改用飛的上去（jump 的 ms 乘 slow、lift 用 lift）
 */
export const PET_GLIDE = { maxVy: 130, sway: 10, swayMs: 1_400, slow: 2.2, lift: 70, drift: 60 } as const;
/**
 * 氣球漂浮（float）：走路時離地 lift px 上下飄（每 bobMs 一個來回、振幅 bob px），速度乘 speed；
 * 放手時往下掉最多 maxVy（比翅膀更慢），落地前往上彈 bounce px
 */
export const PET_FLOAT = { lift: 14, bob: 5, bobMs: 1_800, speed: 0.8, maxVy: 90, bounce: 10 } as const;
/**
 * 蝸牛殼（slime）：走路速度乘 speed；每走 stride px 留下一段亮晶晶的線（lifeMs 後淡掉，跟蜂蜜腳印同一套）；
 * 被點一下縮進殼裡 hideMs（姿勢 loaf）
 */
export const PET_SLIME = { speed: 0.5, stride: 10, lifeMs: 5_000, hideMs: 2_600 } as const;
/**
 * 小火箭（rocket）：暴衝速度乘 speed，每走 stride px 留一個煙圈（size px、lifeMs 淡掉）；
 * 要走路時有 liftChance 的機率原地升空 lift px 再落下（ms）
 */
export const PET_ROCKET = { speed: 1.5, stride: 22, size: 14, lifeMs: 1_100, liftChance: 0.15, lift: 110, ms: 1_600 } as const;

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
