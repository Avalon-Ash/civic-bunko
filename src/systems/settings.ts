import type { AccessoryId, ThemeChoice } from '../core/types';
import type { World } from '../core/world';
import { unlockedAccessories } from './daily';

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

/** 更新貓咪配戴的配件；只接受已解鎖的配件或 null，並發出 settingsChanged。 */
export function setAccessory(world: World, accessory: AccessoryId | null): void {
  if (accessory !== null && !unlockedAccessories(world).includes(accessory)) {
    return;
  }
  world.settings = {
    ...world.settings,
    accessory,
  };
  world.bus.emit({
    type: 'settingsChanged',
    settings: { ...world.settings },
  });
}

/** 標記使用者已永久關閉加到主畫面引導，並發出 settingsChanged。 */
export function dismissInstallHint(world: World): void {
  world.settings = {
    ...world.settings,
    installHintDismissed: true,
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
