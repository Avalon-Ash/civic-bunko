import type { AppEvent } from './types';

export type EventType = AppEvent['type'];
export type EventOf<T extends EventType> = Extract<AppEvent, { type: T }>;
export type EventHandler<T extends EventType = EventType> = (event: EventOf<T>) => void;

export interface Bus {
  on<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
  emit(event: AppEvent): void;
}

type StoredHandler = (event: AppEvent) => void;

/** 建立同步事件匯流排；handler 依訂閱順序同步呼叫。 */
export function createBus(): Bus {
  const registry = new Map<EventType, Set<StoredHandler>>();

  return {
    on<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
      let handlers = registry.get(type);
      if (!handlers) {
        handlers = new Set();
        registry.set(type, handlers);
      }
      const wrapped: StoredHandler = (event) => {
        handler(event as EventOf<T>);
      };
      handlers.add(wrapped);

      return () => {
        handlers.delete(wrapped);
      };
    },

    emit(event: AppEvent): void {
      const handlers = registry.get(event.type);
      if (!handlers || handlers.size === 0) return;
      for (const fn of [...handlers]) {
        fn(event);
      }
    },
  };
}
