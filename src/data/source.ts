import type { Bank, CardFile, EnrichFile, PaperFile, PaperIndex, TopicInfo, ZhFile } from '../core/types';
import { loadModulesSafely } from './sourceLoader';

export interface BankMeta {
  banks: Bank[];
  index: PaperIndex | null;
}

const bankModules = import.meta.glob<Bank>('../../data/packs/*/pack.json', {
  eager: true,
  import: 'default',
});

const indexModules = import.meta.glob<PaperIndex>('../../data/packs/*/official/index.json', {
  eager: true,
  import: 'default',
});

const topicModules = import.meta.glob<{ topics: TopicInfo[] }>('../../data/packs/*/topics.json', {
  import: 'default',
});

const paperModules = import.meta.glob<PaperFile>(
  ['../../data/packs/*/official/*.json', '!../../data/packs/*/official/index.json'],
  {
    import: 'default',
  },
);

const enrichModules = import.meta.glob<EnrichFile>('../../data/packs/*/enrich/*.json', {
  import: 'default',
});

const cardModules = import.meta.glob<CardFile>('../../data/packs/*/cards/*.json', {
  import: 'default',
});

const zhModules = import.meta.glob<ZhFile>('../../data/packs/*/zh/*.json', {
  import: 'default',
});

/** 平行延後載入所有卡片檔；載入失敗時視為沒有。 */
export async function loadCardFiles(): Promise<CardFile[]> {
  const loaders = Object.entries(cardModules)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, load]) => load);
  return loadModulesSafely(loaders);
}

/** 同步讀取已隨主程式打包的題庫登記檔與試卷索引。 */
export function loadBankMeta(): BankMeta {
  const banks = Object.values(bankModules).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const indexEntries = Object.entries(indexModules).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const index: PaperIndex | null =
    indexEntries.length === 0
      ? null
      : { papers: indexEntries.flatMap(([, mod]) => mod?.papers ?? []) };
  return { banks, index };
}

let cachedTopics: TopicInfo[] | null = null;

/** 延後載入考點分類對照表；找不到時回傳空陣列。 */
export async function loadTopics(): Promise<TopicInfo[]> {
  if (cachedTopics) return cachedTopics;
  const loaders = Object.entries(topicModules)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, load]) => load);
  if (loaders.length === 0) return [];
  const settled = await Promise.allSettled(loaders.map((load) => load()));
  const topics: TopicInfo[] = [];
  let loadedAny = false;
  for (const res of settled) {
    if (res.status === 'fulfilled' && res.value) {
      loadedAny = true;
      topics.push(...(res.value.topics ?? []));
    }
  }
  if (loadedAny) {
    cachedTopics = topics;
  }
  return topics;
}

/** 平行延後載入所有官方試卷 JSON 分片。 */
export async function loadPapers(): Promise<PaperFile[]> {
  const loaders = Object.entries(paperModules)
    .filter(([path]) => !path.endsWith('/index.json'))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, load]) => load);
  return Promise.all(loaders.map((load) => load()));
}

/** 平行延後載入所有加工解析 JSON 分片；找不到檔案或載入失敗時視為沒有。 */
export async function loadEnrichFiles(): Promise<EnrichFile[]> {
  return loadModulesSafely(Object.values(enrichModules));
}

/** 平行延後載入所有英文題中譯 JSON 分片；找不到檔案或載入失敗時視為沒有。 */
export async function loadZhFiles(): Promise<ZhFile[]> {
  return loadModulesSafely(Object.values(zhModules));
}
