import {
  OFFLINE_ASSET_PREFIX,
  OFFLINE_CACHE_NAME,
  OFFLINE_MANIFEST_PATH,
} from '../core/constants/offline';

export interface OfflineManifest {
  version: string;
  files: string[];
}

export interface OfflinePlan {
  /** 這一版需要、但快取裡還沒有的網址 */
  toAdd: string[];
  /** 快取裡屬於舊版、這一版已經不用的資產網址 */
  toRemove: string[];
}

export interface OfflineResult {
  added: number;
  removed: number;
}

export interface OfflineDeps {
  fetch: typeof fetch;
  caches: CacheStorage;
}

/** 檢查清單格式；不合格回傳 null。 */
export function parseOfflineManifest(value: unknown): OfflineManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.version !== 'string') return null;
  if (!Array.isArray(record.files) || !record.files.every((f) => typeof f === 'string')) {
    return null;
  }
  return { version: record.version, files: record.files as string[] };
}

/**
 * 比對「快取裡現有的網址」和「這一版的資產清單」，算出要補抓與要清掉的網址。
 * 只動 assets/ 底下的檔案：首頁、圖示、字型等其他快取項目一律不碰。
 */
export function planOfflineCache(
  cachedUrls: readonly string[],
  manifestFiles: readonly string[],
  baseUrl: string,
): OfflinePlan {
  const assetBase = new URL(OFFLINE_ASSET_PREFIX, baseUrl).href;
  const wanted = new Set<string>();
  for (const file of manifestFiles) {
    if (!file.startsWith(OFFLINE_ASSET_PREFIX)) continue;
    wanted.add(new URL(file, baseUrl).href);
  }
  const cached = new Set(cachedUrls);
  return {
    toAdd: [...wanted].filter((url) => !cached.has(url)),
    toRemove: [...cached].filter((url) => url.startsWith(assetBase) && !wanted.has(url)),
  };
}

/**
 * 讓離線可用的內容完整：把這一版所有資產補進 service worker 的快取，並清掉舊版留下的檔案。
 * 法規全文是點開法條才載入的，沒有這一步的話，沒點過的法規離線時查不到。
 * 清單版本和目前頁面版本不同時（頁面還是舊版）不做任何事，避免清掉舊頁面還要用的檔案。
 * 補抓中途失敗就停下、不清舊檔：離線可用的內容只會變多，不會變少。
 */
export async function refreshOfflineCache(
  appVersion: string,
  baseUrl: string,
  deps: OfflineDeps,
): Promise<OfflineResult | null> {
  let manifest: OfflineManifest | null = null;
  try {
    const response = await deps.fetch(new URL(OFFLINE_MANIFEST_PATH, baseUrl).href, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    manifest = parseOfflineManifest(await response.json());
  } catch {
    return null;
  }
  if (!manifest || manifest.version !== appVersion) return null;

  const cache = await deps.caches.open(OFFLINE_CACHE_NAME);
  const cachedUrls = (await cache.keys()).map((request) => request.url);
  const plan = planOfflineCache(cachedUrls, manifest.files, baseUrl);

  let added = 0;
  for (const url of plan.toAdd) {
    try {
      await cache.add(url);
      added += 1;
    } catch {
      return { added, removed: 0 };
    }
  }

  let removed = 0;
  for (const url of plan.toRemove) {
    if (await cache.delete(url)) {
      removed += 1;
    }
  }
  return { added, removed };
}
