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

export const HOUSE = {
  /** 今日、集章頁按肉球時，最多幾隻一起出門（手機效能與畫面擁擠） */
  maxOut: 3,
  /** 多隻出門時，發出聲音的（哞、說話泡泡、夢話）兩次至少隔多久（毫秒）；同一時間只有一隻出聲 */
  voiceGapMs: 6_000,
} as const;
