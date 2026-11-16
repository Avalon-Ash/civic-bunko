// SSOT：全專案的型別只定義在這裡。其他檔案一律 import，不得重複宣告。
// tools/parser 與 tools/validate 是 .mjs，產出的 JSON 必須符合這裡的形狀。

export type Choice = 'A' | 'B' | 'C' | 'D';
export type ExamKind = 'general' | 'local4';
export type BankId = string;
export type SubjectKey = string;
/** `<年度>-<考試>-<科目key>`，例 `115-general-admin-law` */
export type PaperId = string;
/** `<PaperId>-q<兩位數題號>`，例 `115-general-admin-law-q08` */
export type QuestionId = string;

// ── 題庫登記（data/banks.json）────────────────────────────
export interface SubjectInfo {
  key: SubjectKey;
  name: string;
  /** 兩到四個字的短名，用在小標籤 */
  short: string;
}
export interface Bank {
  id: BankId;
  title: string;
  /** 筆試第一天，ISO 日期 */
  examDate: string;
  subjects: SubjectInfo[];
}

// ── 官方層（data/official/**，只由 tools/parser 產生）──────
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
/** data/official/<PaperId>.json */
export interface PaperFile {
  paper: Paper;
  groups: PassageGroup[];
  questions: OfficialQuestion[];
  essays: EssayQuestion[];
}
/** data/official/index.json */
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

// ── 加工層（data/enrich/<PaperId>.json，AI 產生，可能不存在）──
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
  /** data/topics.json 的 id，1–2 個 */
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

// ── 卡片（data/cards/<deck>.json，主代理撰寫）──────────────
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
}

// ── 每日紀錄與集章 ──────────────────────────────────────
/** 當地日期 YYYY-MM-DD */
export type DayKey = string;
export type AccessoryId = 'bow' | 'straw-hat' | 'scarf' | 'flower' | 'glasses' | 'crown';

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
  | { type: 'roundFinished'; results: RoundResult[]; at: string }
  | { type: 'roundRestored' }
  | { type: 'cardsLoaded'; count: number }
  | { type: 'progressChanged'; ids: QuestionId[] }
  | { type: 'dayLogChanged'; day: DayKey; count: number }
  | { type: 'settingsChanged'; settings: Settings }
  | { type: 'syncChanged'; sync: SyncState };

// ── 指令（畫面寫入狀態的唯一入口）────────────────────────
export type UICommand =
  | { type: 'startRound'; config: RoundConfig }
  | { type: 'answer'; pick: Choice }
  | { type: 'next' }
  | { type: 'quitRound' }
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
  | { type: 'markCardSeen'; id: string }
  | { type: 'importProgress'; json: string }
  | { type: 'resetProgress' }
  | { type: 'setSyncCode'; code: string }
  | { type: 'syncNow' }
  | { type: 'disableSync' };
