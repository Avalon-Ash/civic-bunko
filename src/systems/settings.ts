import { WEATHER_PLACES } from '../core/constants/weather';
import { catProfileOf, cleanCatName } from './catBrain';
import { EXAM_HISTORY_MAX } from '../core/constants/exam';
import type { AccessoryId, CatProfile, ExamRecord, Settings, ThemeChoice } from '../core/types';
import type { World } from '../core/world';
import { unlockedAccessories } from './daily';
import { nextChangeTime } from './syncMerge';

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

const defaultNow = (): Date => new Date();

/** 把卡片記成看過；已經記過就不動作。 */
export function markCardSeen(
  world: World,
  id: string,
  now: () => Date = defaultNow,
): void {
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
  world.bus.emit({
    type: 'cardSeen',
    id,
    at: now().toISOString(),
  });
}

/**
 * 套用同步合併後的「看過的卡片」與「模擬考歷次成績」，並發出 settingsChanged。
 * 這兩欄的擁有者是本系統；同步系統只負責算出合併結果再交給這裡寫入。
 */
export function applySyncedSettings(
  world: World,
  cardsSeen: readonly string[],
  examHistory: readonly ExamRecord[],
): void {
  world.settings = {
    ...world.settings,
    cardsSeen: [...cardsSeen],
    examHistory: examHistory.map((record) => ({ ...record })),
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

/** 開關音效，並發出 settingsChanged。 */
export function setSound(world: World, on: boolean): void {
  world.settings = { ...world.settings, sound: on };
  world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
}

/** 開關天氣天空，並發出 settingsChanged。 */
export function setWeather(world: World, on: boolean): void {
  world.settings = { ...world.settings, weather: on };
  world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
}

/** 天氣天空改看哪個縣市（null 或不認得的 id＝改回用定位，那一欄不留），並發出 settingsChanged。 */
export function setWeatherPlace(world: World, place: string | null): void {
  const { weatherPlace: _old, ...rest } = world.settings;
  const known = place !== null && WEATHER_PLACES.some((p) => p.id === place);
  world.settings = { ...rest, ...(known ? { weatherPlace: place } : {}) };
  world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
}

/** 把小貓的個人設定寫進 settings 的兩欄（catName、catNameAt）；沒有名字、不知道時間就不留那一欄 */
function withCatProfile(settings: Settings, profile: CatProfile): Settings {
  const { catName: _name, catNameAt: _at, ...rest } = settings;
  return {
    ...rest,
    ...(profile.name !== null ? { catName: profile.name } : {}),
    ...(profile.at !== '' ? { catNameAt: profile.at } : {}),
  };
}

/**
 * 幫小貓取名：清理後存起來，並記下改動時間（同步時用它判斷哪一台的比較新）。
 * 清完是空的＝改回沒取名（也算一次改動）。跟現在一樣就不動作、時間也不更新。
 * 改動時間取「現在」和「目前記錄的時間再晚一點」較晚的那個：別台的時鐘比這台快時，
 * 同步拉下來之後在這台再改，一定比拉下來的那一筆新，不會下次同步又被蓋回去。
 */
export function setCatName(world: World, name: string, now: () => Date): void {
  const next = cleanCatName(name);
  if (next === cleanCatName(world.settings.catName)) return;
  const at = nextChangeTime(catProfileOf(world.settings)?.at, now);
  world.settings = withCatProfile(world.settings, { name: next, at });
  world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
}

/** 寫入同步合併後的小貓個人設定（擁有者是本系統；同步系統只負責算出結果）。跟現在一樣就不動作。 */
export function applySyncedCatProfile(world: World, profile: CatProfile): void {
  const current = catProfileOf(world.settings);
  if (current !== null && current.name === profile.name && current.at === profile.at) return;
  world.settings = withCatProfile(world.settings, profile);
  world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
}

/** 記下看過的最新一則更新紀錄；一樣就不動作。 */
export function markChangelogSeen(world: World, id: string): void {
  if (world.settings.changelogSeen === id) return;
  world.settings = { ...world.settings, changelogSeen: id };
  world.bus.emit({ type: 'settingsChanged', settings: { ...world.settings } });
}
