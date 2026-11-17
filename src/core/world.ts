import { attachDaily } from '../systems/daily';
import { attachRound } from '../systems/round';
import { attachScheduling } from '../systems/scheduling';
import { attachSettings } from '../systems/settings';
import { createBus, type Bus } from './bus';
import { initStore } from './store';
import type {
  Bank,
  Celebration,
  DayKey,
  Enrich,
  OfficialQuestion,
  Paper,
  PaperId,
  PassageGroup,
  Progress,
  QuestionId,
  RoundState,
  Settings,
  StudyCard,
  SyncState,
  TopicInfo,
  GroupZh,
  QuestionZh,
} from './types';

export interface World {
  banks: Bank[];
  papers: Map<PaperId, Paper>;
  questions: Map<QuestionId, OfficialQuestion>;
  groups: Map<string, PassageGroup>;
  enrich: Map<QuestionId, Enrich>;
  /** data/packs/<packId>/topics.json 的考點清單（bankLoader 載入） */
  topics: TopicInfo[];
  /** 英文題中譯，以題目 ID 為鍵（zhLoader 載入） */
  zh: Map<QuestionId, QuestionZh>;
  /** 英文題組逐句對照，以題組 ID 為鍵 */
  groupZh: Map<string, GroupZh>;
  cards: StudyCard[];
  progress: Map<QuestionId, Progress>;
  dayLog: Map<DayKey, number>;
  round: RoundState | null;
  savedRound: RoundState | null;
  lastRound: RoundState | null;
  settings: Settings;
  sync: SyncState;
  /** 衣櫥系統新給的獎勵，畫面放完慶祝後清掉（不存檔） */
  celebrations: Celebration[];
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
    topics: [],
    zh: new Map(),
    groupZh: new Map(),
    cards: [],
    progress: new Map(),
    dayLog: new Map(),
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
    celebrations: [],
    bus: createBus(),
  };

  attachScheduling(world);
  attachDaily(world);
  attachSettings(world);
  attachRound(world);
  initStore(world);

  return world;
}
