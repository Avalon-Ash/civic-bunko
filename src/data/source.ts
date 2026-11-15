import type { Bank, EnrichFile, PaperFile, PaperIndex, TopicInfo } from '../core/types';
import { loadModulesSafely } from './sourceLoader';

export interface BankMeta {
  banks: Bank[];
  index: PaperIndex | null;
}

const bankModules = import.meta.glob<Bank[]>('../../data/banks.json', {
  eager: true,
  import: 'default',
});

const indexModules = import.meta.glob<PaperIndex>('../../data/official/index.json', {
  eager: true,
  import: 'default',
});

const topicModules = import.meta.glob<{ topics: TopicInfo[] }>('../../data/topics.json', {
  import: 'default',
});

const paperModules = import.meta.glob<PaperFile>(
  ['../../data/official/*.json', '!../../data/official/index.json'],
  {
    import: 'default',
  },
);

const enrichModules = import.meta.glob<EnrichFile>('../../data/enrich/*.json', {
  import: 'default',
});

/** 同步讀取已隨主程式打包的題庫登記檔與試卷索引。 */
export function loadBankMeta(): BankMeta {
  const banks = Object.values(bankModules)[0] ?? [];
  const index = Object.values(indexModules)[0] ?? null;
  return { banks, index };
}

let cachedTopics: TopicInfo[] | null = null;

/** 延後載入考點分類對照表；找不到時回傳空陣列。 */
export async function loadTopics(): Promise<TopicInfo[]> {
  if (cachedTopics) return cachedTopics;
  const loader = Object.values(topicModules)[0];
  if (!loader) return [];
  try {
    const file = await loader();
    cachedTopics = file?.topics ?? [];
    return cachedTopics;
  } catch {
    return [];
  }
}

/** 平行延後載入所有官方試卷 JSON 分片。 */
export async function loadPapers(): Promise<PaperFile[]> {
  const loaders = Object.entries(paperModules)
    .filter(([path]) => !path.endsWith('/index.json'))
    .map(([, load]) => load);
  return Promise.all(loaders.map((load) => load()));
}

/** 平行延後載入所有加工解析 JSON 分片；找不到檔案或載入失敗時視為沒有。 */
export async function loadEnrichFiles(): Promise<EnrichFile[]> {
  return loadModulesSafely(Object.values(enrichModules));
}
