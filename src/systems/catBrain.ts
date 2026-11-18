// 小貓的大腦（純函式）：看處境 → 挑話題 → 挑一句 → 填佔位符。不碰 world、不碰 DOM、不存檔。
// 台詞在 constants/catLines.ts（角色包），門檻在 constants/cat.ts；這裡只有「條件怎麼判斷」和「怎麼挑」。
import {
  CAT_DAY_PARTS,
  CAT_EXAM_EVE_DAYS,
  CAT_EXAM_FAR_DAYS,
  CAT_EXAM_NEAR_DAYS,
  CAT_MEMORY_LINES,
  CAT_NAME_MAX,
  CAT_PETTED_A_LOT_TAPS,
  CAT_PETTED_TAPS,
  CAT_STREAK_MIN,
  CAT_TAP_WINDOW_MS,
} from '../core/constants/cat';
import type {
  CatCharacter,
  CatCondition,
  CatLine,
  CatLineVar,
  CatMemory,
  CatSituation,
  CatTopic,
} from '../core/types';

/** 現在落在一天的哪一段（CAT_DAY_PARTS 裡開始時間不晚於現在的最後一段；比最早那段還早就是深夜） */
function dayPart(hour: number): keyof typeof CAT_DAY_PARTS {
  let part: keyof typeof CAT_DAY_PARTS = 'lateNight';
  for (const [name, from] of Object.entries(CAT_DAY_PARTS) as Array<[keyof typeof CAT_DAY_PARTS, number]>) {
    if (hour >= from) part = name;
  }
  return part;
}

const examIn = (s: CatSituation, min: number, max: number): boolean =>
  s.daysToExam !== null && s.daysToExam >= min && s.daysToExam <= max;

/** 每個條件怎麼判斷：只定義在這一張表 */
export const CAT_CONDITIONS: Readonly<Record<CatCondition, (s: CatSituation) => boolean>> = {
  correct: (s) => s.scene === 'correct',
  wrong: (s) => s.scene === 'wrong',
  calm: (s) => s.scene === undefined && s.mood === 'idle',
  cheerful: (s) => s.scene === undefined && s.mood === 'yay',
  down: (s) => s.scene === undefined && s.mood === 'oops',
  sleepy: (s) => s.mood === 'sleepy',
  roaming: (s) => s.place === 'roam',
  morning: (s) => dayPart(s.hour) === 'morning',
  midday: (s) => dayPart(s.hour) === 'midday',
  afternoon: (s) => dayPart(s.hour) === 'afternoon',
  evening: (s) => dayPart(s.hour) === 'evening',
  lateNight: (s) => dayPart(s.hour) === 'lateNight',
  examFar: (s) => examIn(s, CAT_EXAM_FAR_DAYS + 1, Number.POSITIVE_INFINITY),
  examMid: (s) => examIn(s, CAT_EXAM_NEAR_DAYS + 1, CAT_EXAM_FAR_DAYS),
  examNear: (s) => examIn(s, CAT_EXAM_EVE_DAYS + 1, CAT_EXAM_NEAR_DAYS),
  examEve: (s) => examIn(s, 1, CAT_EXAM_EVE_DAYS),
  examDay: (s) => s.daysToExam === 0,
  notStarted: (s) => s.todayCount === 0,
  underway: (s) => s.todayCount > 0 && s.todayCount < s.dailyGoal,
  goalDone: (s) => s.todayCount >= s.dailyGoal,
  onStreak: (s) => s.streak >= CAT_STREAK_MIN,
  dressed: (s) => s.wearing > 0,
  undressed: (s) => s.wearing === 0,
  named: (s) => s.name !== null,
  unnamed: (s) => s.name === null,
  petted: (s) => s.taps >= CAT_PETTED_TAPS && s.taps < CAT_PETTED_A_LOT_TAPS,
  pettedALot: (s) => s.taps >= CAT_PETTED_A_LOT_TAPS,
};

/** 佔位符的值；回 null＝這個處境下算不出來，用到它的那一句不能說 */
export const CAT_LINE_VARS: Readonly<Record<CatLineVar, (s: CatSituation, character: CatCharacter) => string | null>> = {
  NAME: (s, character) => s.name ?? character.defaultName,
  DAYS: (s) => (s.daysToExam === null ? null : String(s.daysToExam)),
  N: (s) => String(s.todayCount),
  LEFT: (s) => (s.todayCount < s.dailyGoal ? String(s.dailyGoal - s.todayCount) : null),
  GOAL: (s) => String(s.dailyGoal),
  STREAK: (s) => (s.streak > 0 ? String(s.streak) : null),
};

const VAR_RE = /\{([A-Z]+)\}/g;

/** 一句台詞用到哪些佔位符（含不認得的，給資料測試抓錯字） */
export function lineVars(line: string): string[] {
  return [...line.matchAll(VAR_RE)].map((m) => m[1] ?? '');
}

/** 把佔位符填進去；有不認得或算不出來的佔位符就回 null */
export function fillLine(line: string, s: CatSituation, character: CatCharacter): string | null {
  let ok = true;
  const text = line.replace(VAR_RE, (_, name: string) => {
    const read = (CAT_LINE_VARS as Record<string, ((s: CatSituation, c: CatCharacter) => string | null) | undefined>)[name];
    const value = read ? read(s, character) : null;
    if (value === null) ok = false;
    return value ?? '';
  });
  return ok ? text : null;
}

/** 這個處境下說得出口的話題（條件全部成立） */
export function eligibleTopics(character: CatCharacter, s: CatSituation): CatTopic[] {
  return character.topics.filter((topic) => topic.weight > 0 && topic.when.every((c) => CAT_CONDITIONS[c](s)));
}

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, rng: () => number): T | undefined {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** 還沒點過的記憶 */
export const EMPTY_CAT_MEMORY: CatMemory = { recentLines: [], lastTopic: null, taps: 0, lastTapAt: null };

/** 這一下算連續點的第幾下：離上一下不到 CAT_TAP_WINDOW_MS 就接著數，否則從 1 開始 */
export function countTaps(memory: CatMemory, nowMs: number): number {
  const chained = memory.lastTapAt !== null && nowMs - memory.lastTapAt <= CAT_TAP_WINDOW_MS;
  return chained ? memory.taps + 1 : 1;
}

/**
 * 挑一句話。話題照 weight 抽、避開上一個話題（還有別的可選時）；句子避開最近說過的（都說過就任挑一句）。
 * situation.taps 要先用 countTaps 算好。回傳這句話和更新後的記憶；一句都說不出來時 line 是 null。
 */
export function speak(
  character: CatCharacter,
  situation: CatSituation,
  memory: CatMemory,
  nowMs: number,
  rng: () => number,
): { line: CatLine | null; memory: CatMemory } {
  const tapped: CatMemory = { ...memory, taps: situation.taps, lastTapAt: nowMs };
  /** 每個話題此刻說得出口的句子（佔位符都填得出來） */
  const ready = eligibleTopics(character, situation)
    .map((topic) => ({
      topic,
      texts: topic.lines.map((line) => fillLine(line, situation, character)).filter((text): text is string => text !== null),
    }))
    .filter((entry) => entry.texts.length > 0);
  const fresh = ready.filter((entry) => entry.topic.id !== memory.lastTopic);
  const chosen = pickWeighted(fresh.length > 0 ? fresh : ready, (entry) => entry.topic.weight, rng);
  if (!chosen) return { line: null, memory: tapped };

  const unsaid = chosen.texts.filter((text) => !memory.recentLines.includes(text));
  const pool = unsaid.length > 0 ? unsaid : chosen.texts;
  const text = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] as string;
  return {
    line: { text, topic: chosen.topic.id },
    memory: {
      ...tapped,
      lastTopic: chosen.topic.id,
      recentLines: [...memory.recentLines, text].slice(-CAT_MEMORY_LINES),
    },
  };
}

/** 名字裡不留的字元（碼位範圍，含兩端）：控制字元（含換行）、零寬字元、方向控制字元 */
const NAME_DROP: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200f],
  [0x2028, 0x202f],
  [0xfeff, 0xfeff],
];

/** 名字清理：去掉 NAME_DROP 的字元與頭尾空白，最多 CAT_NAME_MAX 個字。清完是空的回 null（＝沒取名） */
export function cleanCatName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const kept = [...value].filter((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return !NAME_DROP.some(([from, to]) => code >= from && code <= to);
  });
  const clipped = kept.join('').trim();
  const text = [...clipped].slice(0, CAT_NAME_MAX).join('').trim();
  return text.length > 0 ? text : null;
}
