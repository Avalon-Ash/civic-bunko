import {
  SYNC_API_BASE,
  SYNC_FETCH_TIMEOUT_MS,
  SYNC_FILE_VERSION,
  SYNC_REMOTE_PATH,
  SYNC_STORAGE_KEY,
  SYNC_VISIBILITY_MIN_INTERVAL_MS,
} from '../core/constants/sync';
import { EXAM_HISTORY_MAX } from '../core/constants/exam';
import type {
  CatProfile,
  DayKey,
  ExamRecord,
  Progress,
  QuestionId,
  SyncCredentials,
  SyncState,
} from '../core/types';
import type { World } from '../core/world';
import { parseDaysRecord } from './daily';
import {
  parseExamHistory,
  parseProgressEntry,
  parseWardrobe,
  type StorageLike,
} from './persistence';
import { catProfileOf, parseCatProfile } from './catBrain';
import { applySyncedCatProfile, applySyncedSettings } from './settings';
import { base64ToUtf8, decodeSyncCode, utf8ToBase64, validateSyncCredentials } from './syncCode';
import {
  mergeCatProfile,
  mergeCardsSeen,
  mergeDays,
  mergeExamHistory,
  mergeProgress,
  mergeWardrobe,
  sameCatProfile,
  cleanRepairs,
  sameSaved,
  toSyncWardrobe,
  type SyncWardrobe,
} from './syncMerge';
import { applySyncedWardrobe } from './wardrobe';

export interface SyncStorageLike extends StorageLike {
  removeItem?(key: string): void;
}

export interface SyncDeps {
  fetch: typeof fetch;
  storage: SyncStorageLike;
  now: () => Date;
  /** 單一請求的逾時（毫秒）；沒給就用 SYNC_FETCH_TIMEOUT_MS。測試用來縮短等待 */
  fetchTimeoutMs?: number;
}

interface SyncController {
  world: World;
  deps: SyncDeps;
  credentials: SyncCredentials | null;
  inFlight: Promise<void> | null;
  pendingRerun: boolean;
  generation: number;
  disposed: boolean;
  /** 上一次因為前景／背景切換而觸發同步的時間（毫秒）；還沒有過是 null */
  lastVisibilitySyncAt: number | null;
}

interface RemoteContent {
  progress: Map<QuestionId, Progress>;
  days: Map<DayKey, number>;
  /** 看過的卡片；舊版同步檔沒有這欄，視為空 */
  cardsSeen: string[];
  /** 模擬考歷次成績；舊版同步檔沒有這欄，視為空 */
  examHistory: ExamRecord[];
  /** 衣櫥進度（不含 outfit）；舊版或損毀視為空 */
  wardrobe: SyncWardrobe;
  /** 小貓的個人設定（名字＋改動時間）；舊版同步檔沒有這欄，或格式不對，都是 null */
  cat: CatProfile | null;
}

type RemoteFetchResult =
  | { kind: 'missing' }
  | ({ kind: 'ok'; sha: string } & RemoteContent)
  | { kind: 'error'; message: string };

const MSG_INVALID_CODE = '同步碼格式不對';
const MSG_AUTH_ERROR = '同步碼失效或權限不足';
const MSG_REPO_NOT_FOUND = '找不到同步用的 repo';
const MSG_NETWORK_ERROR = '現在連不上網路，稍後會再試';
const MSG_DATA_ERROR = '同步資料格式不正確';
const MSG_GENERIC_ERROR = '同步失敗，請稍後再試';

const controllers = new WeakMap<World, SyncController>();

/**
 * 幫一個 Promise 加上逾時：時間到還沒結果就以錯誤結束，並中止底下的請求。
 * 請求如果永遠不回來（App 被系統暫停時會發生），沒有這層的話同步會永遠卡在「同步中」。
 */
async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new Error('sync request timed out'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([run(abort.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function setSyncState(world: World, next: SyncState): void {
  world.sync = next;
  world.bus.emit({
    type: 'syncChanged',
    sync: { ...next },
  });
}

function loadCredentials(storage: SyncStorageLike): SyncCredentials | null {
  try {
    const raw = storage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return validateSyncCredentials(parsed.owner, parsed.repo, parsed.token);
  } catch {
    return null;
  }
}

function saveCredentials(storage: SyncStorageLike, cred: SyncCredentials): void {
  try {
    storage.setItem(SYNC_STORAGE_KEY, JSON.stringify(cred));
  } catch {
    // 忽略寫入失敗（例如無痕模式或空間已滿）
  }
}

function clearCredentials(storage: SyncStorageLike): void {
  try {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(SYNC_STORAGE_KEY);
    } else {
      storage.setItem(SYNC_STORAGE_KEY, '');
    }
  } catch {
    // 忽略刪除失敗
  }
}

function buildRemoteUrl(cred: SyncCredentials): string {
  return `${SYNC_API_BASE}/repos/${encodeURIComponent(cred.owner)}/${encodeURIComponent(cred.repo)}/contents/${SYNC_REMOTE_PATH}`;
}

function buildHeaders(token: string, withJsonBody = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (withJsonBody) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function progressEquals(a: Progress, b: Progress): boolean {
  return (
    a.seen === b.seen &&
    a.correct === b.correct &&
    a.views === b.views &&
    a.streak === b.streak &&
    a.lastPick === b.lastPick &&
    a.lastAt === b.lastAt &&
    a.due === b.due
  );
}

function diffProgressIds(
  prev: ReadonlyMap<QuestionId, Progress>,
  next: ReadonlyMap<QuestionId, Progress>,
): QuestionId[] {
  const changed: QuestionId[] = [];
  for (const [id, nextEntry] of next) {
    const prevEntry = prev.get(id);
    if (!prevEntry || !progressEquals(prevEntry, nextEntry)) {
      changed.push(id);
    }
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) {
      changed.push(id);
    }
  }
  return changed;
}

function progressMapsEqual(
  a: ReadonlyMap<QuestionId, Progress>,
  b: ReadonlyMap<QuestionId, Progress>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, entryA] of a) {
    const entryB = b.get(id);
    if (!entryB || !progressEquals(entryA, entryB)) {
      return false;
    }
  }
  return true;
}

function diffDayLogs(
  prev: ReadonlyMap<DayKey, number>,
  next: ReadonlyMap<DayKey, number>,
): Array<{ day: DayKey; count: number }> {
  const changed: Array<{ day: DayKey; count: number }> = [];
  for (const [day, nextCount] of next) {
    if (prev.get(day) !== nextCount) {
      changed.push({ day, count: nextCount });
    }
  }
  for (const day of prev.keys()) {
    if (!next.has(day)) {
      changed.push({ day, count: 0 });
    }
  }
  return changed;
}

function dayMapsEqual(
  a: ReadonlyMap<DayKey, number>,
  b: ReadonlyMap<DayKey, number>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [day, countA] of a) {
    if (b.get(day) !== countA) {
      return false;
    }
  }
  return true;
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function emptyWardrobe(): SyncWardrobe {
  return toSyncWardrobe(undefined);
}

function stringSetDiffers(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return true;
  for (const item of setA) {
    if (!setB.has(item)) return true;
  }
  return false;
}

function wardrobeSetDiffers(a: SyncWardrobe, b: SyncWardrobe): boolean {
  if (stringSetDiffers(a.owned, b.owned)) return true;
  if (stringSetDiffers(a.achievements, b.achievements)) return true;
  const days = new Set<string>([...Object.keys(a.quests), ...Object.keys(b.quests)]);
  for (const day of days) {
    if (stringSetDiffers(a.quests[day] ?? [], b.quests[day] ?? [])) {
      return true;
    }
  }
  if (cleanRepairs(a.repairs) !== cleanRepairs(b.repairs)) return true;
  return !sameSaved(a.saved, b.saved);
}

function sameExamHistory(a: readonly ExamRecord[], b: readonly ExamRecord[]): boolean {
  return (
    a.length === b.length &&
    a.every((record, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        record.paperId === other.paperId &&
        record.at === other.at &&
        record.total === other.total &&
        record.answered === other.answered &&
        record.correct === other.correct &&
        record.score === other.score
      );
    })
  );
}

function parseRemoteContent(base64Content: string): RemoteContent | null {
  try {
    const jsonText = base64ToUtf8(base64Content);
    const parsed: unknown = JSON.parse(jsonText);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== SYNC_FILE_VERSION) return null;
    if (!isRecord(parsed.progress)) return null;

    const progress = new Map<QuestionId, Progress>();
    for (const [id, rawEntry] of Object.entries(parsed.progress)) {
      const normalized = parseProgressEntry(rawEntry);
      if (!normalized) return null;
      progress.set(id, normalized);
    }

    let days = new Map<DayKey, number>();
    if (parsed.days !== undefined) {
      const parsedDays = parseDaysRecord(parsed.days);
      if (!parsedDays) return null;
      days = parsedDays;
    }

    // 這幾欄是後來加的：缺欄或格式不對都當成空的，不讓整份同步失敗
    const cardsSeen =
      Array.isArray(parsed.cardsSeen) && parsed.cardsSeen.every((id) => typeof id === 'string')
        ? (parsed.cardsSeen as string[])
        : [];
    const examHistory = parseExamHistory(parsed.examHistory) ?? [];
    const parsedWardrobe = parseWardrobe(parsed.wardrobe);
    const wardrobe: SyncWardrobe = toSyncWardrobe(parsedWardrobe);

    return { progress, days, cardsSeen, examHistory, wardrobe, cat: parseCatProfile(parsed.cat) };
  } catch {
    return null;
  }
}

async function fetchRemoteFile(
  fetchFn: typeof fetch,
  cred: SyncCredentials,
  timeoutMs: number,
): Promise<RemoteFetchResult> {
  let response: Response;
  try {
    response = await withTimeout(
      (signal) =>
        fetchFn(buildRemoteUrl(cred), {
          method: 'GET',
          headers: buildHeaders(cred.token),
          cache: 'no-store',
          signal,
        }),
      timeoutMs,
    );
  } catch {
    return { kind: 'error', message: MSG_NETWORK_ERROR };
  }

  if (response.status === 404) {
    return { kind: 'missing' };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'error', message: MSG_AUTH_ERROR };
  }
  if (!response.ok) {
    return { kind: 'error', message: MSG_GENERIC_ERROR };
  }

  let body: unknown;
  try {
    body = await withTimeout(() => response.json() as Promise<unknown>, timeoutMs);
  } catch {
    return { kind: 'error', message: MSG_DATA_ERROR };
  }

  if (!isRecord(body) || typeof body.sha !== 'string' || body.sha.length === 0 || typeof body.content !== 'string') {
    return { kind: 'error', message: MSG_DATA_ERROR };
  }

  const parsed = parseRemoteContent(body.content);
  if (!parsed) {
    return { kind: 'error', message: MSG_DATA_ERROR };
  }

  return { kind: 'ok', sha: body.sha, ...parsed };
}

function isStale(controller: SyncController, gen: number): boolean {
  return controller.disposed || controller.generation !== gen || controller.credentials === null;
}

async function runSingleSync(controller: SyncController, gen: number): Promise<void> {
  const { world, deps } = controller;
  if (isStale(controller, gen)) return;

  setSyncState(world, {
    status: 'syncing',
    lastSyncedAt: world.sync.lastSyncedAt,
    error: null,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const cred = controller.credentials;
    if (isStale(controller, gen) || !cred) return;

    const timeoutMs = deps.fetchTimeoutMs ?? SYNC_FETCH_TIMEOUT_MS;
    const remote = await fetchRemoteFile(deps.fetch, cred, timeoutMs);
    if (isStale(controller, gen)) return;

    if (remote.kind === 'error') {
      setSyncState(world, {
        status: 'error',
        lastSyncedAt: world.sync.lastSyncedAt,
        error: remote.message,
      });
      return;
    }

    const remoteMap = remote.kind === 'ok' ? remote.progress : new Map<QuestionId, Progress>();
    const remoteDays = remote.kind === 'ok' ? remote.days : new Map<DayKey, number>();
    const remoteSha = remote.kind === 'ok' ? remote.sha : null;
    const remoteCards = remote.kind === 'ok' ? remote.cardsSeen : [];
    const remoteExams = remote.kind === 'ok' ? remote.examHistory : [];
    const remoteWardrobe = remote.kind === 'ok' ? remote.wardrobe : emptyWardrobe();

    const merged = mergeProgress(world.progress, remoteMap);
    const mergedDays = mergeDays(world.dayLog, remoteDays);

    const changedIds = diffProgressIds(world.progress, merged);
    if (changedIds.length > 0) {
      world.progress.clear();
      for (const [id, entry] of merged) {
        world.progress.set(id, entry);
      }
      world.bus.emit({ type: 'progressChanged', ids: changedIds });
      if (isStale(controller, gen)) return;
    }

    const changedDays = diffDayLogs(world.dayLog, mergedDays);
    if (changedDays.length > 0) {
      world.dayLog.clear();
      for (const [day, count] of mergedDays) {
        world.dayLog.set(day, count);
      }
      for (const { day, count } of changedDays) {
        world.bus.emit({ type: 'dayLogChanged', day, count });
        if (isStale(controller, gen)) return;
      }
    }

    const localCards = world.settings.cardsSeen ?? [];
    const localExams = world.settings.examHistory ?? [];
    const mergedCards = mergeCardsSeen(localCards, remoteCards);
    const mergedExams = mergeExamHistory(localExams, remoteExams, EXAM_HISTORY_MAX);
    if (!sameStrings(mergedCards, localCards) || !sameExamHistory(mergedExams, localExams)) {
      applySyncedSettings(world, mergedCards, mergedExams);
      if (isStale(controller, gen)) return;
    }

    const localWardrobe: SyncWardrobe = toSyncWardrobe(world.settings.wardrobe);
    const mergedWardrobe = mergeWardrobe(localWardrobe, remoteWardrobe);
    if (wardrobeSetDiffers(localWardrobe, mergedWardrobe)) {
      applySyncedWardrobe(world, mergedWardrobe);
      if (isStale(controller, gen)) return;
    }

    // 小貓的個人設定：兩邊比改動時間，較新的那包整包留下
    const remoteCat = remote.kind === 'ok' ? remote.cat : null;
    const localCat = catProfileOf(world.settings);
    const mergedCat = mergeCatProfile(localCat, remoteCat);
    if (mergedCat !== null && !sameCatProfile(localCat, mergedCat)) {
      applySyncedCatProfile(world, mergedCat);
      if (isStale(controller, gen)) return;
    }
    const catDiffers = !sameCatProfile(remoteCat, mergedCat);

    // 卡片已看、模擬考成績與衣櫥只比內容：遠端順序不同不必寫回
    const remoteCardSet = new Set(remoteCards);
    const cardsDiffer =
      mergedCards.length !== remoteCardSet.size || mergedCards.some((id) => !remoteCardSet.has(id));
    const examsDiffer = !sameExamHistory(
      mergedExams,
      mergeExamHistory([], remoteExams, EXAM_HISTORY_MAX),
    );
    const wardrobeDiffers = wardrobeSetDiffers(remoteWardrobe, mergedWardrobe);

    const shouldPut =
      remote.kind === 'missing' ||
      !progressMapsEqual(merged, remoteMap) ||
      !dayMapsEqual(mergedDays, remoteDays) ||
      cardsDiffer ||
      examsDiffer ||
      wardrobeDiffers ||
      catDiffers;
    if (!shouldPut) {
      setSyncState(world, {
        status: 'idle',
        lastSyncedAt: deps.now().toISOString(),
        error: null,
      });
      return;
    }

    const payloadJson = JSON.stringify({
      version: SYNC_FILE_VERSION,
      updatedAt: deps.now().toISOString(),
      progress: Object.fromEntries(merged),
      days: Object.fromEntries(mergedDays),
      cardsSeen: mergedCards,
      examHistory: mergedExams,
      wardrobe: mergedWardrobe,
      // 沒取過名字就不寫這一欄：沒用到這個功能的人，同步檔長得跟以前一樣
      ...(mergedCat !== null ? { cat: mergedCat } : {}),
    });
    const putBody: Record<string, unknown> = {
      message: 'chore: sync progress',
      content: utf8ToBase64(payloadJson),
    };
    if (remoteSha !== null) {
      putBody.sha = remoteSha;
    }

    let putResponse: Response;
    try {
      putResponse = await withTimeout(
        (signal) =>
          deps.fetch(buildRemoteUrl(cred), {
            method: 'PUT',
            headers: buildHeaders(cred.token, true),
            body: JSON.stringify(putBody),
            signal,
          }),
        timeoutMs,
      );
    } catch {
      if (isStale(controller, gen)) return;
      setSyncState(world, {
        status: 'error',
        lastSyncedAt: world.sync.lastSyncedAt,
        error: MSG_NETWORK_ERROR,
      });
      return;
    }

    if (isStale(controller, gen)) return;

    if (putResponse.ok) {
      setSyncState(world, {
        status: 'idle',
        lastSyncedAt: deps.now().toISOString(),
        error: null,
      });
      return;
    }

    if ((putResponse.status === 409 || putResponse.status === 422) && attempt === 0) {
      continue;
    }

    if (putResponse.status === 401 || putResponse.status === 403) {
      setSyncState(world, {
        status: 'error',
        lastSyncedAt: world.sync.lastSyncedAt,
        error: MSG_AUTH_ERROR,
      });
      return;
    }

    if (putResponse.status === 404) {
      setSyncState(world, {
        status: 'error',
        lastSyncedAt: world.sync.lastSyncedAt,
        error: MSG_REPO_NOT_FOUND,
      });
      return;
    }

    setSyncState(world, {
      status: 'error',
      lastSyncedAt: world.sync.lastSyncedAt,
      error: MSG_GENERIC_ERROR,
    });
    return;
  }
}

function triggerSync(controller: SyncController): void {
  if (controller.disposed || controller.credentials === null) {
    return;
  }
  if (controller.inFlight !== null) {
    controller.pendingRerun = true;
    return;
  }

  const runLoop = async () => {
    try {
      do {
        controller.pendingRerun = false;
        const gen = controller.generation;
        await runSingleSync(controller, gen);
      } while (controller.pendingRerun && controller.credentials !== null && !controller.disposed);
    } finally {
      controller.inFlight = null;
    }
  };

  controller.inFlight = runLoop();
}

/** 掛載私人 repo 同步系統，擁有 world.sync 並訂閱回合完成與啟動同步。 */
export function attachSync(world: World, deps: SyncDeps): () => void {
  const existing = controllers.get(world);
  if (existing) {
    existing.disposed = true;
    existing.generation += 1;
    existing.pendingRerun = false;
  }

  const controller: SyncController = {
    world,
    deps,
    credentials: loadCredentials(deps.storage),
    inFlight: null,
    pendingRerun: false,
    generation: 0,
    disposed: false,
    lastVisibilitySyncAt: null,
  };
  controllers.set(world, controller);

  const unsubRoundFinished = world.bus.on('roundFinished', () => {
    triggerSync(controller);
  });

  if (controller.credentials !== null) {
    triggerSync(controller);
  }

  return () => {
    controller.disposed = true;
    controller.generation += 1;
    controller.pendingRerun = false;
    unsubRoundFinished();
    if (controllers.get(world) === controller) {
      controllers.delete(world);
    }
  };
}

/** 解析並儲存同步碼，若合法則立刻觸發一次同步；格式不符則設為錯誤狀態且不儲存。 */
export function setSyncCode(world: World, code: string): void {
  const decoded = decodeSyncCode(code);
  if (!decoded) {
    setSyncState(world, {
      status: 'error',
      lastSyncedAt: world.sync.lastSyncedAt,
      error: MSG_INVALID_CODE,
    });
    return;
  }

  const controller = controllers.get(world);
  if (!controller || controller.disposed) {
    return;
  }

  saveCredentials(controller.deps.storage, decoded);
  controller.credentials = decoded;
  controller.generation += 1;
  if (controller.inFlight !== null) {
    controller.pendingRerun = true;
    setSyncState(world, {
      status: 'syncing',
      lastSyncedAt: world.sync.lastSyncedAt,
      error: null,
    });
    return;
  }
  triggerSync(controller);
}

/** 若已設定同步憑證，立即排程一次同步。 */
export function syncNow(world: World): void {
  const controller = controllers.get(world);
  if (!controller) return;
  triggerSync(controller);
}

/**
 * App 切到背景或回到前景時呼叫：有設定同步就同步一次。
 * 回合做到一半就關掉、或 App 一直開在背景時，靠這個把進度送上去、把另一台的進度抓回來。
 * 距離上一次這類同步不到 SYNC_VISIBILITY_MIN_INTERVAL_MS 就略過（上一次同步失敗時不略過）。回傳這次有沒有觸發。
 */
export function syncOnVisibilityChange(world: World): boolean {
  const controller = controllers.get(world);
  if (!controller || controller.disposed || controller.credentials === null) {
    return false;
  }
  const nowMs = controller.deps.now().getTime();
  // 上一次同步失敗（例如切到背景時請求被系統中斷）就不受間隔限制，回到前景立刻重試
  if (
    world.sync.status !== 'error' &&
    controller.lastVisibilitySyncAt !== null &&
    nowMs - controller.lastVisibilitySyncAt < SYNC_VISIBILITY_MIN_INTERVAL_MS
  ) {
    return false;
  }
  controller.lastVisibilitySyncAt = nowMs;
  triggerSync(controller);
  return true;
}

/** 停止同步並移除本機同步憑證，不更動本機作答進度。 */
export function disableSync(world: World): void {
  const controller = controllers.get(world);
  if (controller) {
    controller.generation += 1;
    controller.credentials = null;
    controller.pendingRerun = false;
    clearCredentials(controller.deps.storage);
  }

  setSyncState(world, {
    status: 'off',
    lastSyncedAt: null,
    error: null,
  });
}

/** 等待進行中及已排程的同步完成（主要供測試使用）。 */
export async function waitForSync(world: World): Promise<void> {
  while (true) {
    const controller = controllers.get(world);
    if (!controller || controller.inFlight === null) {
      return;
    }
    await controller.inFlight;
  }
}
