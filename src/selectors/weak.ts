import { WEAK_MIN_ANSWERED, WEAK_ROUND_COUNT, WEAK_TOP_N } from '../core/constants/weak';
import type { BankId, RoundConfig, SubjectKey, TopicInfo } from '../core/types';
import type { World } from '../core/world';

export interface TopicStatView {
  id: string;
  name: string;
  subjectKey: SubjectKey;
  subjectShort: string;
  total: number;
  answered: number;
  attempts: number;
  wrongAttempts: number;
  wrongNow: number;
  wrongRate: number;
}

export interface WeakSummaryView {
  ready: boolean;
  answeredTotal: number;
  topicCount: number;
}

interface TopicBucket {
  topic: TopicInfo;
  total: number;
  answered: number;
  attempts: number;
  wrongAttempts: number;
  wrongNow: number;
}

/** 統計指定題庫各考點的題數、作答數、答錯次數、上次答錯題數與錯誤率。 */
export function topicStats(world: World, bankId: BankId): TopicStatView[] {
  const bank = world.banks.find((b) => b.id === bankId);
  if (!bank) {
    return [];
  }

  const topicById = new Map<string, TopicInfo>();
  const topicOrder = new Map<string, number>();
  world.topics.forEach((topic, index) => {
    topicById.set(topic.id, topic);
    topicOrder.set(topic.id, index);
  });

  const subjectShortMap = new Map<SubjectKey, string>();
  for (const b of world.banks) {
    for (const s of b.subjects) {
      subjectShortMap.set(s.key, s.short);
    }
  }
  for (const s of bank.subjects) {
    subjectShortMap.set(s.key, s.short);
  }

  const buckets = new Map<string, TopicBucket>();

  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    const paper = world.papers.get(question.paperId);
    if (!paper || paper.bankId !== bankId) continue;

    const enrich = world.enrich.get(question.id);
    if (!enrich || enrich.topic.length === 0) continue;

    const prog = world.progress.get(question.id);
    const isAnswered = prog !== undefined && prog.seen > 0;
    const seen = isAnswered ? prog.seen : 0;
    const wrong = isAnswered ? prog.seen - prog.correct : 0;
    const isWrongNow = isAnswered && prog.streak === 0;

    for (const topicId of new Set(enrich.topic)) {
      const topicInfo = topicById.get(topicId);
      if (!topicInfo) continue;

      let bucket = buckets.get(topicId);
      if (!bucket) {
        bucket = {
          topic: topicInfo,
          total: 0,
          answered: 0,
          attempts: 0,
          wrongAttempts: 0,
          wrongNow: 0,
        };
        buckets.set(topicId, bucket);
      }

      bucket.total += 1;
      if (isAnswered) {
        bucket.answered += 1;
        bucket.attempts += seen;
        bucket.wrongAttempts += wrong;
        if (isWrongNow) {
          bucket.wrongNow += 1;
        }
      }
    }
  }

  const list = [...buckets.values()];
  list.sort((a, b) => (topicOrder.get(a.topic.id) ?? 0) - (topicOrder.get(b.topic.id) ?? 0));

  return list.map((bucket) => ({
    id: bucket.topic.id,
    name: bucket.topic.name,
    subjectKey: bucket.topic.subjectKey,
    subjectShort: subjectShortMap.get(bucket.topic.subjectKey) ?? bucket.topic.subjectKey,
    total: bucket.total,
    answered: bucket.answered,
    attempts: bucket.attempts,
    wrongAttempts: bucket.wrongAttempts,
    wrongNow: bucket.wrongNow,
    wrongRate: bucket.attempts > 0 ? bucket.wrongAttempts / bucket.attempts : 0,
  }));
}

/** 篩選出達門檻且有錯題的弱點考點，依錯誤率、上次答錯數、id 排序，最多回傳 WEAK_TOP_N 筆。 */
export function weakTopics(world: World, bankId: BankId): TopicStatView[] {
  return topicStats(world, bankId)
    .filter((topic) => topic.answered >= WEAK_MIN_ANSWERED && topic.wrongAttempts > 0)
    .sort((a, b) => {
      if (b.wrongRate !== a.wrongRate) return b.wrongRate - a.wrongRate;
      if (b.wrongNow !== a.wrongNow) return b.wrongNow - a.wrongNow;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, WEAK_TOP_N);
}

/** 產生弱點回合設定；未指定 topicIds 時使用全部弱點考點，沒有弱點考點時回傳 null。 */
export function weakRoundConfig(
  world: World,
  bankId: BankId,
  topicIds?: readonly string[],
): RoundConfig | null {
  const ids =
    topicIds !== undefined
      ? [...topicIds]
      : weakTopics(world, bankId).map((topic) => topic.id);

  if (ids.length === 0) {
    return null;
  }

  return {
    bankId,
    subjectKeys: [],
    count: WEAK_ROUND_COUNT,
    mode: 'mixed',
    fast: world.settings.lastRound?.fast ?? false,
    study: 'quiz',
    ask: 'all',
    passes: 1,
    topicIds: ids,
  };
}

/** 讀取弱點區需要的摘要（是否已有弱點考點、題庫已作答題數、弱點考點數）。 */
export function weakSummary(world: World, bankId: BankId): WeakSummaryView {
  let answeredTotal = 0;
  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    const paper = world.papers.get(question.paperId);
    if (!paper || paper.bankId !== bankId) continue;
    const prog = world.progress.get(question.id);
    if (prog && prog.seen > 0) {
      answeredTotal += 1;
    }
  }

  const weak = weakTopics(world, bankId);
  return {
    ready: weak.length > 0,
    answeredTotal,
    topicCount: weak.length,
  };
}
