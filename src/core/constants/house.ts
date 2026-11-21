// SSOT：小貓之家（最多幾隻、領養價格、預設名字、帶出門幾隻）。規則在 docs/plans/cat-house.md，格式決定在 docs/adr/0018。
import type { CatId, ItemId } from '../types';

/** 原本那隻的 ID：資料在舊欄位（settings.catName、wardrobe.outfit），不寫進 wardrobe.cats */
export const HOUSE_FIRST_CAT: CatId = 'cat-1';

/** 小貓 ID 的格式：認得的與還不認得的（較新版本領養的）都照這個格式保留、同步 */
export const HOUSE_CAT_ID = /^cat-[1-9][0-9]?$/;

export interface HouseAdoption {
  /** 這隻的 ID（產生後不改） */
  cat: CatId;
  /** 領養紀錄寫進 wardrobe.owned 的 ID（跟著 owned 同步、取聯集；產生後不改） */
  owned: ItemId;
  /** 小魚乾；已發佈的不調高（ADR 0012） */
  price: number;
  /** 還沒取名時顯示的名字 */
  defaultName: string;
}

/** 領養表：照順序一隻一隻領養（下一隻＝第一個還沒領養的）。最多幾隻＝1（原本那隻）＋這張表的長度 */
export const HOUSE_ADOPT: readonly HouseAdoption[] = [
  { cat: 'cat-2', owned: 'adopt-cat-2', price: 0, defaultName: '二喵' },
  { cat: 'cat-3', owned: 'adopt-cat-3', price: 200, defaultName: '三喵' },
  { cat: 'cat-4', owned: 'adopt-cat-4', price: 300, defaultName: '四喵' },
  { cat: 'cat-5', owned: 'adopt-cat-5', price: 400, defaultName: '五喵' },
];

/** 小屋最多住幾隻（導出值：原本那隻＋領養表） */
export const HOUSE_MAX_CATS = 1 + HOUSE_ADOPT.length;

/**
 * 小屋場景的尺寸與動作參數（ui/house/houseLogic.ts、HouseScene.tsx、house.css 讀它）。
 * height／shortHeight＝房間高度（px；shortHeight 用於手機橫放，高 ≤ 500px）；
 * floorRatio＝地板佔房間高度的比例；floorInsetY＝地板可用區域的上下比例；
 * catWidth＝房間裡每隻小貓的圖寬（px）；edgeX＝小貓中心離左右牆至少留幾 px；
 * walkSpeed＝走路速度（px／秒）；minTrip＝走路目標至少離現在多遠（px）；walkTries＝挑目標最多試幾次；
 * hopMs＝點小貓時跳一下的時間（毫秒）；maxDtMs＝單幀推進步長上限（毫秒，避免切回前景跳躍）；
 * dur＝各動作持續多久（毫秒，範圍內隨機）；weights＝動作權重；
 * nuzzle＝兩隻距離小於 dist（px）時，有 chance 的機率一起坐下互看冒 ♥，同時最多一對；
 * doorInset＝新領養的小貓從右邊門口走進來時的起點（離右緣幾 px）；enterTargetRatio＝走進房內落點的水平比例範圍。
 */
export const HOUSE_SCENE = {
  height: 186,
  shortHeight: 132,
  floorRatio: 0.42,
  floorInsetY: { min: 0.24, max: 0.88 },
  catWidth: 64,
  edgeX: 42,
  defaultWidth: 360,
  walkSpeed: 42,
  minTrip: 36,
  walkTries: 8,
  hopMs: 520,
  maxDtMs: 60,
  dur: {
    sit: { min: 3_000, max: 6_500 },
    groom: { min: 2_800, max: 5_000 },
    loaf: { min: 6_000, max: 11_000 },
    nuzzle: { min: 3_600, max: 5_400 },
  },
  weights: {
    walk: 3,
    sit: 2,
    groom: 2,
    loaf: 1,
  },
  nuzzle: {
    dist: 88,
    chance: 0.45,
  },
  doorInset: 14,
  enterTargetRatio: { min: 0.52, max: 0.78 },
} as const;

/**
 * 一起放多隻小貓出門的節奏（ui/pet/CatHome.tsx、PetLayer.tsx 讀它）。
 * staggerMs＝每隻依序從頭像跳出來的間隔（毫秒）；
 * jumpOffset＝跳出來時往畫面內側落下的水平距離範圍（px），多隻一起跳出時自然散開。
 */
export const HOUSE_OUTING = {
  staggerMs: 260,
  jumpOffset: { min: 28, max: 84 },
} as const;
