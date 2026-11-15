import type { Bank, PaperFile, PaperIndex } from '../core/types';

export interface DataSource {
  banks: Bank[];
  files: PaperFile[];
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

const paperModules = import.meta.glob<PaperFile>('../../data/official/*.json', {
  eager: true,
  import: 'default',
});

/** 透過 Vite import.meta.glob 載入題庫登記檔與官方試卷 JSON；缺檔時回傳空陣列。 */
export function loadDataSource(): DataSource {
  const banks = Object.values(bankModules)[0] ?? [];
  const index = Object.values(indexModules)[0] ?? null;
  const files = Object.entries(paperModules)
    .filter(([path]) => !path.endsWith('/index.json'))
    .map(([, file]) => file);

  return { banks, files, index };
}
