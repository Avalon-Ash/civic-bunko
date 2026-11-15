import type {
  Bank,
  BankId,
  Choice,
  Enrich,
  OfficialQuestion,
  PassageGroup,
  QuestionId,
  RoundConfig,
  SubjectKey,
} from '../core/types';
import type { World } from '../core/world';
import { isDue, localDaysUntil } from '../systems/date';
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
