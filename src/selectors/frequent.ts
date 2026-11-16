import { FREQ_ROUND_COUNT, FREQ_TOP_PER_SUBJECT } from '../core/constants/frequent';
import type { BankId, RoundConfig, SubjectKey } from '../core/types';
import type { World } from '../core/world';
import { topicStats, type TopicStatView } from './weak';

/**
 * 高頻考點：每一科依「題庫裡的歷年題數」取前 FREQ_TOP_PER_SUBJECT 個考點。
 * 回傳順序：照題庫的科目順序，同科內題數多的在前；題數相同時維持 topics.json 的順序。
 */
export function frequentTopics(world: World, bankId: BankId): TopicStatView[] {
  const bank = world.banks.find((b) => b.id === bankId);
  if (!bank) {
    return [];
  }

  const bySubject = new Map<SubjectKey, TopicStatView[]>();
  for (const topic of topicStats(world, bankId)) {
    if (topic.total === 0) continue;
    const list = bySubject.get(topic.subjectKey);
    if (list) {
      list.push(topic);
    } else {
      bySubject.set(topic.subjectKey, [topic]);
    }
  }

  const result: TopicStatView[] = [];
  for (const subject of bank.subjects) {
    const list = bySubject.get(subject.key);
    if (!list) continue;
    // Array.prototype.sort 是穩定排序：題數相同時保留 topicStats 的順序（topics.json 順序）
    const top = [...list].sort((a, b) => b.total - a.total).slice(0, FREQ_TOP_PER_SUBJECT);
    result.push(...top);
  }
  return result;
}

/** 產生高頻回合設定；未指定 topicIds 時使用全部高頻考點，沒有高頻考點時回傳 null。 */
export function frequentRoundConfig(
  world: World,
  bankId: BankId,
  topicIds?: readonly string[],
): RoundConfig | null {
  const ids =
    topicIds !== undefined
      ? [...topicIds]
      : frequentTopics(world, bankId).map((topic) => topic.id);

  if (ids.length === 0) {
    return null;
  }

  return {
    bankId,
    subjectKeys: [],
    count: FREQ_ROUND_COUNT,
    mode: 'mixed',
    fast: world.settings.lastRound?.fast ?? false,
    study: 'quiz',
    ask: 'all',
    passes: 1,
    topicIds: ids,
  };
}
