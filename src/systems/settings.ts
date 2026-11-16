import { EXAM_HISTORY_MAX } from '../core/constants/exam';
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

/** 開關「選項打亂」，並發出 settingsChanged。 */
export function setShuffleOptions(world: World, on: boolean): void {
  world.settings = {
    ...world.settings,
    shuffleOptions: on,
  };
  world.bus.emit({
    type: 'settingsChanged',
    settings: { ...world.settings },
  });
}

/** 開關「英文題中英對照」，並發出 settingsChanged。 */
export function setBilingual(world: World, on: boolean): void {
  world.settings = {
    ...world.settings,
    bilingual: on,
  };
  world.bus.emit({
    type: 'settingsChanged',
    settings: { ...world.settings },
  });
}

/** 把卡片記成看過；已經記過就不動作。 */
export function markCardSeen(world: World, id: string): void {
  const seen = world.settings.cardsSeen ?? [];
  if (seen.includes(id)) return;
  world.settings = {
    ...world.settings,
    cardsSeen: [...seen, id],
  };
  world.bus.emit({
    type: 'settingsChanged',
    settings: { ...world.settings },
  });
}

/** 訂閱 roundStarted 與 examFinished，自動記住最後一次回合設定與模擬考歷次成績並發出 settingsChanged。 */
export function attachSettings(world: World): () => void {
  const unsubRound = world.bus.on('roundStarted', (event) => {
    if (event.config.topicIds && event.config.topicIds.length > 0) {
      return;
    }
    const { topicIds: _ignoredTopicIds, ...restConfig } = event.config;
    world.settings = {
      ...world.settings,
      lastRound: {
        ...restConfig,
        subjectKeys: [...event.config.subjectKeys],
      },
    };
    world.bus.emit({
      type: 'settingsChanged',
      settings: { ...world.settings },
    });
  });

  const unsubExam = world.bus.on('examFinished', (event) => {
    const prev = world.settings.examHistory ?? [];
    const next = [...prev, { ...event.record }];
    const trimmed =
      next.length > EXAM_HISTORY_MAX ? next.slice(next.length - EXAM_HISTORY_MAX) : next;
    world.settings = {
      ...world.settings,
      examHistory: trimmed,
    };
    world.bus.emit({
      type: 'settingsChanged',
      settings: { ...world.settings },
    });
  });

  return () => {
    unsubRound();
    unsubExam();
  };
}
