import { ROUND_COUNT_MIN, SECONDS_PER_QUESTION } from '../core/constants/round';
import type {
  Bank,
  BankId,
  Choice,
  Enrich,
  OfficialQuestion,
  Paper,
  PaperId,
  PassageGroup,
  QuestionId,
  RoundConfig,
  Settings,
  SubjectKey,
} from '../core/types';
import type { World } from '../core/world';
import { isDue, localDaysUntil, toLocalDateString } from '../systems/date';
import { countAvailable } from '../systems/selection';

export interface CurrentQuestionView {
  question: OfficialQuestion;
  group: PassageGroup | null;
  enrich: Enrich | null;
  index: number;
  total: number;
  pick: Choice | null;
  isCorrect: boolean | null;
  combo: number;
}

export interface RoundSummaryView {
  total: number;
  correct: number;
  wrongIds: QuestionId[];
}

export interface SubjectStatView {
  key: SubjectKey;
  name: string;
  short: string;
  total: number;
  seen: number;
  correctRate: number;
}

/** 讀取進行中回合的目前題目與作答狀態。 */
export function currentQuestion(world: World): CurrentQuestionView | null {
  const round = world.round;
  if (!round || round.finished) {
    return null;
  }

  const questionId = round.queue[round.index];
  if (questionId === undefined) {
    return null;
  }

  const question = world.questions.get(questionId);
  if (!question) {
    return null;
  }

  const group = question.groupId ? (world.groups.get(question.groupId) ?? null) : null;
  const enrich = world.enrich.get(questionId) ?? null;
  const pick = round.pick;
  const isCorrect = pick === null ? null : question.answer.includes(pick);

  return {
    question,
    group,
    enrich,
    index: round.index,
    total: round.queue.length,
    pick,
    isCorrect,
    combo: round.combo,
  };
}

/** 讀取剛結束那一回合的摘要（總題數、答對數、錯題 ID 清單）。 */
export function roundSummary(world: World): RoundSummaryView | null {
  const lastRound = world.lastRound;
  if (!lastRound) {
    return null;
  }

  const total = lastRound.results.length;
  let correct = 0;
  const wrongIds: QuestionId[] = [];

  for (const result of lastRound.results) {
    if (result.correct) {
      correct += 1;
    } else {
      wrongIds.push(result.id);
    }
  }

  return { total, correct, wrongIds };
}

/** 統計指定題庫各科目的總題數、已作答題數與正確率（0–1）。 */
export function subjectStats(world: World, bankId: BankId): SubjectStatView[] {
  const bank = world.banks.find((b) => b.id === bankId);
  if (!bank) {
    return [];
  }

  const counts = new Map<SubjectKey, { total: number; seen: number; attempts: number; correct: number }>();
  for (const subject of bank.subjects) {
    counts.set(subject.key, { total: 0, seen: 0, attempts: 0, correct: 0 });
  }

  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    const paper = world.papers.get(question.paperId);
    if (!paper || paper.bankId !== bankId) continue;

    const bucket = counts.get(paper.subjectKey);
    if (!bucket) continue;

    bucket.total += 1;
    const prog = world.progress.get(question.id);
    if (prog && prog.seen > 0) {
      bucket.seen += 1;
      bucket.attempts += prog.seen;
      bucket.correct += prog.correct;
    }
  }

  return bank.subjects.map((subject) => {
    const bucket = counts.get(subject.key);
    const total = bucket?.total ?? 0;
    const seen = bucket?.seen ?? 0;
    const attempts = bucket?.attempts ?? 0;
    const correct = bucket?.correct ?? 0;
    return {
      key: subject.key,
      name: subject.name,
      short: subject.short,
      total,
      seen,
      correctRate: attempts > 0 ? correct / attempts : 0,
    };
  });
}

/** 計算指定題庫目前已到期需要複習的題數。 */
export function dueCount(world: World, bankId: BankId, now: Date): number {
  let count = 0;
  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    const paper = world.papers.get(question.paperId);
    if (!paper || paper.bankId !== bankId) continue;

    const prog = world.progress.get(question.id);
    if (prog && isDue(prog.due, now)) {
      count += 1;
    }
  }
  return count;
}

/** 計算指定題庫目前「上次答錯」的題數。 */
export function wrongCount(world: World, bankId: BankId): number {
  let count = 0;
  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    const paper = world.papers.get(question.paperId);
    if (!paper || paper.bankId !== bankId) continue;

    const prog = world.progress.get(question.id);
    if (prog && prog.seen > 0 && prog.streak === 0) {
      count += 1;
    }
  }
  return count;
}

/** 計算距離考試日期的當地剩餘天數；考試當天為 0，過期不為負。 */
export function daysLeft(bank: Bank, now: Date): number {
  return localDaysUntil(bank.examDate, now);
}

/** 計算此回合設定下最多能出幾題。 */
export function availableCount(world: World, config: RoundConfig, now: Date): number {
  return countAvailable(world, config, now);
}

export interface BankTotalsView {
  total: number;
  seen: number;
}

export interface DailyMissionView {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  tone: 'butter' | 'mint' | 'pink';
  available: number;
  config: RoundConfig;
}

export interface WeekDayView {
  date: string;
  label: string;
  done: boolean;
  isToday: boolean;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 取得目前使用中的題庫（優先取最近回合的題庫，否則取第一個）。 */
export function activeBank(world: World): Bank | null {
  const preferredId = world.settings.lastRound?.bankId;
  if (preferredId) {
    const found = world.banks.find((b) => b.id === preferredId);
    if (found) return found;
  }
  return world.banks[0] ?? null;
}

/** 統計指定題庫的總題數與已刷題數。 */
export function bankTotals(world: World, bankId: BankId): BankTotalsView {
  let total = 0;
  let seen = 0;

  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    const paper = world.papers.get(question.paperId);
    if (!paper || paper.bankId !== bankId) continue;

    total += 1;
    const prog = world.progress.get(question.id);
    if (prog && prog.seen > 0) {
      seen += 1;
    }
  }

  return { total, seen };
}

/** 唯讀取得使用者設定複本。 */
export function getSettings(world: World): Settings {
  return {
    theme: world.settings.theme,
    lastRound: world.settings.lastRound
      ? {
          ...world.settings.lastRound,
          subjectKeys: [...world.settings.lastRound.subjectKeys],
        }
      : null,
  };
}

/** 取得進行中回合的設定複本；未進行回合時回傳 null。 */
export function currentRoundConfig(world: World): RoundConfig | null {
  const round = world.round;
  if (!round || round.finished) {
    return null;
  }
  return {
    ...round.config,
    subjectKeys: [...round.config.subjectKeys],
  };
}

/** 依試卷 ID 取得試卷中繼資料。 */
export function questionPaper(world: World, paperId: PaperId): Paper | null {
  return world.papers.get(paperId) ?? null;
}

function estimateMinutesText(questionCount: number): string {
  const mins = Math.max(1, Math.round((questionCount * SECONDS_PER_QUESTION) / 60));
  return `約 ${mins} 分鐘`;
}

/** 依題庫科目與作答進度產生三個今日 5 題快速任務。 */
export function dailyMissions(world: World, bankId: BankId, now: Date): DailyMissionView[] {
  const bank = world.banks.find((b) => b.id === bankId);
  if (!bank) {
    return [];
  }

  const missions: DailyMissionView[] = [];
  const tones: readonly ('butter' | 'mint' | 'pink')[] = ['butter', 'mint', 'pink'];

  for (const subject of bank.subjects) {
    if (missions.length >= 2) break;
    const config: RoundConfig = {
      bankId,
      subjectKeys: [subject.key],
      count: ROUND_COUNT_MIN,
      mode: 'mixed',
      fast: true,
    };
    const available = countAvailable(world, config, now);
    if (available === 0) continue;

    const actualCount = Math.min(ROUND_COUNT_MIN, available);
    const tone = tones[missions.length] ?? 'butter';
    missions.push({
      id: `subj-${subject.key}`,
      badge: subject.short.slice(0, 1) || '題',
      title: `${subject.short} ${actualCount} 題`,
      subtitle: estimateMinutesText(actualCount),
      tone,
      available,
      config: { ...config, count: actualCount },
    });
  }

  const dueTotal = dueCount(world, bankId, now);
  const wrongTotal = wrongCount(world, bankId);

  let thirdConfig: RoundConfig;
  let thirdBadge: string;
  let thirdTitle: string;
  let thirdSubtitle: string;

  if (dueTotal > 0) {
    thirdConfig = { bankId, subjectKeys: [], count: ROUND_COUNT_MIN, mode: 'due', fast: true };
    const actualCount = Math.min(ROUND_COUNT_MIN, dueTotal);
    thirdConfig.count = actualCount;
    thirdBadge = '複';
    thirdTitle = `到期複習 ${actualCount} 題`;
    thirdSubtitle = `${dueTotal} 題該回來看看`;
  } else if (wrongTotal > 0) {
    thirdConfig = { bankId, subjectKeys: [], count: ROUND_COUNT_MIN, mode: 'wrong', fast: true };
    const actualCount = Math.min(ROUND_COUNT_MIN, wrongTotal);
    thirdConfig.count = actualCount;
    thirdBadge = '錯';
    thirdTitle = `錯題重練 ${actualCount} 題`;
    thirdSubtitle = `${wrongTotal} 題上次答錯`;
  } else {
    thirdConfig = { bankId, subjectKeys: [], count: ROUND_COUNT_MIN, mode: 'mixed', fast: true };
    const availAll = countAvailable(world, thirdConfig, now);
    const actualCount = Math.min(ROUND_COUNT_MIN, availAll);
    thirdConfig.count = actualCount;
    thirdBadge = '綜';
    thirdTitle = `綜合快刷 ${actualCount} 題`;
    thirdSubtitle = estimateMinutesText(actualCount);
  }

  const thirdAvail = countAvailable(world, thirdConfig, now);
  if (thirdAvail > 0) {
    missions.push({
      id: `extra-${thirdConfig.mode}`,
      badge: thirdBadge,
      title: thirdTitle,
      subtitle: thirdSubtitle,
      tone: tones[missions.length] ?? 'pink',
      available: thirdAvail,
      config: thirdConfig,
    });
  }

  return missions;
}

/** 計算本週（週一到週日）每日是否有作答紀錄。 */
export function weekActivity(world: World, now: Date): WeekDayView[] {
  const activeDates = new Set<string>();
  for (const prog of world.progress.values()) {
    const d = new Date(prog.lastAt);
    if (!Number.isNaN(d.getTime())) {
      activeDates.add(toLocalDateString(d));
    }
  }

  const todayStr = toLocalDateString(now);
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return WEEKDAY_LABELS.map((label, idx) => {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + idx);
    const dateStr = toLocalDateString(dayDate);
    return {
      date: dateStr,
      label,
      done: activeDates.has(dateStr),
      isToday: dateStr === todayStr,
    };
  });
}
