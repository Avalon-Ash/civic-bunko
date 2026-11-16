import { bumpStore } from '../core/store';
import type { ZhFile } from '../core/types';
import type { World } from '../core/world';

/** 將英文題中譯與題組逐句對照載入 world.zh 與 world.groupZh（重複 ID 保留第一筆），並通知訂閱者更新。 */
export function loadZh(world: World, files: readonly ZhFile[]): void {
  for (const file of files) {
    for (const group of file.groups) {
      if (!world.groupZh.has(group.id)) {
        world.groupZh.set(group.id, group);
      }
    }
    for (const item of file.items) {
      if (!world.zh.has(item.id)) {
        world.zh.set(item.id, item);
      }
    }
  }
  bumpStore(world);
}
