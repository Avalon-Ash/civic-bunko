import type { Progress, QuestionId, RoundConfig } from '../core/types';
import type { World } from '../core/world';
import { askTypeOf } from './askType';
import { isDue } from './date';

function isNewQuestion(progress: Progress | undefined): boolean {
  return progress === undefined || progress.seen === 0;
}

function isViewedOnlyQuestion(progress: Progress | undefined): boolean {
  return progress !== undefined && progress.views > 0 && progress.seen === 0;
}

function isWrongQuestion(progress: Progress | undefined): boolean {
  return progress !== undefined && progress.seen > 0 && progress.streak === 0;
}

/** 回傳洗牌後的新陣列（不改動原陣列）。 */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const a = arr[i];
    const b = arr[j];
    if (a !== undefined && b !== undefined) {
      arr[i] = b;
      arr[j] = a;
    }
  }
  return arr;
}

function collectEligibleIds(world: World, config: RoundConfig): QuestionId[] {
  const hasSubjectFilter = config.subjectKeys.length > 0;
  const subjectSet = hasSubjectFilter ? new Set(config.subjectKeys) : null;
  const ids: QuestionId[] = [];

  for (const question of world.questions.values()) {
    if (question.parseStatus !== 'ok') continue;
    const paper = world.papers.get(question.paperId);
    if (!paper || paper.bankId !== config.bankId) continue;
    if (subjectSet && !subjectSet.has(paper.subjectKey)) continue;
    if (config.ask !== 'all' && askTypeOf(question.stem) !== config.ask) continue;
    ids.push(question.id);
  }

  return ids;
}

function partitionForMode(
  world: World,
  config: RoundConfig,
  now: Date,
): QuestionId[][] {
  const eligible = collectEligibleIds(world, config);

  if (config.mode === 'new') {
    return [eligible.filter((id) => isNewQuestion(world.progress.get(id)))];
  }
  if (config.mode === 'wrong') {
    return [eligible.filter((id) => isWrongQuestion(world.progress.get(id)))];
  }
  if (config.mode === 'due') {
    return [
      eligible.filter((id) => {
        const prog = world.progress.get(id);
        return prog !== undefined && isDue(prog.due, now);
      }),
    ];
  }

  // mixed：到期 → 上次答錯 → 看過但還沒作答過 → 沒看過也沒作答 → 其餘（互斥分層以確保不重複）
  const dueTier: QuestionId[] = [];
  const wrongTier: QuestionId[] = [];
  const viewedOnlyTier: QuestionId[] = [];
  const unseenTier: QuestionId[] = [];
  const restTier: QuestionId[] = [];

  for (const id of eligible) {
    const prog = world.progress.get(id);
    if (prog !== undefined && isDue(prog.due, now)) {
      dueTier.push(id);
    } else if (isWrongQuestion(prog)) {
      wrongTier.push(id);
    } else if (isViewedOnlyQuestion(prog)) {
      viewedOnlyTier.push(id);
    } else if (isNewQuestion(prog)) {
      unseenTier.push(id);
    } else {
      restTier.push(id);
    }
  }

  return [dueTier, wrongTier, viewedOnlyTier, unseenTier, restTier];
}

/** 依設定篩選題目並洗牌，回傳不重複、最多 config.count 題的題號陣列。 */
export function buildQueue(
  world: World,
  config: RoundConfig,
  now: Date,
  rng: () => number,
): QuestionId[] {
  const limit = Math.max(0, Math.floor(config.count));
  if (limit === 0) return [];

  const tiers = partitionForMode(world, config, now);
  const queue: QuestionId[] = [];

  for (const tier of tiers) {
    if (queue.length >= limit) break;
    const shuffled = shuffle(tier, rng);
    const remaining = limit - queue.length;
    queue.push(...shuffled.slice(0, remaining));
  }

  return queue;
}

/** 計算指定設定下最多能出幾題（不含 count 上限）。 */
export function countAvailable(
  world: World,
  config: RoundConfig,
  now: Date,
): number {
  const tiers = partitionForMode(world, config, now);
  let total = 0;
  for (const tier of tiers) {
    total += tier.length;
  }
  return total;
}
