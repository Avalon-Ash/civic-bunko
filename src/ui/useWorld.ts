import { useSyncExternalStore } from 'react';
import { getVersion, subscribe } from '../core/store';
import type { World } from '../core/world';

/** 訂閱 World 狀態變更，任何 AppEvent 或狀態推進時觸發重新繪製。 */
export function useWorld(world: World): number {
  return useSyncExternalStore(
    (listener) => subscribe(world, listener),
    () => getVersion(world),
  );
}
