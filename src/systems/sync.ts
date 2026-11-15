import {
  SYNC_API_BASE,
  SYNC_FILE_VERSION,
  SYNC_REMOTE_PATH,
  SYNC_STORAGE_KEY,
} from '../core/constants/sync';
import type { Progress, QuestionId, SyncCredentials, SyncState } from '../core/types';
import type { World } from '../core/world';
import { parseProgressEntry, type StorageLike } from './persistence';
import { base64ToUtf8, decodeSyncCode, utf8ToBase64, validateSyncCredentials } from './syncCode';
import { mergeProgress } from './syncMerge';

export interface SyncStorageLike extends StorageLike {
  removeItem?(key: string): void;
}

export interface SyncDeps {
  fetch: typeof fetch;
  storage: SyncStorageLike;
  now: () => Date;
}

interface SyncController {
  world: World;
  deps: SyncDeps;
  credentials: SyncCredentials | null;
  inFlight: Promise<void> | null;
  pendingRerun: boolean;
  generation: number;
  disposed: boolean;
}

type RemoteFetchResult =
  | { kind: 'missing' }
  | { kind: 'ok'; sha: string; progress: Map<QuestionId, Progress> }
  | { kind: 'error'; message: string };

const MSG_INVALID_CODE = '同步碼格式不對';
const MSG_AUTH_ERROR = '同步碼失效或權限不足';
const MSG_REPO_NOT_FOUND = '找不到同步用的 repo';
const MSG_NETWORK_ERROR = '現在連不上網路，稍後會再試';
const MSG_DATA_ERROR = '同步資料格式不正確';
const MSG_GENERIC_ERROR = '同步失敗，請稍後再試';

const controllers = new WeakMap<World, SyncController>();

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

function parseRemoteContent(base64Content: string): Map<QuestionId, Progress> | null {
  try {
    const jsonText = base64ToUtf8(base64Content);
    const parsed: unknown = JSON.parse(jsonText);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== SYNC_FILE_VERSION) return null;
    if (!isRecord(parsed.progress)) return null;

    const result = new Map<QuestionId, Progress>();
    for (const [id, rawEntry] of Object.entries(parsed.progress)) {
      const normalized = parseProgressEntry(rawEntry);
      if (!normalized) return null;
      result.set(id, normalized);
    }
    return result;
  } catch {
    return null;
  }
}

async function fetchRemoteFile(
  fetchFn: typeof fetch,
  cred: SyncCredentials,
): Promise<RemoteFetchResult> {
  let response: Response;
  try {
    response = await fetchFn(buildRemoteUrl(cred), {
      method: 'GET',
      headers: buildHeaders(cred.token),
      cache: 'no-store',
    });
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
    body = await response.json();
  } catch {
    return { kind: 'error', message: MSG_DATA_ERROR };
  }

  if (!isRecord(body) || typeof body.sha !== 'string' || body.sha.length === 0 || typeof body.content !== 'string') {
    return { kind: 'error', message: MSG_DATA_ERROR };
  }

  const progress = parseRemoteContent(body.content);
  if (!progress) {
    return { kind: 'error', message: MSG_DATA_ERROR };
  }

  return { kind: 'ok', sha: body.sha, progress };
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

    const remote = await fetchRemoteFile(deps.fetch, cred);
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
    const remoteSha = remote.kind === 'ok' ? remote.sha : null;

    const merged = mergeProgress(world.progress, remoteMap);
    const changedIds = diffProgressIds(world.progress, merged);
    if (changedIds.length > 0) {
      world.progress.clear();
      for (const [id, entry] of merged) {
        world.progress.set(id, entry);
      }
      world.bus.emit({ type: 'progressChanged', ids: changedIds });
      if (isStale(controller, gen)) return;
    }

    const shouldPut = remote.kind === 'missing' || !progressMapsEqual(merged, remoteMap);
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
      putResponse = await deps.fetch(buildRemoteUrl(cred), {
        method: 'PUT',
        headers: buildHeaders(cred.token, true),
        body: JSON.stringify(putBody),
      });
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
