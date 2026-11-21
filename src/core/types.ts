// SSOT：全專案的型別只定義在這裡。其他檔案一律 import，不得重複宣告。
// tools/parser 與 tools/validate 是 .mjs，產出的 JSON 必須符合這裡的形狀。

export type Choice = 'A' | 'B' | 'C' | 'D';
/** 考試別 key；有哪些 key 與顯示名稱由各題庫的 pack.json `exams` 登記（引擎不認識具體值）。 */
export type ExamKind = string;
export type BankId = string;
export type SubjectKey = string;
/** `<年度>-<考試>-<科目key>`，例 `115-general-admin-law` */
export type PaperId = string;
/** `<PaperId>-q<兩位數題號>`，例 `115-general-admin-law-q08` */
export type QuestionId = string;

// ── 題庫登記（data/packs/<packId>/pack.json）─────────────
export interface SubjectInfo {
  key: SubjectKey;
  name: string;
  /** 兩到四個字的短名，用在小標籤 */
  short: string;
}
export interface ExamInfo {
  key: ExamKind;
  label: string;
}
export interface Bank {
  id: BankId;
  title: string;
  /** 筆試第一天，ISO 日期 */
  examDate: string;
  subjects: SubjectInfo[];
  /** 考試別登記：key 對應 Paper.exam，label 是畫面顯示名稱 */
  exams: ExamInfo[];
}

// ── 官方層（data/packs/<packId>/official/**，只由 tools/parser 產生）──
export interface SourceFile {
  url: string;
  file: string;
  sha256: string;
}
export interface Correction {
  /** 更正前的標準答案 */
  original: Choice[];
  /** 更正答案 PDF 的原文敘述 */
  note: string;
  /** 一律給分 */
  allCredit: boolean;
}
export interface OfficialQuestion {
  id: QuestionId;
  paperId: PaperId;
  no: number;
  stem: string;
  /** 依序為 A、B、C、D */
  options: [string, string, string, string];
  /** 給分的選項；通常一個，更正後可能多個 */
  answer: Choice[];
  correction: Correction | null;
  /** 題組（共用一段文章）的 ID；沒有就是 null */
  groupId: string | null;
  parseStatus: 'ok' | 'needs_review';
  reviewNote?: string;
}
export interface PassageGroup {
  id: string;
  text: string;
  fromNo: number;
  toNo: number;
}
export interface EssayQuestion {
  no: number;
  text: string;
}
export interface Paper {
  id: PaperId;
  bankId: BankId;
  year: number;
  exam: ExamKind;
  subjectKey: SubjectKey;
  subjectName: string;
  examCode: string;
  /** 答案 PDF 宣告的單選題數 */
  mcqCount: number;
  sources: { q: SourceFile; s: SourceFile; m: SourceFile | null };
}
/** data/packs/<packId>/official/<PaperId>.json */
export interface PaperFile {
  paper: Paper;
  groups: PassageGroup[];
  questions: OfficialQuestion[];
  essays: EssayQuestion[];
}
/** data/packs/<packId>/official/index.json */
export interface PaperIndex {
  papers: Array<{
    id: PaperId;
    bankId: BankId;
    year: number;
    exam: ExamKind;
    subjectKey: SubjectKey;
    mcqCount: number;
    essayCount: number;
    needsReview: number;
  }>;
}

// ── 加工層（data/packs/<packId>/enrich/<PaperId>.json，AI 產生，可能不存在）──
export type MarkColor = 'red' | 'blue';
export type VisualTone = 'plain' | 'hot' | 'key';
export type EnrichVisual =
  | { kind: 'flow'; lanes: Array<{ steps: Array<{ text: string; tone: VisualTone }> }> }
  | { kind: 'versus'; left: { title: string; points: string[] }; right: { title: string; points: string[] } };
export interface LawRef {
  /** data/laws/index.json 裡的法規名稱 */
  law: string;
  /** 條號，例 "26"、"17-1" */
  article: string;
}
export interface Enrich {
  id: QuestionId;
  /** data/packs/<packId>/topics.json 的 id，1–2 個 */
  topic: string[];
  /** 口訣 */
  mnemonic: string;
  /** 陷阱提醒 */
  trap: string;
  /** 白話情境 */
  plain: string | null;
  /** text 是題幹裡的原文片段 */
  marks: Array<{ text: string; color: MarkColor }>;
  options: Record<Choice, { why: string; lawRef: LawRef | null }>;
  visual: EnrichVisual | null;
  /** 官方答案或題目前提與現行法不同時的提醒 */
  lawChanged: string | null;
  confidence: 'high' | 'low';
  reviewed: boolean;
}
export interface EnrichFile {
  paperId: PaperId;
  model: string;
  generatedAt: string;
  items: Enrich[];
}

// ── 英文題中譯（data/packs/<packId>/zh/<PaperId>.json，主代理撰寫）──────────
export interface VocabEntry {
  en: string;
  zh: string;
}
export interface QuestionZh {
  id: QuestionId;
  /** 題幹中譯；克漏字題（題幹是「請依下文…」）為 null。填空題的空格寫成「＿＿」 */
  stem: string | null;
  /** 選項中譯；單字題是「英文：中文意思」 */
  options: Record<Choice, string>;
  vocab: VocabEntry[];
}
export interface GroupZh {
  /** 題組 ID（PassageGroup.id） */
  id: string;
  /** 逐句對照；en 依序接起來就是官方原文 */
  segments: Array<{ en: string; zh: string }>;
  vocab: VocabEntry[];
}
export interface ZhFile {
  paperId: PaperId;
  groups: GroupZh[];
  items: QuestionZh[];
}

// ── 法規副本（data/laws/**，來自全國法規資料庫）──────────
export interface LawFile {
  pcode: string;
  name: string;
  amendedAt: string | null;
  url: string;
  fetchedAt: string;
  articles: Array<{ no: string; text: string }>;
}
export interface LawIndex {
  laws: Array<{ pcode: string; name: string; amendedAt: string | null; articleCount: number }>;
}
export interface TopicInfo {
  id: string;
  subjectKey: SubjectKey;
  name: string;
}

// ── 卡片（data/packs/<packId>/cards/<deck>.json，主代理撰寫）──────────────
/** concept＝前置觀念；newlaw＝新法必考；essay＝申論架構 */
export type CardKind = 'concept' | 'newlaw' | 'essay';
export interface CardFace {
  heading: string;
  /** 每行一個重點，字數上限在 constants/cards.ts */
  lines: string[];
}
export interface StudyCard {
  id: string;
  kind: CardKind;
  subjectKey: SubjectKey | null;
  title: string;
  /** 一句話重點，卡片收合時只看得到這句 */
  hook: string;
  visual: EnrichVisual | null;
  faces: CardFace[];
  lawRefs: LawRef[];
  /** 申論卡對應的官方申論題 */
  essay: { paperId: PaperId; no: number } | null;
  /** 申論題原文：由 cardLoader 從官方層填入，卡片檔裡不寫 */
  essayText?: string;
}
export interface CardFile {
  deck: string;
  title: string;
  cards: StudyCard[];
}

// ── 個人進度（只存在裝置上）──────────────────────────────
export interface Progress {
  seen: number;
  correct: number;
  /** 看答案模式看過幾次 */
  views: number;
  /** 目前連續答對次數 */
  streak: number;
  lastPick: Choice | null;
  /** ISO 時間 */
  lastAt: string;
  /** 下次該複習的 ISO 日期；null 表示已畢業 */
  due: string | null;
}

// ── 回合 ────────────────────────────────────────────────
export type RoundMode = 'mixed' | 'new' | 'wrong' | 'due';
/** 問法：positive＝問哪個對；negative＝問哪個錯 */
export type AskType = 'positive' | 'negative';
export type AskFilter = AskType | 'all';
/** quiz＝自己作答；read＝看答案（題目與正解一起出現） */
export type StudyMode = 'quiz' | 'read';
export interface RoundConfig {
  bankId: BankId;
  /** 空陣列＝全部科目 */
  subjectKeys: SubjectKey[];
  count: number;
  mode: RoundMode;
  /** 快刷：答對自動下一題 */
  fast: boolean;
  study: StudyMode;
  ask: AskFilter;
  /** 看答案模式：這批題目看幾遍 */
  passes: number;
  /** 模擬考：整份試卷照官方題號順序、計時、交卷後才看答案 */
  exam?: { paperId: PaperId; minutes: number } | null;
  /** 弱點回合：只出考點（data/packs/<packId>/topics.json 的 id）在這個清單裡的題目；沒有或空陣列＝不限 */
  topicIds?: string[];
}
export interface RoundResult {
  id: QuestionId;
  pick: Choice;
  correct: boolean;
}
export interface RoundState {
  config: RoundConfig;
  queue: QuestionId[];
  index: number;
  /** 目前這題選了什麼；還沒作答是 null */
  pick: Choice | null;
  results: RoundResult[];
  combo: number;
  finished: boolean;
  /** 看答案模式：目前第幾遍（從 1 開始）；作答模式固定為 1 */
  pass: number;
  /** 模擬考開始時間（ISO）；其他回合沒有 */
  startedAt?: string;
  /** 選項打亂時，每題四個選項的顯示順序（值仍是官方代號）；沒打亂就沒有 */
  optionOrder?: Record<QuestionId, Choice[]>;
  /** 模擬考：每題目前選的答案（交卷前可以改）；其他回合沒有 */
  examPicks?: Record<QuestionId, Choice>;
}
/** 一次模擬考的成績（只存在裝置上） */
export interface ExamRecord {
  paperId: PaperId;
  /** 交卷時間（ISO） */
  at: string;
  /** 整份題數 */
  total: number;
  answered: number;
  correct: number;
  /** round(correct / total × 100) */
  score: number;
}

// ── 每日紀錄與集章 ──────────────────────────────────────
/** 當地日期 YYYY-MM-DD */
export type DayKey = string;
export type AccessoryId = 'bow' | 'straw-hat' | 'scarf' | 'flower' | 'glasses' | 'crown';

// ── 衣櫥（紙娃娃、小魚乾、成就、每日小任務）──────────────────
/** 部位；疊圖順序只定義在 constants/wardrobe.ts 的 SLOTS。fur 不是圖層，是毛色色票。 */
export type SlotId =
  | 'bg'
  | 'back'
  | 'body'
  | 'neck'
  | 'face-low'
  | 'face-mid'
  | 'head-side'
  | 'head-top'
  | 'fur';
/** 配件 ID（含舊的 AccessoryId）；是使用者資料的鍵，產生後不改名、不重編 */
export type ItemId = string;
/** 成就 ID；是使用者資料的鍵，產生後不改名、不重編 */
export type AchievementId = string;
/** 每日小任務 ID；是使用者資料的鍵，產生後不改名、不重編 */
export type QuestId = string;
export type ItemSource =
  /** 舊集章配件：累積幾個章自動擁有 */
  | { kind: 'stamps'; stamps: number }
  /** 用小魚乾買 */
  | { kind: 'shop'; price: number }
  /** 解鎖這個成就就擁有 */
  | { kind: 'achievement'; achievement: AchievementId };
export interface WardrobeItem {
  id: ItemId;
  slot: SlotId;
  name: string;
  source: ItemSource;
  /** 衝刺限定：只在考前 SPRINT_DAYS 天到考試當天上架（已買的永久擁有） */
  sprint?: boolean;
}
/** 每個部位穿哪一件；沒有鍵＝那個部位空著 */
export type Outfit = Partial<Record<SlotId, ItemId>>;
/** 試衣間裡試穿中（還沒拿到）的配件：每個部位最多一件。只是畫面的暫時狀態，不進存檔、不同步。 */
export type TryOn = Partial<Record<SlotId, ItemId>>;
export type AchievementMetric =
  /** 累計刷題數（dayLog 全部加總，作答與看答案都算） */
  | 'answeredTotal'
  /** 熟練題數（作答過且 due 為 null） */
  | 'mastered'
  /** 累計章數 */
  | 'stamps'
  /** 最長連續蓋章天數 */
  | 'stampStreak'
  /** 看過的圖卡張數 */
  | 'cardsSeen'
  /** 交卷的模擬考次數 */
  | 'examCount'
  /** 模擬考最高分 */
  | 'examBest';
export interface Achievement {
  id: AchievementId;
  name: string;
  /** 一句話條件說明（給畫面顯示） */
  desc: string;
  metric: AchievementMetric;
  /** metric ≥ at 就解鎖 */
  at: number;
  fish: number;
  /** 解鎖時一併送的配件 */
  item?: ItemId;
}
export type QuestKind =
  /** 完成一回作答回合（題數 ≥ QUEST_ROUND_MIN） */
  | 'quiz-round'
  /** 完成一回錯題重做（mode: 'wrong'） */
  | 'wrong-round'
  /** 完成一回弱點或高頻回合（有 topicIds） */
  | 'topic-round'
  /** 看一張新圖卡（cardsSeen 變多） */
  | 'new-card'
  /** 交一份模擬考 */
  | 'exam';
export interface Quest {
  id: QuestId;
  kind: QuestKind;
  name: string;
  fish: number;
}
/** 畫面要放的慶祝（只在記憶體，不存檔） */
export type Celebration =
  | { kind: 'achievement'; id: AchievementId }
  | { kind: 'quest'; id: QuestId };
/**
 * 穿著特定配件才有的特殊動作（對照表在 constants/wardrobe.ts 的 OUTFIT_SPECIALS）：
 * fly＝披著披風飛；scorch＝小怪獸全套加噴火，會把卡片燒焦；
 * hop＝青蛙或兔子的頭套加連身裝，走路改成一蹦一蹦；bubbles＝青蛙全套加吹泡泡，泡泡會飄出來、可以戳破；
 * binky＝兔子全套加紅蘿蔔，點牠會高高跳起來轉一圈；honey＝小熊全套加蜂蜜棒，走過的地方留下蜂蜜腳印；
 * dream＝睡衣全套加奶嘴，特別愛睡、睡著會說夢話；
 * moo＝乳牛的頭套加連身裝，站起來走路、邊走邊哞哞叫；axe＝乳牛全套加牧草，偶爾拿大斧頭把卡片劈歪（只在畫面上，一下子就彈回來）；
 * pounce＝老虎全套加虎牙，伏低扭屁股、撲到卡片上留下抓痕（或撲到地面吼一聲）；
 * waddle＝企鵝的頭套加連身裝，站起來搖搖擺擺地走；slide＝企鵝全套加冰棒，暴衝改成趴下用肚子滑、滑完畫面上的卡片結冰
 */
export type OutfitSpecial =
  | 'fly'
  | 'scorch'
  | 'hop'
  | 'bubbles'
  | 'binky'
  | 'honey'
  | 'dream'
  | 'moo'
  | 'axe'
  | 'pounce'
  | 'waddle'
  | 'slide';
/** 焦痕在卡片上緣的哪裡：左、中、右 */
export type ScorchPlace = 'l' | 'm' | 'r';
/**
 * 衣櫥狀態（存在 Settings.wardrobe）。owned、achievements、quests 跨裝置同步並取聯集，saved 同步並取每件較大值，
 * repairs 同步並取較大值；outfit、scorch 只存在各裝置。
 */
export interface WardrobeState {
  /** 用小魚乾買下的配件（不含集章與成就送的） */
  owned: ItemId[];
  /** 已解鎖的成就；解鎖後不收回 */
  achievements: AchievementId[];
  /** 每天完成的小任務 */
  quests: Record<DayKey, QuestId[]>;
  /**
   * 趁每日特價買的配件各省了幾條小魚乾（沒有特價買過就沒有這欄）。
   * 存「省了多少」而不是哪天買的：之後商店加了配件，哪天特價哪幾件會變，她已經省下的不能跟著變。
   */
  saved?: Record<ItemId, number>;
  /**
   * 花小魚乾修過幾次燒焦（每次 SCORCH.repairFish；沒修過就沒有這欄）。只存次數：花掉的小魚乾＝次數×單價。
   */
  repairs?: number;
  /** 現在燒焦的地方（卡片上 data-cat-burn 的值）；只是這台裝置畫面上的樣子，不同步 */
  scorch?: string[];
  /** 目前穿著；沒有這欄時沿用舊的 settings.accessory。這是原本那隻（HOUSE_FIRST_CAT）的穿著 */
  outfit?: Outfit;
  /** 原本那隻的穿著最後一次被使用者改動的時間（ISO）；沒有這欄＝不知道（加這欄之前換的）。和 outfit 一起組成 CatLook 跨裝置同步 */
  outfitAt?: string;
  /** 領養的小貓（鍵是 CatId；原本那隻不在這裡，牠的資料在舊欄位）。規則在 docs/plans/cat-house.md §3 */
  cats?: Record<CatId, HouseCatSave>;
  /** 帶出門的小貓；沒有這欄＝照小屋順序的前 HOUSE.maxOut 隻。各裝置自己的設定，不同步 */
  outing?: CatId[];
  /** 陪我刷題的那隻（答題頁、頭像）；沒有這欄或不在家裡＝原本那隻。各裝置自己的設定，不同步 */
  leader?: CatId;
}

// ── 小貓之家（多隻小貓；數字在 constants/house.ts）────────────
/**
 * 小貓 ID：原本那隻固定是 HOUSE_FIRST_CAT（'cat-1'，資料在舊欄位，不寫進 wardrobe.cats）；
 * 領養的是 HOUSE_ADOPT 列的 ID（'cat-2'…）。是使用者資料的鍵，產生後不改名、不重編。
 * 格式是 HOUSE_CAT_ID（cat-數字）：不認得的編號（較新版本領養的）照樣保留、同步，只是不顯示。
 */
export type CatId = string;
/** 領養的小貓存在 wardrobe.cats 的資料；每欄選填，壞掉的欄位只丟那一欄 */
export interface HouseCatSave {
  /** 名字（規則同 settings.catName）；沒有＝沒取名 */
  name?: string;
  /** 名字最後一次被改動（含清掉）的時間（ISO） */
  nameAt?: string;
  /** 穿著（含毛色） */
  outfit?: Outfit;
  /** 穿著最後一次被改動的時間（ISO） */
  outfitAt?: string;
}
/**
 * 一隻小貓的長相（穿著含毛色）＋最後一次被使用者改動的時間。整包跨裝置同步：比 at，較新的整包留下
 * （systems/syncMerge.ts 的 mergeCatLook）。at 是空字串（不知道）的長相不上傳，各裝置維持自己的。
 */
export interface CatLook {
  outfit: Outfit;
  /** ISO；空字串＝不知道 */
  at: string;
}

// ── 更新紀錄 ────────────────────────────────────────────
/** 一次對使用者有感的更新（系統內部的修改不列） */
export interface ChangelogEntry {
  /** 唯一 ID，產生後不改（存在 settings.changelogSeen） */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  items: string[];
}

// ── 音效（Web Audio 即時合成，數值在 constants/sound.ts）──────────
export type SoundName = 'tap' | 'correct' | 'wrong' | 'reward' | 'meow' | 'moo';
/** 一個音：從 from 赫茲滑到 to 赫茲（沒有 to 就不滑），在 at 秒開始、持續 dur 秒 */
export interface ToneSpec {
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  from: number;
  to?: number;
  at: number;
  dur: number;
  gain: number;
}
/** 一段貓叫錄音（檔案在 src/ui/sounds/）：從 offset 秒開始播 duration 秒，乘上 gain 讓幾段一樣大聲 */
export interface MeowClip {
  file: string;
  offset: number;
  duration: number;
  gain: number;
}

// ── 小貓的大腦（點牠時說什麼）──────────────────────────────
// 分三層，各自可以單獨換掉：角色包（名字與台詞，constants/catLines.ts）、
// 判斷（條件與挑句子，systems/catBrain.ts）、說話的介面（CatVoice，由 ui/pet/CatVoiceProvider 注入）。
/** 小貓的表情 */
export type CatMood = 'idle' | 'yay' | 'oops' | 'sleepy';
/** 表情符號泡泡（像 RO 的表情）：glyph＝泡泡裡的符號；hold＝once 冒出來一下就消失、stay 表情還在就一直掛著 */
export interface CatEmote {
  glyph: 'note' | 'sweat' | 'zzz';
  hold: 'once' | 'stay';
}
/** 在哪裡點到牠：avatar＝頭像、roam＝跑出來玩的那隻 */
export type CatPlace = 'avatar' | 'roam';
/** 畫面明講的情境：剛答對、剛答錯。沒講就只看表情 */
export type CatScene = 'correct' | 'wrong';
/** 點牠的那一下（畫面給的） */
export interface CatTap {
  mood: CatMood;
  place: CatPlace;
  scene?: CatScene;
  /** 點到哪一隻小貓；沒給＝陪我刷題那隻（leaderCat） */
  cat?: CatId;
}
/** 小貓看得到的處境：selectors/cat.ts 從 world 整理出來，大腦只讀這個、不碰 world */
export interface CatSituation extends CatTap {
  /** 現在幾點（0–23） */
  hour: number;
  /** 離考試幾天（考試當天是 0）；沒有題庫是 null */
  daysToExam: number | null;
  /** 今天刷了幾題、每日目標幾題 */
  todayCount: number;
  dailyGoal: number;
  /** 連續幾天蓋章（今天還沒蓋就算到昨天） */
  streak: number;
  /** 身上穿了幾件（毛色不算） */
  wearing: number;
  /** 使用者取的名字；沒取是 null */
  name: string | null;
  /** 這一輪連續點了幾下（含這一下） */
  taps: number;
}
/** 條件的名字；每個條件怎麼判斷只寫在 systems/catBrain.ts 的 CAT_CONDITIONS，門檻在 constants/cat.ts */
export type CatCondition =
  | 'correct'
  | 'wrong'
  | 'calm'
  | 'cheerful'
  | 'down'
  | 'sleepy'
  | 'roaming'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'evening'
  | 'lateNight'
  | 'examFar'
  | 'examMid'
  | 'examNear'
  | 'examEve'
  | 'examDay'
  | 'notStarted'
  | 'underway'
  | 'goalDone'
  | 'onStreak'
  | 'dressed'
  | 'undressed'
  | 'named'
  | 'unnamed'
  | 'petted'
  | 'pettedALot';
/** 台詞裡可以用的佔位符（寫成 {NAME}）；值從處境算出來，算不出來的那句不會被挑 */
export type CatLineVar = 'NAME' | 'DAYS' | 'N' | 'LEFT' | 'GOAL' | 'STREAK';
/** 一個話題：when 的條件全部成立才會被挑，weight 越大越常出現 */
export interface CatTopic {
  id: string;
  when: readonly CatCondition[];
  weight: number;
  lines: readonly string[];
}
/** 角色包：預設稱呼與台詞。跟程式無關，可以整包換掉 */
export interface CatCharacter {
  id: string;
  /** 使用者沒取名時，台詞裡的 {NAME} 用這個 */
  defaultName: string;
  topics: readonly CatTopic[];
}
/** 大腦記得的事（只在記憶體，不存檔）：最近說過的話、上一個話題、連續點了幾下 */
export interface CatMemory {
  recentLines: readonly string[];
  lastTopic: string | null;
  taps: number;
  /** 上一下是什麼時候點的（毫秒時間戳）；沒點過是 null */
  lastTapAt: number | null;
}
export interface CatLine {
  text: string;
  /** 出自哪個話題（CatTopic.id） */
  topic: string;
}
/**
 * 小貓的個人設定：現在只有名字，之後大腦的設定（例如換角色包）也放這一包。
 * 整包跨裝置同步：兩邊比 at，較新的那包整包取代較舊的（systems/syncMerge.ts 的 mergeCatProfile）。
 * 存檔裡是 settings.catName＋settings.catNameAt；同步檔裡是選填的 cat 欄。
 */
export interface CatProfile {
  /** null＝沒取名（把名字清掉也是一次改動，會同步過去） */
  name: string | null;
  /** 這包最後一次被使用者改動的時間（ISO）；空字串＝不知道 */
  at: string;
}
/**
 * 說話的介面：給一下點擊，回一句話（null＝不說）。畫面只認得這個函式；
 * 現在的實作是本機規則表（systems/catBrain.ts），要換成別的來源只要換掉注入的函式。
 */
export type CatVoice = (tap: CatTap) => CatLine | null;

// ── 有身體的小貓（姿勢表在 constants/pet.ts）──────────────────
export type PetPose =
  | 'stand'
  | 'walk'
  | 'run'
  | 'sit'
  | 'groom'
  | 'loaf'
  | 'hop'
  | 'stumble'
  | 'dangle'
  | 'fall'
  /** 披著披風飛（特殊動作）：身體打橫、一隻手往前伸 */
  | 'fly'
  /** 用兩隻腳站起來（乳牛、企鵝的特殊動作）：upright＝站著、upwalk＝直立著走、waddle＝搖搖擺擺地走、chop＝舉起大斧頭劈下去 */
  | 'upright'
  | 'upwalk'
  | 'waddle'
  | 'chop'
  /** 老虎撲過去之前伏低、扭屁股 */
  | 'crouch'
  /** 企鵝趴下來用肚子滑 */
  | 'slide';
/** 姿勢裡會動的部分怎麼動（CSS 動畫在 styles/pet.css 的 cb-pet-motion-*） */
export type PetMotion = 'still' | 'breathe' | 'walk' | 'run' | 'groom' | 'swing' | 'fly' | 'waddle' | 'chop' | 'wiggle';
/** 一個對位點：把某個零件的原點放到身體座標的 (x, y)，轉 rot 度、縮放 scale */
export interface PetAnchor {
  x: number;
  y: number;
  rot: number;
  scale: number;
}
/** 一條腿：從 (x, y) 往下長 len，轉 rot 度（0＝垂直向下） */
export interface PetLeg {
  x: number;
  y: number;
  len: number;
  rot: number;
  /**
   * 這條腿是「從肩膀舉起來的手臂」：腿根露在身體輪廓上，畫成圓的肩膀；穿有袖子的衣服時袖子套在肩膀上。
   * 沒標的腿，腿根藏在身體裡、不封口。
   */
  shoulder?: boolean;
}
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
  /** 屁股那端多方（0＝圓，1＝方角）：趴著、正面坐時貼地的那一端收得比較方 */
  flat: number;
  /** 背上花色的下緣垂到屁股半厚的幾成（負的留在背那側、正的過了身體中線） */
  patch: number;
}
/**
 * 一個姿勢（像 RO 的一格動作）：身體（中心、半長、半厚、方向，輪廓的其餘參數在 build）、
 * 四條腿（遠側兩條畫在身體後面）、尾巴、頭的對位點（頭的臉中心 (32, 39) 放到哪）、背上配件的對位點、表情與會動的方式。
 */
export interface PetPoseSpec {
  /** 身體座標裡的身體：中心 (cx, cy)、半長 rx（脖子到屁股的一半）、屁股那端的半厚 ry、轉幾度（0＝脖子朝右，-90＝直立） */
  torso: { cx: number; cy: number; rx: number; ry: number; rot: number };
  build: PetBuild;
  /** 順序：後腿遠、前腿遠、後腿近、前腿近 */
  legs: [PetLeg, PetLeg, PetLeg, PetLeg];
  tail: string;
  head: PetAnchor;
  back: PetAnchor;
  /**
   * 正面坐（身體直起來、面向你）：兩隻前腳都畫在身體前面、腳掌朝你（不往前伸），
   * 身體左右兩側都看得到花色，衣服的布面也左右對稱。這種姿勢的身體一律畫成左右對稱（不讀 build.belly）。
   */
  frontal: boolean;
  /**
   * 背上的配件（披風、翅膀）用正面的圖（BodyArt.frontal）：身體直立、頭朝著你的姿勢——正面坐、被拎著、掉下來。
   * 這些姿勢從側面的圖鏡像不出「披在背後」「左右展開」的樣子。frontal 的姿勢一定是 true。
   */
  backFront: boolean;
  mood: CatMood;
  /** 這個姿勢不冒表情符號泡泡（跑步只是路過，每跑一步冒一次太吵） */
  quiet?: boolean;
  motion: PetMotion;
}

/**
 * 走路的樣子（套裝效果換掉的步態；對照表在 constants/pet.ts 的 PET_GAITS）：
 * walk＝走路、zoom＝暴衝、home＝跑回家、rest＝待著不動（本來坐著的時候）時用哪個姿勢；hop＝走路時一蹦一蹦地跳
 */
export interface PetGait {
  walk: PetPose;
  zoom: PetPose;
  home: PetPose;
  rest: PetPose;
  hop?: boolean;
}

/** 自由亂跑時的一個動作；每個分頁的權重在 constants/pet.ts 的 ROAM_ROUTES */
export type RoamBehavior = 'walk' | 'sit' | 'groom' | 'nap' | 'perch' | 'zoom';

// ── 天氣天空（規則在 constants/weather.ts）────────────────────
/** 天空畫哪一種 */
export type WeatherKind = 'clear' | 'cloudy' | 'rain';
export interface Weather {
  kind: WeatherKind;
  /** 現在是白天（晴天畫太陽）還是晚上（畫月亮） */
  day: boolean;
}

/** 可以選的地點：名稱與粗略座標（小數 1 位） */
export interface WeatherPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// ── 設定 ────────────────────────────────────────────────
export type ThemeChoice = 'system' | 'light' | 'dark';
export interface Settings {
  theme: ThemeChoice;
  /** 上一次的回合設定，下次預填 */
  lastRound: RoundConfig | null;
  /** 已按過「知道了」，不再顯示加到主畫面的引導 */
  installHintDismissed?: boolean;
  /** 貓目前戴的配件；必須是已解鎖的 */
  accessory?: AccessoryId | null;
  /** 作答時打亂四個選項的顯示順序（模擬考不打亂） */
  shuffleOptions?: boolean;
  /** 看過的卡片 ID */
  cardsSeen?: string[];
  /** 英文題顯示中英對照；沒設定視為開啟 */
  bilingual?: boolean;
  /** 模擬考歷次成績，舊到新；上限在 constants/exam.ts */
  examHistory?: ExamRecord[];
  /** 衣櫥；沒有這欄視為空的衣櫥 */
  wardrobe?: WardrobeState;
  /** 音效（按鈕、答題、小貓叫）；沒設定視為開啟。各裝置自己的設定，不同步 */
  sound?: boolean;
  /** 天氣天空（照所在地的天氣畫頁面上方的天空）；沒設定視為關閉——要她自己打開，因為會用到定位。各裝置自己的設定，不同步 */
  weather?: boolean;
  /** 天氣天空看哪個縣市（WEATHER_PLACES 的 id）；沒有這欄＝用手機定位。各裝置自己的設定，不同步 */
  weatherPlace?: string;
  /** 看過的最新一則更新紀錄 ID；各裝置自己的設定，不同步 */
  changelogSeen?: string;
  /** 使用者幫小貓取的名字（規則在 constants/cat.ts）；沒有這欄＝沒取名。和 catNameAt 一起組成 CatProfile 跨裝置同步 */
  catName?: string;
  /** 名字最後一次被改動（含清掉）的時間（ISO）；沒有這欄＝不知道（加這欄之前取的名字） */
  catNameAt?: string;
}

// ── 同步（私人 GitHub repo）────────────────────────────
export interface SyncCredentials {
  owner: string;
  repo: string;
  /** 只存在裝置上，不得進入匯出檔、事件、記錄或網址 */
  token: string;
}
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';
export interface SyncState {
  status: SyncStatus;
  /** ISO 時間 */
  lastSyncedAt: string | null;
  /** 給使用者看的短句 */
  error: string | null;
}

// ── 事件（System 之間唯一的溝通方式）──────────────────────
export type AppEvent =
  | { type: 'bankLoaded'; bankId: BankId; questionCount: number }
  | { type: 'roundStarted'; config: RoundConfig; queue: QuestionId[] }
  | { type: 'answered'; id: QuestionId; pick: Choice; correct: boolean; at: string }
  | { type: 'viewed'; id: QuestionId; at: string }
  | { type: 'roundFinished'; results: RoundResult[]; at: string; config: RoundConfig }
  | { type: 'examFinished'; record: ExamRecord }
  | { type: 'roundRestored' }
  | { type: 'cardsLoaded'; count: number }
  | { type: 'progressChanged'; ids: QuestionId[] }
  | { type: 'dayLogChanged'; day: DayKey; count: number }
  | { type: 'settingsChanged'; settings: Settings }
  /** 使用者打開一張之前沒看過的圖卡（讀檔、同步不會發） */
  | { type: 'cardSeen'; id: string; at: string }
  | { type: 'syncChanged'; sync: SyncState }
  /** 衣櫥系統：新解鎖的成就、新完成的小任務（給畫面放慶祝） */
  | { type: 'rewardsEarned'; rewards: Celebration[] };

// ── 指令（畫面寫入狀態的唯一入口）────────────────────────
export type UICommand =
  | { type: 'startRound'; config: RoundConfig }
  | { type: 'answer'; pick: Choice }
  | { type: 'next' }
  | { type: 'quitRound' }
  /** 模擬考：記下（或改掉）目前這題的答案，不計分、不換題 */
  | { type: 'examPick'; pick: Choice }
  /** 模擬考：跳到第 index 題（從 0 開始） */
  | { type: 'examGoto'; index: number }
  /** 接續上次沒刷完的回合 */
  | { type: 'resumeRound' }
  | { type: 'discardSavedRound' }
  | { type: 'retryWrong' }
  /** 用剛看完的同一批題目開作答回合 */
  | { type: 'quizSameSet' }
  | { type: 'setTheme'; theme: ThemeChoice }
  | { type: 'setAccessory'; accessory: AccessoryId | null }
  | { type: 'dismissInstallHint' }
  | { type: 'setShuffleOptions'; on: boolean }
  | { type: 'setBilingual'; on: boolean }
  | { type: 'markCardSeen'; id: string }
  | { type: 'importProgress'; json: string }
  | { type: 'resetProgress' }
  | { type: 'setSyncCode'; code: string }
  | { type: 'syncNow' }
  | { type: 'disableSync' }
  /** 用小魚乾買一件 shop 配件；餘額不足、不在架上、已擁有時不動作 */
  | { type: 'buyItem'; id: ItemId }
  /** 穿上（item 為 null＝脫掉）；只接受已擁有、部位相符的配件。cat 沒寫＝原本那隻；同一件可以好幾隻同時穿 */
  | { type: 'wear'; slot: SlotId; item: ItemId | null; cat?: CatId }
  /** 小貓把這個地方燒焦了（只是外觀；已經燒焦、或燒焦的地方到上限時不動作） */
  | { type: 'scorch'; spot: string }
  /** 花小魚乾把燒焦的地方修好；沒燒焦、餘額不足時不動作 */
  | { type: 'repairScorch'; spot: string }
  /** 畫面放完慶祝後清掉 */
  | { type: 'dismissCelebrations' }
  | { type: 'setSound'; on: boolean }
  /** 開關天氣天空 */
  | { type: 'setWeather'; on: boolean }
  /** 天氣天空改看哪個縣市（null＝改回用定位；不認得的 id 當作 null） */
  | { type: 'setWeatherPlace'; place: string | null }
  /** 更新紀錄看完了（記下最新一則的 ID） */
  | { type: 'markChangelogSeen'; id: string }
  /** 幫小貓取名；空字串＝改回沒取名。cat 沒寫＝原本那隻 */
  | { type: 'setCatName'; name: string; cat?: CatId }
  /** 領養下一隻（HOUSE_ADOPT 裡第一個還沒領養的）；滿了、錢不夠時不動作。可以順便取名、穿上一件已經有的毛色 */
  | { type: 'adoptCat'; name?: string; fur?: ItemId }
  /** 帶不帶這隻出門；已經帶了 HOUSE.maxOut 隻時再加不動作 */
  | { type: 'setCatOuting'; cat: CatId; on: boolean }
  /** 換成這隻陪我刷題（全家只有一隻）；不在家裡的 ID 不動作 */
  | { type: 'setLeader'; cat: CatId };
