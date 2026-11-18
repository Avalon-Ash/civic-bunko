// SSOT：小八喵衣櫥（部位、配件、小魚乾、成就、每日小任務）。開案書 docs/plans/cat-wardrobe.md。
// ID 上線後不改（使用者資料的鍵）。價格不調高、獎勵不調低：餘額是從這些數字算出來的，一改她的餘額就跟著變；
// 往「她拿到更多」的方向改要使用者同意（2026-11-18 同意過一次：每題、每日關卡、每日任務、成就都加碼）。
import type { AccessoryId, Achievement, Quest, SlotId, WardrobeItem } from '../types';
import { ACCESSORIES, DAILY_GOAL_QUESTIONS, MISSION_SIZE, STAMPS_PER_REWARD } from './daily';

/** 部位，依疊圖順序由下往上；layer 為 false 的不是圖層（毛色）。behindCat＝畫在貓本體後面。 */
export const SLOTS: ReadonlyArray<{ id: SlotId; name: string; layer: boolean; behindCat: boolean }> = [
  { id: 'bg', name: '背景', layer: true, behindCat: true },
  { id: 'back', name: '背飾', layer: true, behindCat: true },
  { id: 'body', name: '身上', layer: true, behindCat: false },
  { id: 'neck', name: '頸部', layer: true, behindCat: false },
  { id: 'face-low', name: '嘴邊', layer: true, behindCat: false },
  { id: 'face-mid', name: '眼睛', layer: true, behindCat: false },
  { id: 'head-top', name: '頭頂', layer: true, behindCat: false },
  // 頭側在帽子上面：花、蝴蝶結、髮夾看起來像別在帽子上，不會被毛線帽、貝雷帽整個蓋掉
  { id: 'head-side', name: '頭側', layer: true, behindCat: false },
  { id: 'fur', name: '毛色', layer: false, behindCat: false },
];

/** 舊的 6 件集章配件各屬哪個部位 */
const LEGACY_SLOT: Record<AccessoryId, SlotId> = {
  bow: 'head-side',
  'straw-hat': 'head-top',
  scarf: 'neck',
  flower: 'head-side',
  glasses: 'face-mid',
  crown: 'head-top',
};

/** 舊集章配件：沿用「第 N 件在累積 N × STAMPS_PER_REWARD 個章時擁有」 */
const LEGACY_ITEMS: WardrobeItem[] = ACCESSORIES.map((acc, idx) => ({
  id: acc.id,
  slot: LEGACY_SLOT[acc.id],
  name: acc.name,
  source: { kind: 'stamps', stamps: (idx + 1) * STAMPS_PER_REWARD },
}));

/** 商店價位（小魚乾） */
const PRICE = { s: 60, m: 80, l: 100, xl: 120, xxl: 150, rare: 200, epic: 300 } as const;

const shop = (price: number) => ({ kind: 'shop', price }) as const;
const byAchievement = (achievement: string) => ({ kind: 'achievement', achievement }) as const;

/** 全部配件；畫面列出時依這個順序。 */
export const ITEMS: readonly WardrobeItem[] = [
  ...LEGACY_ITEMS,
  // 頭頂
  { id: 'beanie', slot: 'head-top', name: '毛線帽', source: shop(PRICE.m) },
  { id: 'beret', slot: 'head-top', name: '貝雷帽', source: shop(PRICE.xl) },
  { id: 'party-hat', slot: 'head-top', name: '派對帽', source: shop(PRICE.l) },
  { id: 'chick', slot: 'head-top', name: '頭上小雞', source: shop(PRICE.rare) },
  { id: 'hachimaki', slot: 'head-top', name: '必勝頭巾', source: shop(PRICE.s), sprint: true },
  { id: 'grad-cap', slot: 'head-top', name: '學士帽', source: byAchievement('exam-80') },
  // 娃娃裝的頭套（跟「身上」的連身裝、「嘴邊」的裝飾成套；也可以拆開混搭）
  { id: 'dino-hood', slot: 'head-top', name: '小怪獸頭套', source: shop(PRICE.l) },
  { id: 'bear-hood', slot: 'head-top', name: '小熊頭套', source: shop(PRICE.l) },
  { id: 'frog-hood', slot: 'head-top', name: '青蛙頭套', source: shop(PRICE.l) },
  { id: 'bunny-hood', slot: 'head-top', name: '兔子頭套', source: shop(PRICE.l) },
  // 頭側
  { id: 'star-clip', slot: 'head-side', name: '星星髮夾', source: shop(PRICE.s) },
  { id: 'sakura', slot: 'head-side', name: '櫻花', source: shop(PRICE.m) },
  { id: 'clover', slot: 'head-side', name: '幸運草', source: shop(PRICE.s), sprint: true },
  // 眼睛
  { id: 'sunglasses', slot: 'face-mid', name: '墨鏡', source: shop(PRICE.xxl) },
  { id: 'monocle', slot: 'face-mid', name: '單片眼鏡', source: byAchievement('mastered-300') },
  // 嘴邊
  { id: 'fish-snack', slot: 'face-low', name: '叼小魚乾', source: shop(PRICE.l) },
  { id: 'mustache', slot: 'face-low', name: '紳士鬍', source: shop(PRICE.m) },
  { id: 'mask', slot: 'face-low', name: '口罩', source: shop(PRICE.s) },
  { id: 'fire-breath', slot: 'face-low', name: '噴火', source: shop(PRICE.m) },
  { id: 'honey-dipper', slot: 'face-low', name: '蜂蜜棒', source: shop(PRICE.m) },
  { id: 'frog-bubble', slot: 'face-low', name: '吹泡泡', source: shop(PRICE.m) },
  { id: 'carrot', slot: 'face-low', name: '叼紅蘿蔔', source: shop(PRICE.m) },
  // 頸部
  { id: 'bell', slot: 'neck', name: '鈴鐺項圈', source: shop(PRICE.s) },
  { id: 'bowtie', slot: 'neck', name: '領結', source: shop(PRICE.m) },
  { id: 'necktie', slot: 'neck', name: '領帶', source: shop(PRICE.l) },
  { id: 'exam-pass', slot: 'neck', name: '准考證', source: shop(PRICE.m), sprint: true },
  // 身上
  { id: 'sweater', slot: 'body', name: '毛衣', source: shop(PRICE.xxl) },
  { id: 'sailor', slot: 'body', name: '水手領', source: shop(PRICE.xxl) },
  { id: 'dino-suit', slot: 'body', name: '小怪獸裝', source: shop(PRICE.xl) },
  { id: 'bear-suit', slot: 'body', name: '小熊裝', source: shop(PRICE.xl) },
  { id: 'frog-suit', slot: 'body', name: '青蛙裝', source: shop(PRICE.xl) },
  { id: 'bunny-suit', slot: 'body', name: '兔子裝', source: shop(PRICE.xl) },
  // 背飾
  { id: 'balloon', slot: 'back', name: '氣球', source: shop(PRICE.xl) },
  { id: 'cape', slot: 'back', name: '小披風', source: shop(PRICE.rare) },
  { id: 'wings', slot: 'back', name: '天使翅膀', source: shop(PRICE.epic) },
  // 背景
  { id: 'cushion', slot: 'bg', name: '坐墊', source: shop(PRICE.s) },
  { id: 'book-stack', slot: 'bg', name: '書堆', source: shop(PRICE.xl) },
  { id: 'moon', slot: 'bg', name: '月亮', source: shop(PRICE.xxl) },
  { id: 'rainbow', slot: 'bg', name: '彩虹', source: byAchievement('streak-7') },
  // 毛色
  { id: 'fur-orange', slot: 'fur', name: '橘貓', source: shop(PRICE.xl) },
  { id: 'fur-gray', slot: 'fur', name: '灰貓', source: shop(PRICE.xl) },
  { id: 'fur-black', slot: 'fur', name: '黑貓', source: shop(PRICE.rare) },
  { id: 'fur-gold', slot: 'fur', name: '金貓', source: byAchievement('answered-1000') },
];

// ── 小魚乾 ────────────────────────────────────────────────
/** 從這天（含）起的每日題數才換小魚乾；之前的紀錄只算進成就。 */
export const WARDROBE_START_DAY = '2026-11-17';
/** 見面禮 */
export const WELCOME_FISH = 150;
/** 每刷一題（作答或看答案）給幾條 */
export const FISH_PER_QUESTION = 2;
/**
 * 每日題數關卡：當天題數達 at 就再給 fish（各一次）。第一關（一回合的題數）給最多、第二關＝蓋章：
 * 每天只刷 5 題、偶爾缺席，到考試也買得完整間商店，還有餘裕買之後新增的衣服
 * （2026-11-18 使用者：「5 題也要能買完，因為有空我還是會產新衣服」，試算在開案書 §3.2）。
 */
export const DAILY_TIERS: ReadonlyArray<{ at: number; fish: number }> = [
  { at: MISSION_SIZE, fish: 250 },
  { at: DAILY_GOAL_QUESTIONS, fish: 100 },
  { at: DAILY_GOAL_QUESTIONS * 2, fish: 50 },
];

/**
 * 每日特價：每天從商店裡挑 count 件打折（照日期決定，兩台裝置同一天挑到同一批；已經買過的也可能被挑到，那格就沒得買）。
 * off＝折掉幾成；特價＝原價 ×（1 − off）四捨五入。
 */
export const DAILY_SALE = { count: 4, off: 0.3 } as const;

/** 衝刺限定：考試日（題庫 examDate）前幾天開始上架，到考試當天為止 */
export const SPRINT_DAYS = 18;

// ── 成就 ──────────────────────────────────────────────────
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'answered-30', name: '開張', desc: '累計刷 30 題', metric: 'answeredTotal', at: 30, fish: 60 },
  { id: 'answered-100', name: '起步走', desc: '累計刷 100 題', metric: 'answeredTotal', at: 100, fish: 60 },
  { id: 'answered-200', name: '有在刷', desc: '累計刷 200 題', metric: 'answeredTotal', at: 200, fish: 100 },
  { id: 'answered-300', name: '漸入佳境', desc: '累計刷 300 題', metric: 'answeredTotal', at: 300, fish: 100 },
  { id: 'answered-600', name: '刷題達人', desc: '累計刷 600 題', metric: 'answeredTotal', at: 600, fish: 160 },
  {
    id: 'answered-1000',
    name: '千題貓',
    desc: '累計刷 1000 題',
    metric: 'answeredTotal',
    at: 1000,
    fish: 200,
    item: 'fur-gold',
  },
  { id: 'mastered-10', name: '記住了', desc: '熟練 10 題', metric: 'mastered', at: 10, fish: 60 },
  { id: 'mastered-50', name: '小有把握', desc: '熟練 50 題', metric: 'mastered', at: 50, fish: 100 },
  { id: 'mastered-100', name: '越來越熟', desc: '熟練 100 題', metric: 'mastered', at: 100, fish: 120 },
  { id: 'mastered-150', name: '胸有成竹', desc: '熟練 150 題', metric: 'mastered', at: 150, fish: 160 },
  {
    id: 'mastered-300',
    name: '學者風範',
    desc: '熟練 300 題',
    metric: 'mastered',
    at: 300,
    fish: 200,
    item: 'monocle',
  },
  { id: 'stamps-1', name: '第一個章', desc: '蓋到第 1 個章', metric: 'stamps', at: 1, fish: 60 },
  { id: 'stamps-3', name: '第一頁', desc: '累計蓋 3 個章', metric: 'stamps', at: 3, fish: 60 },
  { id: 'stamps-6', name: '半本了', desc: '累計蓋 6 個章', metric: 'stamps', at: 6, fish: 100 },
  { id: 'stamps-10', name: '集章本', desc: '累計蓋 10 個章', metric: 'stamps', at: 10, fish: 120 },
  { id: 'streak-3', name: '三天不斷', desc: '連續 3 天蓋章', metric: 'stampStreak', at: 3, fish: 80 },
  { id: 'streak-5', name: '五天連發', desc: '連續 5 天蓋章', metric: 'stampStreak', at: 5, fish: 120 },
  {
    id: 'streak-7',
    name: '一週全勤',
    desc: '連續 7 天蓋章',
    metric: 'stampStreak',
    at: 7,
    fish: 160,
    item: 'rainbow',
  },
  { id: 'cards-3', name: '看圖說故事', desc: '看過 3 張圖卡', metric: 'cardsSeen', at: 3, fish: 50 },
  { id: 'cards-10', name: '翻翻看', desc: '看過 10 張圖卡', metric: 'cardsSeen', at: 10, fish: 60 },
  { id: 'cards-25', name: '圖卡迷', desc: '看過 25 張圖卡', metric: 'cardsSeen', at: 25, fish: 100 },
  { id: 'cards-40', name: '圖卡收藏家', desc: '看過 40 張圖卡', metric: 'cardsSeen', at: 40, fish: 120 },
  { id: 'exam-1', name: '模擬考初體驗', desc: '交一份模擬考', metric: 'examCount', at: 1, fish: 80 },
  { id: 'exam-60', name: '及格線', desc: '模擬考考到 60 分', metric: 'examBest', at: 60, fish: 120 },
  {
    id: 'exam-80',
    name: '準榜首',
    desc: '模擬考考到 80 分',
    metric: 'examBest',
    at: 80,
    fish: 200,
    item: 'grad-cap',
  },
];

// ── 每日小任務 ────────────────────────────────────────────
/** quiz-round 任務：一回至少幾題才算 */
export const QUEST_ROUND_MIN = MISSION_SIZE;
/** 任務池；每天依日期從「今天做得到的」任務裡挑一個（兩台同一天挑到同一個）。 */
export const QUESTS: readonly Quest[] = [
  { id: 'quiz-round', kind: 'quiz-round', name: `完成一回作答（${QUEST_ROUND_MIN} 題以上）`, fish: 40 },
  { id: 'wrong-round', kind: 'wrong-round', name: '錯題重做一回', fish: 40 },
  { id: 'topic-round', kind: 'topic-round', name: '刷一回弱點或高頻考點', fish: 40 },
  { id: 'new-card', kind: 'new-card', name: '看一張新圖卡', fish: 30 },
  { id: 'exam', kind: 'exam', name: '交一份模擬考', fish: 60 },
];
