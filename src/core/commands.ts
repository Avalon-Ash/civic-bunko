import { importProgress, resetProgress } from '../systems/persistence';
import {
  answerQuestion,
  discardSavedRound,
  examGoto,
  examPick,
  nextQuestion,
  quitRound,
  quizSameSet,
  resumeRound,
  retryWrong,
  startRound,
} from '../systems/round';
import {
  dismissInstallHint,
  markCardSeen,
  markChangelogSeen,
  setAccessory,
  setBilingual,
  setCatName,
  setShuffleOptions,
  setSound,
  setWeather,
  setTheme,
} from '../systems/settings';
import { disableSync, setSyncCode, syncNow } from '../systems/sync';
import { buyItem, dismissCelebrations, repairScorch, scorchSpot, wear } from '../systems/wardrobe';
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
    case 'examPick':
      if (examPick(world, cmd.pick)) {
        bumpStore(world);
      }
      break;
    case 'examGoto':
      if (examGoto(world, cmd.index)) {
        bumpStore(world);
      }
      break;
    case 'resumeRound': {
      if (resumeRound(world)) {
        bumpStore(world);
      }
      break;
    }
    case 'discardSavedRound': {
      if (discardSavedRound(world)) {
        bumpStore(world);
      }
      break;
    }
    case 'retryWrong':
      retryWrong(world, rng);
      break;
    case 'quizSameSet':
      quizSameSet(world, rng);
      break;
    case 'setTheme':
      setTheme(world, cmd.theme);
      break;
    case 'setAccessory':
      setAccessory(world, cmd.accessory);
      break;
    case 'dismissInstallHint':
      dismissInstallHint(world);
      break;
    case 'setShuffleOptions':
      setShuffleOptions(world, cmd.on);
      break;
    case 'setSound':
      setSound(world, cmd.on);
      break;
    case 'setWeather':
      setWeather(world, cmd.on);
      break;
    case 'markChangelogSeen':
      markChangelogSeen(world, cmd.id);
      break;
    case 'setCatName':
      setCatName(world, cmd.name, now);
      break;
    case 'setBilingual':
      setBilingual(world, cmd.on);
      break;
    case 'markCardSeen':
      markCardSeen(world, cmd.id, now);
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
    case 'setSyncCode':
      setSyncCode(world, cmd.code);
      break;
    case 'syncNow':
      syncNow(world);
      break;
    case 'disableSync':
      disableSync(world);
      break;
    case 'buyItem':
      buyItem(world, cmd.id, now);
      break;
    case 'wear':
      wear(world, cmd.slot, cmd.item);
      break;
    case 'scorch':
      scorchSpot(world, cmd.spot);
      break;
    case 'repairScorch':
      repairScorch(world, cmd.spot);
      break;
    case 'dismissCelebrations':
      dismissCelebrations(world);
      break;
  }
}
