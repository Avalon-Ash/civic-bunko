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
/** 衣櫥狀態（存在 Settings.wardrobe）。owned、achievements、quests 跨裝置同步並取聯集；outfit 只存在各裝置。 */
export interface WardrobeState {
  /** 用小魚乾買下的配件（不含集章與成就送的） */
  owned: ItemId[];
  /** 已解鎖的成就；解鎖後不收回 */
  achievements: AchievementId[];
  /** 每天完成的小任務 */
  quests: Record<DayKey, QuestId[]>;
  /** 目前穿著；沒有這欄時沿用舊的 settings.accessory */
  outfit?: Outfit;
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
export type SoundName = 'tap' | 'correct' | 'wrong' | 'reward' | 'meow';
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
  /** 看過的最新一則更新紀錄 ID；各裝置自己的設定，不同步 */
  changelogSeen?: string;
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
  /** 穿上（item 為 null＝脫掉）；只接受已擁有、部位相符的配件 */
  | { type: 'wear'; slot: SlotId; item: ItemId | null }
  /** 畫面放完慶祝後清掉 */
  | { type: 'dismissCelebrations' }
  | { type: 'setSound'; on: boolean }
  /** 更新紀錄看完了（記下最新一則的 ID） */
  | { type: 'markChangelogSeen'; id: string };
