import { EXAM_SECONDS_PER_QUESTION, EXAM_WARN_SECONDS } from '../core/constants/exam';
import type {
  BankId,
  Choice,
  Enrich,
  ExamKind,
  OfficialQuestion,
  PaperId,
  PassageGroup,
  QuestionId,
  SubjectKey,
} from '../core/types';
import type { World } from '../core/world';

export interface ExamPaperView {
  paperId: PaperId;
  subjectKey: SubjectKey;
  subjectName: string;
  year: number;
  exam: ExamKind;
  count: number;
  minutes: number;
}

export interface ExamClockView {
  remainingSeconds: number;
  totalSeconds: number;
  warn: boolean;
  expired: boolean;
}

export interface ExamWrongItem {
  id: QuestionId;
  no: number;
  pick: Choice;
  answer: Choice[];
}

export interface ExamResultView {
  paperId: PaperId;
  total: number;
  answered: number;
  correct: number;
  score: number;
  wrong: ExamWrongItem[];
}

/** 依科目順序與年度新到舊列出指定題庫內有題目的模擬考試卷。 */
export function examPapers(world: World, bankId: BankId): ExamPaperView[] {
  const bank = world.banks.find((b) => b.id === bankId);
  if (!bank) {
    return [];
  }

  const subjectOrder = new Map<SubjectKey, number>();
  bank.subjects.forEach((subject, idx) => {
    subjectOrder.set(subject.key, idx);
  });

  const okCounts = new Map<PaperId, number>();
  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    okCounts.set(question.paperId, (okCounts.get(question.paperId) ?? 0) + 1);
  }

  const list: Array<{ order: number; item: ExamPaperView }> = [];
  for (const paper of world.papers.values()) {
    if (paper.bankId !== bankId) continue;
    const order = subjectOrder.get(paper.subjectKey);
    if (order === undefined) continue;
    const count = okCounts.get(paper.id) ?? 0;
    if (count === 0) continue;

    list.push({
      order,
      item: {
        paperId: paper.id,
        subjectKey: paper.subjectKey,
        subjectName: bank.subjects[order]?.name ?? paper.subjectName,
        year: paper.year,
        exam: paper.exam,
        count,
        minutes: Math.ceil((count * EXAM_SECONDS_PER_QUESTION) / 60),
      },
    });
  }

  list.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (b.item.year !== a.item.year) return b.item.year - a.item.year;
    if (a.item.exam !== b.item.exam) return b.item.exam.localeCompare(a.item.exam);
    return a.item.paperId.localeCompare(b.item.paperId);
  });

  return list.map((entry) => entry.item);
}

/** 計算模擬考目前的倒數剩餘秒數與提醒／逾時狀態；非模擬考回合回傳 null。 */
export function examClock(world: World, now: Date): ExamClockView | null {
  const round = world.round;
  if (!round || round.finished || !round.config.exam) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.round(round.config.exam.minutes * 60));
  const startedAtMs = round.startedAt ? Date.parse(round.startedAt) : NaN;
  const elapsedSeconds = Number.isNaN(startedAtMs)
    ? 0
    : Math.max(0, Math.floor((now.getTime() - startedAtMs) / 1000));
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const expired = remainingSeconds === 0;
  const warn = remainingSeconds <= EXAM_WARN_SECONDS;

  return {
    remainingSeconds,
    totalSeconds,
    warn,
    expired,
  };
}

/** 讀取剛結束模擬考的成績摘要與錯題清單；非模擬考回合回傳 null。 */
export function examResult(world: World): ExamResultView | null {
  const lastRound = world.lastRound;
  if (!lastRound || !lastRound.config.exam) {
    return null;
  }

  const total = lastRound.queue.length;
  const answered = lastRound.results.length;
  let correct = 0;
  const wrong: ExamWrongItem[] = [];

  for (const result of lastRound.results) {
    if (result.correct) {
      correct += 1;
    } else {
      const question = world.questions.get(result.id);
      wrong.push({
        id: result.id,
        no: question?.no ?? 0,
        pick: result.pick,
        answer: question ? [...question.answer] : [],
      });
    }
  }

  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    paperId: lastRound.config.exam.paperId,
    total,
    answered,
    correct,
    score,
    wrong,
  };
}

export interface ExamQuestionDetailView {
  question: OfficialQuestion;
  group: PassageGroup | null;
  enrich: Enrich | null;
}

/** 依題目 ID 讀取完整題目、題組文章與加工解析（供模擬考結果檢視錯題抽屜使用）。 */
export function examQuestionDetail(
  world: World,
  questionId: QuestionId,
): ExamQuestionDetailView | null {
  const question = world.questions.get(questionId);
  if (!question) {
    return null;
  }
  const group = question.groupId ? (world.groups.get(question.groupId) ?? null) : null;
  const enrich = world.enrich.get(questionId) ?? null;
  return { question, group, enrich };
}
