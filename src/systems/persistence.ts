import { STORAGE_KEY } from '../core/constants/round';
import { READ_PASSES_DEFAULT } from '../core/constants/study';
import type {
  AskFilter,
  Choice,
  Progress,
  QuestionId,
  RoundConfig,
  Settings,
  StudyMode,
} from '../core/types';
import type { World } from '../core/world';

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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

interface RawSettings extends Omit<Settings, 'lastRound'> {
  lastRound: RawRoundConfig | null;
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
  return true;
}

function isValidSettings(value: unknown): value is RawSettings {
  if (!isRecord(value)) return false;
  if (value.theme !== 'system' && value.theme !== 'light' && value.theme !== 'dark') return false;
  if (value.lastRound !== null && !isValidRoundConfig(value.lastRound)) return false;
  if (value.installHintDismissed !== undefined && typeof value.installHintDismissed !== 'boolean') {
    return false;
  }
  return true;
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
    cleanSettings = {
      theme: parsed.settings.theme,
      lastRound: parsed.settings.lastRound
        ? {
            ...parsed.settings.lastRound,
            subjectKeys: [...parsed.settings.lastRound.subjectKeys],
            study: parsed.settings.lastRound.study ?? 'quiz',
            ask: parsed.settings.lastRound.ask ?? 'positive',
            passes: parsed.settings.lastRound.passes ?? READ_PASSES_DEFAULT,
          }
        : null,
      installHintDismissed: parsed.settings.installHintDismissed === true,
    };
  }

  return {
    ok: true,
    data: {
      version: 1,
      progress: cleanProgress,
      ...(cleanSettings ? { settings: cleanSettings } : {}),
    },
  };
}

function serializeWorld(world: World): string {
  const payload: PersistedPayload = {
    version: 1,
    progress: Object.fromEntries(world.progress),
    settings: world.settings,
  };
  return JSON.stringify(payload);
}

/** 啟動時從 storage 讀回 progress 與 settings（壞資料不丟例外），並訂閱異動自動寫回。 */
export function attachPersistence(world: World, storage: StorageLike): () => void {
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
        if (parsed.data.settings) {
          world.settings = parsed.data.settings;
        }
        if (restoredIds.length > 0) {
          world.bus.emit({ type: 'progressChanged', ids: restoredIds });
        }
        if (parsed.data.settings) {
          world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
        }
      }
    }
  } catch {
    // 讀檔失敗或資料損毀時當作無存檔，不丟例外
  }

  const writeBack = () => {
    try {
      storage.setItem(STORAGE_KEY, serializeWorld(world));
    } catch {
      // 忽略寫入失敗（例如空間已滿）
    }
  };

  const unsubProgress = world.bus.on('progressChanged', writeBack);
  const unsubSettings = world.bus.on('settingsChanged', writeBack);

  return () => {
    unsubProgress();
    unsubSettings();
  };
}

/** 將目前進度與設定序列化為 JSON 字串。 */
export function exportProgress(world: World): string {
  return serializeWorld(world);
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

  if (parsed.data.settings) {
    world.settings = parsed.data.settings;
  }

  world.bus.emit({ type: 'progressChanged', ids: [...affectedIds] });
  if (parsed.data.settings) {
    world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
  }

  return { ok: true };
}

/** 清除所有作答進度並發出 progressChanged。 */
export function resetProgress(world: World): void {
  const ids = [...world.progress.keys()];
  world.progress.clear();
  world.bus.emit({ type: 'progressChanged', ids });
}
