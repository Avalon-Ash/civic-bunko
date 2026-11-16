import type { EventType } from './bus';
import type { World } from './world';

const ALL_EVENT_TYPES: readonly EventType[] = [
  'bankLoaded',
  'roundStarted',
  'answered',
  'roundFinished',
  'examFinished',
  'cardsLoaded',
  'progressChanged',
  'settingsChanged',
  'syncChanged',
];

interface StoreState {
  version: number;
  listeners: Set<() => void>;
}

const stores = new WeakMap<World, StoreState>();

function ensureStore(world: World): StoreState {
  let state = stores.get(world);
  if (state) return state;

  const nextState: StoreState = {
    version: 0,
    listeners: new Set(),
  };
  stores.set(world, nextState);

  for (const type of ALL_EVENT_TYPES) {
    world.bus.on(type, () => {
      bumpStore(world);
    });
  }

  return nextState;
}

/** 初始化 world 的版本追蹤，應在系統事件監聽掛載後呼叫。 */
export function initStore(world: World): void {
  ensureStore(world);
}

/** 版本號加一並通知所有訂閱者（用於不發 AppEvent 的狀態推進，例如 next）。 */
export function bumpStore(world: World): void {
  const state = ensureStore(world);
  state.version += 1;
  for (const listener of [...state.listeners]) {
    listener();
  }
}

/** 給 React useSyncExternalStore 使用的訂閱函式。 */
export function subscribe(world: World, listener: () => void): () => void {
  const state = ensureStore(world);
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

/** 讀取目前狀態版本號；任何事件發出後會加一。 */
export function getVersion(world: World): number {
  return ensureStore(world).version;
}
