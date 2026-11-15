import type { Bank, PaperFile, PaperIndex } from '../core/types';

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

const paperModules = import.meta.glob<PaperFile>(
  ['../../data/official/*.json', '!../../data/official/index.json'],
  {
    import: 'default',
  },
);

/** 同步讀取已隨主程式打包的題庫登記檔與試卷索引。 */
export function loadBankMeta(): BankMeta {
  const banks = Object.values(bankModules)[0] ?? [];
  const index = Object.values(indexModules)[0] ?? null;
  return { banks, index };
}

/** 平行延後載入所有官方試卷 JSON 分片。 */
export async function loadPapers(): Promise<PaperFile[]> {
  const loaders = Object.entries(paperModules)
    .filter(([path]) => !path.endsWith('/index.json'))
    .map(([, load]) => load());
  return Promise.all(loaders);
}
