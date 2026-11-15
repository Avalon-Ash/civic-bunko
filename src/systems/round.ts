import type { Choice, RoundConfig, RoundState } from '../core/types';
import type { World } from '../core/world';
import { buildQueue, shuffle } from './selection';

export type RoundStepOutcome = 'noop' | 'advanced' | 'finished' | 'discarded';

/** 依設定組題並開始新回合；若沒有符合條件的題目則不開啟回合。 */
export function startRound(
  world: World,
  config: RoundConfig,
  now: () => Date,
  rng: () => number,
): void {
  const queue = buildQueue(world, config, now(), rng);
  if (queue.length === 0) {
    return;
  }

  const normalizedConfig: RoundConfig = {
    ...config,
    subjectKeys: [...config.subjectKeys],
    passes: Math.max(1, Math.floor(config.passes)),
  };

  world.round = {
    config: normalizedConfig,
    queue,
    index: 0,
    pick: null,
    results: [],
    combo: 0,
    finished: false,
    pass: 1,
  };

  world.bus.emit({
    type: 'roundStarted',
    config: normalizedConfig,
    queue: [...queue],
  });
}

/** 作答目前題目；看答案模式不接受作答，同一題只能作答一次。 */
export function answerQuestion(
  world: World,
  pick: Choice,
  now: () => Date,
): void {
  const round = world.round;
  if (!round || round.finished || round.config.study === 'read' || round.pick !== null) {
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

/** 前進下一題；作答模式未作答時不動，看答案模式會發 viewed 並在多遍間重新洗牌。 */
export function nextQuestion(
  world: World,
  now: () => Date,
  rng: () => number = Math.random,
): RoundStepOutcome {
  const round = world.round;
  if (!round || round.finished) {
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

/** 中途結束回合；看答案模式或一題都沒答直接丟棄不發事件，否則保留已作答結果結束。 */
export function quitRound(
  world: World,
  now: () => Date,
): RoundStepOutcome {
  const round = world.round;
  if (!round) {
    return 'noop';
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

/** 用上一回合（lastRound）答錯的題目開新回合，沿用原設定且 count 為錯題數。 */
export function retryWrong(world: World): void {
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

  const config: RoundConfig = {
    ...lastRound.config,
    subjectKeys: [...lastRound.config.subjectKeys],
    count: wrongIds.length,
  };

  world.round = {
    config,
    queue: wrongIds,
    index: 0,
    pick: null,
    results: [],
    combo: 0,
    finished: false,
    pass: 1,
  };

  world.bus.emit({
    type: 'roundStarted',
    config,
    queue: [...wrongIds],
  });
}

/** 用上一回合（lastRound）同一批題目開一個作答（quiz）新回合，去除重複並重新洗牌。 */
export function quizSameSet(world: World, rng: () => number): void {
  const lastRound = world.lastRound;
  if (!lastRound) {
    return;
  }

  const uniqueIds = [...new Set(lastRound.queue)].filter((id) => world.questions.has(id));
  if (uniqueIds.length === 0) {
    return;
  }

  const queue = shuffle(uniqueIds, rng);
  const config: RoundConfig = {
    ...lastRound.config,
    subjectKeys: [...lastRound.config.subjectKeys],
    study: 'quiz',
  };

  world.round = {
    config,
    queue,
    index: 0,
    pick: null,
    results: [],
    combo: 0,
    finished: false,
    pass: 1,
  };

  world.bus.emit({
    type: 'roundStarted',
    config,
    queue: [...queue],
  });
}
