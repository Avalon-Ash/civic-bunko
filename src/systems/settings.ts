import type { ThemeChoice } from '../core/types';
import type { World } from '../core/world';

/** 更新佈景主題設定並發出 settingsChanged。 */
export function setTheme(world: World, theme: ThemeChoice): void {
  world.settings = {
    ...world.settings,
    theme,
  };
  world.bus.emit({
    type: 'settingsChanged',
    settings: { ...world.settings },
  });
}

/** 訂閱 roundStarted，自動記住最後一次回合設定並發出 settingsChanged。 */
export function attachSettings(world: World): () => void {
  return world.bus.on('roundStarted', (event) => {
    world.settings = {
      ...world.settings,
      lastRound: {
        ...event.config,
        subjectKeys: [...event.config.subjectKeys],
      },
    };
    world.bus.emit({
      type: 'settingsChanged',
      settings: { ...world.settings },
    });
  });
}
