import { importProgress, resetProgress } from '../systems/persistence';
import {
  answerQuestion,
  nextQuestion,
  quitRound,
  quizSameSet,
  retryWrong,
  startRound,
} from '../systems/round';
import { dismissInstallHint, setTheme } from '../systems/settings';
import { bumpStore } from './store';
import type { UICommand } from './types';
import type { World } from './world';

export interface DispatchDeps {
  now?: () => Date;
  rng?: () => number;
}

const defaultNow = (): Date => new Date();
const defaultRng = (): number => Math.random();

/** 畫面寫入狀態的唯一入口；將 UICommand 分派給對應 System。 */
export function dispatch(world: World, cmd: UICommand, deps?: DispatchDeps): void {
  const now = deps?.now ?? defaultNow;
  const rng = deps?.rng ?? defaultRng;

  switch (cmd.type) {
    case 'startRound':
      startRound(world, cmd.config, now, rng);
      break;
    case 'answer':
      answerQuestion(world, cmd.pick, now);
      break;
    case 'next': {
      const outcome = nextQuestion(world, now, rng);
      if (outcome === 'advanced') {
        bumpStore(world);
      }
      break;
    }
    case 'quitRound': {
      const outcome = quitRound(world, now);
      if (outcome === 'discarded') {
        bumpStore(world);
      }
      break;
    }
    case 'retryWrong':
      retryWrong(world);
      break;
    case 'quizSameSet':
      quizSameSet(world, rng);
      break;
    case 'setTheme':
      setTheme(world, cmd.theme);
      break;
    case 'dismissInstallHint':
      dismissInstallHint(world);
      break;
    case 'importProgress': {
      const result = importProgress(world, cmd.json);
      if (!result.ok) {
        throw new Error(result.error);
      }
      break;
    }
    case 'resetProgress':
      resetProgress(world);
      break;
  }
}
