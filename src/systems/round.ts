import type { Choice, RoundConfig, RoundResult, RoundState } from '../core/types';
import type { World } from '../core/world';
import { buildExamQueue, buildOptionOrders, buildQueue, shuffle } from './selection';

export type RoundStepOutcome = 'noop' | 'advanced' | 'finished' | 'discarded';

/** 檢查待續接的回合是否所有題目都仍存在於題庫；有缺題就丟棄並回傳 true。 */
export function validateSavedRound(world: World): boolean {
  const saved = world.savedRound;
  if (!saved) {
    return false;
  }
  if (world.questions.size === 0) {
    return false;
  }
  if (saved.config.exam && !world.papers.has(saved.config.exam.paperId)) {
    world.savedRound = null;
    return true;
  }
  const allExist = saved.queue.every((id) => world.questions.has(id));
  if (!allExist) {
    world.savedRound = null;
    return true;
  }
  return false;
}

/** 訂閱 bankLoaded，在題庫載入完成後驗證待續接的回合。 */
export function attachRound(world: World): () => void {
  return world.bus.on('bankLoaded', (event) => {
    if (!world.savedRound) return;
    if (world.savedRound.config.bankId !== event.bankId) return;
    validateSavedRound(world);
  });
}

/** 依設定組題並開始新回合；若沒有符合條件的題目則不開啟回合。 */
export function startRound(
  world: World,
  config: RoundConfig,
  now: () => Date,
  rng: () => number,
): void {
  const examConfig = config.exam ?? null;
  if (examConfig) {
    const queue = buildExamQueue(world, examConfig.paperId);
    if (queue.length === 0) {
      return;
    }

    const normalizedConfig: RoundConfig = {
      ...config,
      subjectKeys: [...config.subjectKeys],
      fast: false,
      study: 'quiz',
      passes: 1,
      exam: {
        paperId: examConfig.paperId,
        minutes: examConfig.minutes,
      },
    };

    world.savedRound = null;
    world.round = {
      config: normalizedConfig,
      queue,
      index: 0,
      pick: null,
      results: [],
      combo: 0,
      finished: false,
      pass: 1,
      startedAt: now().toISOString(),
      examPicks: {},
    };

    world.bus.emit({
      type: 'roundStarted',
      config: normalizedConfig,
      queue: [...queue],
    });
    return;
  }

  const queue = buildQueue(world, config, now(), rng);
  if (queue.length === 0) {
    return;
  }

  const { exam: _ignoredExam, ...restConfig } = config;
  const normalizedConfig: RoundConfig = {
    ...restConfig,
    subjectKeys: [...config.subjectKeys],
    passes: Math.max(1, Math.floor(config.passes)),
  };

  const shouldShuffleOptions =
    normalizedConfig.study === 'quiz' && world.settings.shuffleOptions === true;

  world.savedRound = null;
  world.round = {
    config: normalizedConfig,
    queue,
    index: 0,
    pick: null,
    results: [],
    combo: 0,
    finished: false,
    pass: 1,
    ...(shouldShuffleOptions ? { optionOrder: buildOptionOrders(queue, rng) } : {}),
  };

  world.bus.emit({
    type: 'roundStarted',
    config: normalizedConfig,
    queue: [...queue],
  });
}

/** 作答目前題目；看答案模式與模擬考不接受作答，同一題只能作答一次。 */
export function answerQuestion(
  world: World,
  pick: Choice,
  now: () => Date,
): void {
  const round = world.round;
  if (
    !round ||
    round.finished ||
    round.config.study === 'read' ||
    round.config.exam ||
    round.pick !== null
  ) {
    return;
  }

  const questionId = round.queue[round.index];
  if (questionId === undefined) {
    return;
  }

  const question = world.questions.get(questionId);
  if (!question) {
    return;
  }

  const correct = question.answer.includes(pick);
  round.pick = pick;
  round.combo = correct ? round.combo + 1 : 0;
  round.results.push({ id: questionId, pick, correct });

  world.bus.emit({
    type: 'answered',
    id: questionId,
    pick,
    correct,
    at: now().toISOString(),
  });
}

/** 模擬考：記下（或覆蓋）目前這題的答案，不計分、不發 answered、不換題。 */
export function examPick(world: World, pick: Choice): boolean {
  const round = world.round;
  if (!round || round.finished || !round.config.exam) {
    return false;
  }

  const questionId = round.queue[round.index];
  if (questionId === undefined || !world.questions.has(questionId)) {
    return false;
  }

  if (!round.examPicks) {
    round.examPicks = {};
  }
  round.examPicks[questionId] = pick;
  round.pick = pick;
  return true;
}

/** 模擬考：跳到指定題目（index 夾在 0..queue.length-1），並帶回該題已選答案。 */
export function examGoto(world: World, index: number): boolean {
  const round = world.round;
  if (
    !round ||
    round.finished ||
    !round.config.exam ||
    round.queue.length === 0 ||
    !Number.isFinite(index)
  ) {
    return false;
  }

  const clamped = Math.max(0, Math.min(round.queue.length - 1, Math.floor(index)));
  const targetId = round.queue[clamped];
  const nextPick = targetId !== undefined ? (round.examPicks?.[targetId] ?? null) : null;
  const changed = clamped !== round.index || round.pick !== nextPick;

  round.index = clamped;
  round.pick = nextPick;
  return changed;
}

/** 前進下一題；作答模式未作答時不動，模擬考不使用此指令，看答案模式會發 viewed 並在多遍間重新洗牌。 */
export function nextQuestion(
  world: World,
  now: () => Date,
  rng: () => number = Math.random,
): RoundStepOutcome {
  const round = world.round;
  if (!round || round.finished || round.config.exam) {
    return 'noop';
  }

  if (round.config.study === 'read') {
    const currentId = round.queue[round.index];
    if (currentId !== undefined) {
      world.bus.emit({
        type: 'viewed',
        id: currentId,
        at: now().toISOString(),
      });
    }

    if (round.index + 1 < round.queue.length) {
      round.index += 1;
      return 'advanced';
    }

    const totalPasses = Math.max(1, round.config.passes);
    if (round.pass < totalPasses) {
      round.pass += 1;
      round.queue = shuffle(round.queue, rng);
      round.index = 0;
      return 'advanced';
    }

    round.finished = true;
    world.lastRound = round;
    world.round = null;

    world.bus.emit({
      type: 'roundFinished',
      results: [],
      at: now().toISOString(),
    });

    return 'finished';
  }

  if (round.pick === null) {
    return 'noop';
  }

  if (round.index + 1 < round.queue.length) {
    round.index += 1;
    round.pick = null;
    return 'advanced';
  }

  round.finished = true;
  world.lastRound = round;
  world.round = null;

  world.bus.emit({
    type: 'roundFinished',
    results: [...round.results],
    at: now().toISOString(),
  });

  return 'finished';
}

/** 中途結束回合或模擬考交卷；看答案模式或一題都沒答直接丟棄不發事件，模擬考交卷時才依序結算並發 examFinished。 */
export function quitRound(
  world: World,
  now: () => Date,
): RoundStepOutcome {
  const round = world.round;
  if (!round) {
    return 'noop';
  }

  if (round.config.exam) {
    const examPicks = round.examPicks ?? {};
    const at = now().toISOString();
    const results: RoundResult[] = [];

    for (const questionId of round.queue) {
      const pick = examPicks[questionId];
      if (!pick) continue;
      const question = world.questions.get(questionId);
      if (!question) continue;
      const correct = question.answer.includes(pick);
      results.push({ id: questionId, pick, correct });
    }

    if (results.length === 0) {
      world.round = null;
      return 'discarded';
    }

    for (const res of results) {
      round.results.push(res);
      world.bus.emit({
        type: 'answered',
        id: res.id,
        pick: res.pick,
        correct: res.correct,
        at,
      });
    }

    const finishedRound: RoundState = {
      ...round,
      queue: [...round.queue],
      results: [...results],
      examPicks: { ...examPicks },
      finished: true,
    };

    world.lastRound = finishedRound;
    world.round = null;

    world.bus.emit({
      type: 'roundFinished',
      results: [...results],
      at,
    });

    const total = finishedRound.queue.length;
    const correct = results.filter((r) => r.correct).length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    world.bus.emit({
      type: 'examFinished',
      record: {
        paperId: round.config.exam.paperId,
        at,
        total,
        answered: results.length,
        correct,
        score,
      },
    });

    return 'finished';
  }

  if (round.config.study === 'read' || round.results.length === 0) {
    world.round = null;
    return 'discarded';
  }

  const finishedRound: RoundState = {
    ...round,
    queue: round.results.map((r) => r.id),
    finished: true,
  };

  world.lastRound = finishedRound;
  world.round = null;

  world.bus.emit({
    type: 'roundFinished',
    results: [...finishedRound.results],
    at: now().toISOString(),
  });

  return 'finished';
}

/** 用上一回合（lastRound）答錯的題目開新回合，沿用原設定（不帶模擬考）且 count 為錯題數。 */
export function retryWrong(world: World, rng: () => number = Math.random): void {
  const lastRound = world.lastRound;
  if (!lastRound) {
    return;
  }

  const wrongIds = lastRound.results
    .filter((result) => !result.correct)
    .map((result) => result.id);

  if (wrongIds.length === 0) {
    return;
  }

  const { exam: _ignoredExam, topicIds: _ignoredTopicIds, ...restConfig } = lastRound.config;
  const config: RoundConfig = {
    ...restConfig,
    subjectKeys: [...lastRound.config.subjectKeys],
    count: wrongIds.length,
  };

  const shouldShuffleOptions = world.settings.shuffleOptions === true;

  world.savedRound = null;
  world.round = {
    config,
    queue: wrongIds,
    index: 0,
    pick: null,
    results: [],
    combo: 0,
    finished: false,
    pass: 1,
    ...(shouldShuffleOptions ? { optionOrder: buildOptionOrders(wrongIds, rng) } : {}),
  };

  world.bus.emit({
    type: 'roundStarted',
    config,
    queue: [...wrongIds],
  });
}

/** 用上一回合（lastRound）同一批題目開一個作答（quiz）新回合，去除重複並重新洗牌（不帶模擬考）。 */
export function quizSameSet(world: World, rng: () => number = Math.random): void {
  const lastRound = world.lastRound;
  if (!lastRound) {
    return;
  }

  const uniqueIds = [...new Set(lastRound.queue)].filter((id) => world.questions.has(id));
  if (uniqueIds.length === 0) {
    return;
  }

  const queue = shuffle(uniqueIds, rng);
  const { exam: _ignoredExam, topicIds: _ignoredTopicIds, ...restConfig } = lastRound.config;
  const config: RoundConfig = {
    ...restConfig,
    subjectKeys: [...lastRound.config.subjectKeys],
    study: 'quiz',
  };

  const shouldShuffleOptions = world.settings.shuffleOptions === true;

  world.savedRound = null;
  world.round = {
    config,
    queue,
    index: 0,
    pick: null,
    results: [],
    combo: 0,
    finished: false,
    pass: 1,
    ...(shouldShuffleOptions ? { optionOrder: buildOptionOrders(queue, rng) } : {}),
  };

  world.bus.emit({
    type: 'roundStarted',
    config,
    queue: [...queue],
  });
}

/** 將暫存於 savedRound 的未完成回合恢復為進行中回合並發出 roundRestored。 */
export function resumeRound(world: World): boolean {
  const saved = world.savedRound;
  if (!saved) {
    return false;
  }
  if (world.questions.size > 0 && validateSavedRound(world)) {
    return false;
  }

  world.round = {
    ...saved,
    config: {
      ...saved.config,
      subjectKeys: [...saved.config.subjectKeys],
      ...(saved.config.exam ? { exam: { ...saved.config.exam } } : {}),
    },
    queue: [...saved.queue],
    results: saved.results.map((r) => ({ ...r })),
    ...(saved.optionOrder
      ? {
          optionOrder: Object.fromEntries(
            Object.entries(saved.optionOrder).map(([id, order]) => [id, [...order]]),
          ),
        }
      : {}),
    ...(saved.examPicks
      ? { examPicks: { ...saved.examPicks } }
      : saved.config.exam
        ? { examPicks: {} }
        : {}),
  };
  world.savedRound = null;
  world.bus.emit({ type: 'roundRestored' });
  return true;
}

/** 丟棄暫存的未完成回合。 */
export function discardSavedRound(world: World): boolean {
  if (!world.savedRound) {
    return false;
  }
  world.savedRound = null;
  return true;
}
