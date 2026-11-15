import { attachRound } from '../systems/round';
import { attachScheduling } from '../systems/scheduling';
import { attachSettings } from '../systems/settings';
import { createBus, type Bus } from './bus';
import { initStore } from './store';
import type {
  Bank,
  Enrich,
  OfficialQuestion,
  Paper,
  PaperId,
  PassageGroup,
  Progress,
  QuestionId,
  RoundState,
  Settings,
  SyncState,
} from './types';

export interface World {
  banks: Bank[];
  papers: Map<PaperId, Paper>;
  questions: Map<QuestionId, OfficialQuestion>;
  groups: Map<string, PassageGroup>;
  enrich: Map<QuestionId, Enrich>;
  progress: Map<QuestionId, Progress>;
  round: RoundState | null;
  savedRound: RoundState | null;
  lastRound: RoundState | null;
  settings: Settings;
  sync: SyncState;
  bus: Bus;
}

/** 建立空白 World 並掛載核心系統監聽器與版本訂閱層。 */
export function createWorld(): World {
  const world: World = {
    banks: [],
    papers: new Map(),
    questions: new Map(),
    groups: new Map(),
    enrich: new Map(),
    progress: new Map(),
    round: null,
    savedRound: null,
    lastRound: null,
    settings: {
      theme: 'system',
      lastRound: null,
    },
    sync: {
      status: 'off',
      lastSyncedAt: null,
      error: null,
    },
    bus: createBus(),
  };

  attachScheduling(world);
  attachSettings(world);
  attachRound(world);
  initStore(world);

  return world;
}
