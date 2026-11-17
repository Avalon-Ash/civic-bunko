import type { LawFile, LawIndex, LawRef } from '../core/types';
import { createLawArticleLoader, type LawArticleResult } from './lawLookup';

export type { LawArticleResult } from './lawLookup';
export { formatLawRef } from './lawLookup';

const lawIndexModules = import.meta.glob<LawIndex>('../../data/laws/index.json', {
  eager: true,
  import: 'default',
});

const lawFileModules = import.meta.glob<LawFile>(
  ['../../data/laws/*.json', '!../../data/laws/index.json'],
  {
    import: 'default',
  },
);

/** 同步讀取已打包的法規索引。 */
export function getLawIndex(): LawIndex {
  return Object.values(lawIndexModules)[0] ?? { laws: [] };
}

/** 依 pcode 延後載入單一法規全文 JSON；找不到或載入失敗回傳 null。 */
export async function loadLawByPcode(pcode: string): Promise<LawFile | null> {
  const suffix = `/${pcode}.json`;
  const entry = Object.entries(lawFileModules).find(([path]) => path.endsWith(suffix));
  if (!entry) {
    return null;
  }
  try {
    return (await entry[1]()) ?? null;
  } catch {
    return null;
  }
}

/**
 * 把所有法規全文先抓一遍，讓離線快取（service worker）存下來：
 * 法規是點開法條才載入的，沒點過的法規離線時會查不到。逐檔依序抓，失敗就略過。
 */
export async function warmLawFiles(): Promise<number> {
  let loaded = 0;
  for (const load of Object.values(lawFileModules)) {
    try {
      await load();
      loaded += 1;
    } catch {
      // 離線或載入失敗：下次啟動再試
    }
  }
  return loaded;
}

let defaultLoader: ReturnType<typeof createLawArticleLoader> | null = null;

/** 依 LawRef 載入並查詢法條原文（含快取）。 */
export async function loadLawArticle(ref: LawRef): Promise<LawArticleResult> {
  if (!defaultLoader) {
    defaultLoader = createLawArticleLoader(getLawIndex(), loadLawByPcode);
  }
  return defaultLoader.loadArticle(ref);
}
