import type { SyncState } from '../core/types';
import type { World } from '../core/world';

/** 唯讀取得目前私人 repo 同步狀態複本（不含任何憑證或權杖）。 */
export function getSyncState(world: World): SyncState {
  return { ...world.sync };
}
