import type { TopicInfo } from '../core/types';

/** 平行執行延後載入器，將找不到的檔案或失敗的載入視為沒有而不中斷其餘資料。 */
export async function loadModulesSafely<T>(
  loaders: ReadonlyArray<() => Promise<T | null | undefined>>,
): Promise<T[]> {
  const settled = await Promise.allSettled(loaders.map((load) => load()));
  const items: T[] = [];
  for (const res of settled) {
    if (res.status === 'fulfilled' && res.value != null) {
      items.push(res.value);
    }
  }
  return items;
}

/** 依 topics.json 對照表將考點 ID 轉成顯示名稱；查無對照時保留原字串。 */
export function resolveTopicLabel(topics: readonly TopicInfo[], idOrName: string): string {
  const found = topics.find((t) => t.id === idOrName);
  return found ? found.name : idOrName;
}
