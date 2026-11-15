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

// ── 加工層（data/enrich/**，AI 產生，可能不存在）──────────
export type MarkColor = 'red' | 'blue';
export interface Enrich {
  id: QuestionId;
  topic: string[];
  /** 口訣 */
  mnemonic: string;
  /** 陷阱提醒 */
  trap: string;
  /** 白話情境 */
  plain: string | null;
  marks: Array<{ start: number; end: number; color: MarkColor }>;
  options: Record<Choice, { why: string; lawRef: { law: string; article: string } | null }>;
  model: string;
  generatedAt: string;
  reviewed: boolean;
}

// ── 個人進度（只存在裝置上）──────────────────────────────
export interface Progress {
  seen: number;
  correct: number;
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
export interface RoundConfig {
  bankId: BankId;
  /** 空陣列＝全部科目 */
  subjectKeys: SubjectKey[];
  count: number;
  mode: RoundMode;
  /** 快刷：答對自動下一題 */
  fast: boolean;
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
}

// ── 設定 ────────────────────────────────────────────────
export type ThemeChoice = 'system' | 'light' | 'dark';
export interface Settings {
  theme: ThemeChoice;
  /** 上一次的回合設定，下次預填 */
  lastRound: RoundConfig | null;
  /** 已按過「知道了」，不再顯示加到主畫面的引導 */
  installHintDismissed?: boolean;
}

// ── 事件（System 之間唯一的溝通方式）──────────────────────
export type AppEvent =
  | { type: 'bankLoaded'; bankId: BankId; questionCount: number }
  | { type: 'roundStarted'; config: RoundConfig; queue: QuestionId[] }
  | { type: 'answered'; id: QuestionId; pick: Choice; correct: boolean; at: string }
  | { type: 'roundFinished'; results: RoundResult[]; at: string }
  | { type: 'progressChanged'; ids: QuestionId[] }
  | { type: 'settingsChanged'; settings: Settings };

// ── 指令（畫面寫入狀態的唯一入口）────────────────────────
export type UICommand =
  | { type: 'startRound'; config: RoundConfig }
  | { type: 'answer'; pick: Choice }
  | { type: 'next' }
  | { type: 'quitRound' }
  | { type: 'retryWrong' }
  | { type: 'setTheme'; theme: ThemeChoice }
  | { type: 'dismissInstallHint' }
  | { type: 'importProgress'; json: string }
  | { type: 'resetProgress' };
