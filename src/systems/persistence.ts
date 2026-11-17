import { ACCESSORIES } from '../core/constants/daily';
import { EXAM_HISTORY_MAX } from '../core/constants/exam';
import { STORAGE_KEY } from '../core/constants/round';
import { READ_PASSES_DEFAULT } from '../core/constants/study';
import { SLOTS } from '../core/constants/wardrobe';
import { bumpStore, subscribe } from '../core/store';
import type {
  AskFilter,
  Choice,
  DayKey,
  ExamRecord,
  Outfit,
  Progress,
  QuestId,
  QuestionId,
  RoundConfig,
  RoundResult,
  RoundState,
  Settings,
  SlotId,
  StudyMode,
  WardrobeState,
} from '../core/types';
import type { World } from '../core/world';
import {
  backfillDayLogFromProgress,
  clearBackfillMark,
  isValidDayKey,
  parseDaysRecord,
} from './daily';
import { validateSavedRound } from './round';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ImportResult =
  | { ok: true }
  | { ok: false; error: string };

interface PersistedPayload {
  version: 1;
  progress: Record<QuestionId, Progress>;
  settings?: Settings;
  round?: RoundState;
  days?: Record<DayKey, number>;
}

const ACCESSORY_ID_SET = new Set<string>(ACCESSORIES.map((a) => a.id));
const SLOT_ID_SET = new Set<string>(SLOTS.map((s) => s.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isChoice(value: unknown): value is Choice {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

interface RawProgress extends Omit<Progress, 'views'> {
  views?: number;
}

interface RawRoundConfig extends Omit<RoundConfig, 'study' | 'ask' | 'passes'> {
  study?: StudyMode;
  ask?: AskFilter;
  passes?: number;
}

interface RawSettings
  extends Omit<Settings, 'lastRound' | 'examHistory' | 'bilingual' | 'wardrobe' | 'sound' | 'changelogSeen'> {
  lastRound: RawRoundConfig | null;
  examHistory?: unknown;
  bilingual?: unknown;
  sound?: unknown;
  changelogSeen?: unknown;
  wardrobe?: unknown;
}

function isValidProgress(value: unknown): value is RawProgress {
  if (!isRecord(value)) return false;
  if (typeof value.seen !== 'number' || !Number.isInteger(value.seen) || value.seen < 0) return false;
  if (
    typeof value.correct !== 'number' ||
    !Number.isInteger(value.correct) ||
    value.correct < 0 ||
    value.correct > value.seen
  ) {
    return false;
  }
  if (
    value.views !== undefined &&
    (typeof value.views !== 'number' || !Number.isInteger(value.views) || value.views < 0)
  ) {
    return false;
  }
  if (typeof value.streak !== 'number' || !Number.isInteger(value.streak) || value.streak < 0) {
    return false;
  }
  if (value.lastPick !== null && !isChoice(value.lastPick)) return false;
  if (typeof value.lastAt !== 'string') return false;
  if (value.due !== null && typeof value.due !== 'string') return false;
  return true;
}

function isValidExamConfig(value: unknown): value is { paperId: string; minutes: number } {
  if (!isRecord(value)) return false;
  if (typeof value.paperId !== 'string' || value.paperId.length === 0) return false;
  if (typeof value.minutes !== 'number' || !Number.isFinite(value.minutes) || value.minutes <= 0) {
    return false;
  }
  return true;
}

function isValidRoundConfig(value: unknown): value is RawRoundConfig {
  if (!isRecord(value)) return false;
  if (typeof value.bankId !== 'string') return false;
  if (!Array.isArray(value.subjectKeys) || !value.subjectKeys.every((k) => typeof k === 'string')) {
    return false;
  }
  if (typeof value.count !== 'number' || !Number.isFinite(value.count) || value.count <= 0) {
    return false;
  }
  if (
    value.mode !== 'mixed' &&
    value.mode !== 'new' &&
    value.mode !== 'wrong' &&
    value.mode !== 'due'
  ) {
    return false;
  }
  if (typeof value.fast !== 'boolean') return false;
  if (value.study !== undefined && value.study !== 'quiz' && value.study !== 'read') {
    return false;
  }
  if (
    value.ask !== undefined &&
    value.ask !== 'positive' &&
    value.ask !== 'negative' &&
    value.ask !== 'all'
  ) {
    return false;
  }
  if (
    value.passes !== undefined &&
    (typeof value.passes !== 'number' || !Number.isInteger(value.passes) || value.passes < 1)
  ) {
    return false;
  }
  if (value.exam !== undefined && value.exam !== null && !isValidExamConfig(value.exam)) {
    return false;
  }
  if (
    value.topicIds !== undefined &&
    (!Array.isArray(value.topicIds) || !value.topicIds.every((id) => typeof id === 'string'))
  ) {
    return false;
  }
  return true;
}

function isValidSettings(value: unknown): value is RawSettings {
  if (!isRecord(value)) return false;
  if (value.theme !== 'system' && value.theme !== 'light' && value.theme !== 'dark') return false;
  if (value.lastRound !== null && !isValidRoundConfig(value.lastRound)) return false;
  if (value.installHintDismissed !== undefined && typeof value.installHintDismissed !== 'boolean') {
    return false;
  }
  if (
    value.accessory !== undefined &&
    value.accessory !== null &&
    (typeof value.accessory !== 'string' || !ACCESSORY_ID_SET.has(value.accessory))
  ) {
    return false;
  }
  if (value.shuffleOptions !== undefined && typeof value.shuffleOptions !== 'boolean') return false;
  if (
    value.cardsSeen !== undefined &&
    !(Array.isArray(value.cardsSeen) && value.cardsSeen.every((id) => typeof id === 'string'))
  ) {
    return false;
  }
  return true;
}

function normalizeRoundConfig(raw: RawRoundConfig, keepTopicIds = true): RoundConfig {
  const { topicIds, ...rest } = raw;
  return {
    ...rest,
    subjectKeys: [...raw.subjectKeys],
    study: raw.study ?? 'quiz',
    ask: raw.ask ?? 'positive',
    passes: raw.passes ?? READ_PASSES_DEFAULT,
    ...(raw.exam !== undefined
      ? { exam: raw.exam ? { paperId: raw.exam.paperId, minutes: raw.exam.minutes } : null }
      : {}),
    ...(keepTopicIds && topicIds !== undefined ? { topicIds: [...topicIds] } : {}),
  };
}

function isValidRoundResult(value: unknown): value is RoundResult {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && isChoice(value.pick) && typeof value.correct === 'boolean';
}

function isValidStartedAt(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function parseOptionOrder(value: unknown): Record<QuestionId, Choice[]> | undefined {
  if (!isRecord(value)) return undefined;
  const clean: Record<QuestionId, Choice[]> = {};
  for (const [id, order] of Object.entries(value)) {
    if (!Array.isArray(order) || order.length !== 4 || !order.every(isChoice)) {
      return undefined;
    }
    if (new Set(order).size !== 4) {
      return undefined;
    }
    clean[id] = [...order];
  }
  return clean;
}

function parseExamPicks(
  value: unknown,
  queue: readonly QuestionId[],
): Record<QuestionId, Choice> | undefined {
  if (!isRecord(value)) return undefined;
  const queueSet = new Set(queue);
  const clean: Record<QuestionId, Choice> = {};
  for (const [id, pick] of Object.entries(value)) {
    if (!queueSet.has(id) || !isChoice(pick)) {
      return undefined;
    }
    clean[id] = pick;
  }
  return clean;
}

function parseExamRecord(value: unknown): ExamRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.paperId !== 'string' || value.paperId.length === 0) return null;
  if (!isValidStartedAt(value.at)) return null;
  if (typeof value.total !== 'number' || !Number.isInteger(value.total) || value.total <= 0) {
    return null;
  }
  if (
    typeof value.answered !== 'number' ||
    !Number.isInteger(value.answered) ||
    value.answered < 0 ||
    value.answered > value.total
  ) {
    return null;
  }
  if (
    typeof value.correct !== 'number' ||
    !Number.isInteger(value.correct) ||
    value.correct < 0 ||
    value.correct > value.answered
  ) {
    return null;
  }
  if (
    typeof value.score !== 'number' ||
    !Number.isInteger(value.score) ||
    value.score < 0 ||
    value.score > 100
  ) {
    return null;
  }
  return {
    paperId: value.paperId,
    at: value.at,
    total: value.total,
    answered: value.answered,
    correct: value.correct,
    score: value.score,
  };
}

/** 解析模擬考歷次成績；不是陣列回傳 undefined，壞掉的單筆略過，超過上限只留最後幾筆。 */
export function parseExamHistory(value: unknown): ExamRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const valid: ExamRecord[] = [];
  for (const entry of value) {
    const parsed = parseExamRecord(entry);
    if (parsed) {
      valid.push(parsed);
    }
  }
  if (valid.length > EXAM_HISTORY_MAX) {
    return valid.slice(valid.length - EXAM_HISTORY_MAX);
  }
  return valid;
}

/** 解析並正規化衣櫥狀態；不是物件回傳 undefined，壞掉的子欄位只丟那一小項。 */
export function parseWardrobe(value: unknown): WardrobeState | undefined {
  if (!isRecord(value)) return undefined;

  const owned = isStringArray(value.owned) ? [...value.owned] : [];
  const achievements = isStringArray(value.achievements) ? [...value.achievements] : [];

  const quests: Record<DayKey, QuestId[]> = {};
  if (isRecord(value.quests)) {
    for (const [day, ids] of Object.entries(value.quests)) {
      if (isValidDayKey(day) && isStringArray(ids)) {
        quests[day] = [...ids];
      }
    }
  }

  let outfit: Outfit | undefined;
  if (isRecord(value.outfit)) {
    const cleanOutfit: Outfit = {};
    for (const [slot, itemId] of Object.entries(value.outfit)) {
      if (SLOT_ID_SET.has(slot) && typeof itemId === 'string') {
        cleanOutfit[slot as SlotId] = itemId;
      }
    }
    outfit = cleanOutfit;
  }

  return {
    owned,
    achievements,
    quests,
    ...(outfit !== undefined ? { outfit } : {}),
  };
}

function parseRoundState(value: unknown): RoundState | undefined {
  if (!isRecord(value)) return undefined;
  if (!isValidRoundConfig(value.config)) return undefined;
  if (!Array.isArray(value.queue) || value.queue.length === 0 || !value.queue.every((id) => typeof id === 'string')) {
    return undefined;
  }
  if (
    typeof value.index !== 'number' ||
    !Number.isInteger(value.index) ||
    value.index < 0 ||
    value.index >= value.queue.length
  ) {
    return undefined;
  }
  if (value.pick !== null && !isChoice(value.pick)) return undefined;
  if (!Array.isArray(value.results) || !value.results.every(isValidRoundResult)) return undefined;
  if (typeof value.combo !== 'number' || !Number.isInteger(value.combo) || value.combo < 0) return undefined;
  if (typeof value.finished !== 'boolean' || value.finished) return undefined;
  if (typeof value.pass !== 'number' || !Number.isInteger(value.pass) || value.pass < 1) return undefined;

  const config = normalizeRoundConfig(value.config);

  if (config.exam && value.startedAt === undefined) {
    return undefined;
  }
  if (value.startedAt !== undefined && !isValidStartedAt(value.startedAt)) {
    return undefined;
  }

  let cleanOptionOrder: Record<QuestionId, Choice[]> | undefined;
  if (value.optionOrder !== undefined) {
    cleanOptionOrder = parseOptionOrder(value.optionOrder);
    if (!cleanOptionOrder) return undefined;
  }

  let cleanExamPicks: Record<QuestionId, Choice> | undefined;
  if (value.examPicks !== undefined) {
    cleanExamPicks = parseExamPicks(value.examPicks, value.queue);
    if (!cleanExamPicks) return undefined;
  }

  return {
    config,
    queue: [...value.queue],
    index: value.index,
    pick: value.pick,
    results: value.results.map((r) => ({ id: r.id, pick: r.pick, correct: r.correct })),
    combo: value.combo,
    finished: false,
    pass: value.pass,
    ...(value.startedAt !== undefined ? { startedAt: value.startedAt } : {}),
    ...(cleanOptionOrder ? { optionOrder: cleanOptionOrder } : {}),
    ...(cleanExamPicks ? { examPicks: cleanExamPicks } : config.exam ? { examPicks: {} } : {}),
  };
}

/** 驗證並正規化單筆作答進度（補齊舊版缺少的 views 欄位）；不合法時回傳 null。 */
export function parseProgressEntry(value: unknown): Progress | null {
  if (!isValidProgress(value)) {
    return null;
  }
  return {
    ...value,
    views: value.views ?? 0,
  };
}

function parsePayload(raw: string): { ok: true; data: PersistedPayload } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Payload must be an object' };
  }
  if (parsed.version !== 1) {
    return { ok: false, error: 'Unsupported backup version' };
  }
  if (!isRecord(parsed.progress)) {
    return { ok: false, error: 'Missing or invalid progress object' };
  }

  const cleanProgress: Record<QuestionId, Progress> = {};
  for (const [id, entry] of Object.entries(parsed.progress)) {
    const normalized = parseProgressEntry(entry);
    if (!normalized) {
      return { ok: false, error: `Invalid progress entry for ${id}` };
    }
    cleanProgress[id] = normalized;
  }

  let cleanSettings: Settings | undefined;
  if (parsed.settings !== undefined) {
    if (!isValidSettings(parsed.settings)) {
      return { ok: false, error: 'Invalid settings object' };
    }
    const cleanExamHistory =
      parsed.settings.examHistory !== undefined
        ? parseExamHistory(parsed.settings.examHistory)
        : undefined;
    const cleanWardrobe =
      parsed.settings.wardrobe !== undefined
        ? parseWardrobe(parsed.settings.wardrobe)
        : undefined;
    cleanSettings = {
      theme: parsed.settings.theme,
      lastRound: parsed.settings.lastRound
        ? normalizeRoundConfig(parsed.settings.lastRound, false)
        : null,
      installHintDismissed: parsed.settings.installHintDismissed === true,
      ...(parsed.settings.accessory !== undefined ? { accessory: parsed.settings.accessory } : {}),
      ...(parsed.settings.shuffleOptions !== undefined ? { shuffleOptions: parsed.settings.shuffleOptions } : {}),
      ...(parsed.settings.cardsSeen !== undefined ? { cardsSeen: [...parsed.settings.cardsSeen] } : {}),
      ...(typeof parsed.settings.bilingual === 'boolean' ? { bilingual: parsed.settings.bilingual } : {}),
      ...(typeof parsed.settings.sound === 'boolean' ? { sound: parsed.settings.sound } : {}),
      ...(typeof parsed.settings.changelogSeen === 'string'
        ? { changelogSeen: parsed.settings.changelogSeen }
        : {}),
      ...(cleanExamHistory !== undefined ? { examHistory: cleanExamHistory } : {}),
      ...(cleanWardrobe !== undefined ? { wardrobe: cleanWardrobe } : {}),
    };
  }

  let cleanDays: Record<DayKey, number> | undefined;
  if (parsed.days !== undefined) {
    const daysMap = parseDaysRecord(parsed.days);
    if (!daysMap) {
      return { ok: false, error: 'Invalid days object' };
    }
    cleanDays = Object.fromEntries(daysMap);
  }

  const cleanRound = parsed.round !== undefined ? parseRoundState(parsed.round) : undefined;

  return {
    ok: true,
    data: {
      version: 1,
      progress: cleanProgress,
      ...(cleanSettings ? { settings: cleanSettings } : {}),
      ...(cleanRound ? { round: cleanRound } : {}),
      ...(cleanDays ? { days: cleanDays } : {}),
    },
  };
}

function serializeWorld(world: World, includeRound: boolean): string {
  const roundToSave = includeRound
    ? world.round && !world.round.finished
      ? world.round
      : world.savedRound && !world.savedRound.finished
        ? world.savedRound
        : undefined
    : undefined;

  const payload: PersistedPayload = {
    version: 1,
    progress: Object.fromEntries(world.progress),
    settings: world.settings,
    days: Object.fromEntries(world.dayLog),
    ...(roundToSave ? { round: roundToSave } : {}),
  };
  return JSON.stringify(payload);
}

/** 啟動時從 storage 讀回 progress、days、settings 與待續接回合（壞資料不丟例外），並訂閱異動自動寫回。 */
export function attachPersistence(world: World, storage: StorageLike): () => void {
  let discardedOnLoad = false;
  let backfilledOnLoad = false;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = parsePayload(raw);
      if (parsed.ok) {
        const restoredIds = Object.keys(parsed.data.progress);
        world.progress.clear();
        for (const [id, entry] of Object.entries(parsed.data.progress)) {
          world.progress.set(id, entry);
        }
        world.dayLog.clear();
        if (parsed.data.days) {
          for (const [day, count] of Object.entries(parsed.data.days)) {
            world.dayLog.set(day, count);
          }
        } else if (world.progress.size > 0) {
          backfilledOnLoad = backfillDayLogFromProgress(world);
        }
        if (parsed.data.settings) {
          world.settings = parsed.data.settings;
        }
        if (parsed.data.round) {
          world.savedRound = parsed.data.round;
          discardedOnLoad = validateSavedRound(world);
        }
        if (restoredIds.length > 0) {
          world.bus.emit({ type: 'progressChanged', ids: restoredIds });
        }
        if (parsed.data.settings) {
          world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
        }
        if (parsed.data.days || backfilledOnLoad) {
          bumpStore(world);
        }
      }
    }
  } catch {
    // 讀檔失敗或資料損毀時當作無存檔，不丟例外
  }

  let lastWritten: string | null = null;
  const writeBack = () => {
    const next = serializeWorld(world, true);
    if (next === lastWritten) return;
    try {
      storage.setItem(STORAGE_KEY, next);
      lastWritten = next;
    } catch {
      // 忽略寫入失敗（例如空間已滿）
    }
  };

  if (discardedOnLoad || backfilledOnLoad) {
    writeBack();
  }

  const unsubStore = subscribe(world, writeBack);
  const unsubRestored = world.bus.on('roundRestored', writeBack);

  return () => {
    unsubStore();
    unsubRestored();
  };
}

/** 將目前進度與設定序列化為 JSON 字串（不含進行中的回合）。 */
export function exportProgress(world: World): string {
  return serializeWorld(world, false);
}

/** 匯入進度 JSON；格式不對時不動現有資料並回傳失敗原因。 */
export function importProgress(world: World, json: string): ImportResult {
  const parsed = parsePayload(json);
  if (!parsed.ok) {
    return parsed;
  }

  const affectedIds = new Set<QuestionId>([
    ...world.progress.keys(),
    ...Object.keys(parsed.data.progress),
  ]);

  world.progress.clear();
  for (const [id, entry] of Object.entries(parsed.data.progress)) {
    world.progress.set(id, entry);
  }

  world.dayLog.clear();
  clearBackfillMark(world);
  if (parsed.data.days) {
    for (const [day, count] of Object.entries(parsed.data.days)) {
      world.dayLog.set(day, count);
    }
  } else if (world.progress.size > 0) {
    backfillDayLogFromProgress(world);
  }

  if (parsed.data.settings) {
    world.settings = parsed.data.settings;
  }

  world.bus.emit({ type: 'progressChanged', ids: [...affectedIds] });
  if (parsed.data.settings) {
    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
  }

  return { ok: true };
}

/** 清除所有作答進度與每日紀錄並發出 progressChanged。 */
export function resetProgress(world: World): void {
  const ids = [...world.progress.keys()];
  const hadDayLog = world.dayLog.size > 0;
  world.progress.clear();
  world.dayLog.clear();
  world.bus.emit({ type: 'progressChanged', ids });
  if (ids.length === 0 && hadDayLog) {
    bumpStore(world);
  }
}
