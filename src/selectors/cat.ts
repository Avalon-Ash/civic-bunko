// 小貓的名字與「牠現在看到什麼」：把 world 整理成大腦讀的 CatSituation，再請大腦挑一句話。畫面只從這裡讀。
import { CAT_CHARACTER } from '../core/constants/catLines';
import { DAILY_GOAL_QUESTIONS } from '../core/constants/daily';
import type { CatCharacter, CatId, CatLine, CatMemory, CatSituation, CatTap } from '../core/types';
import type { World } from '../core/world';
import { EMPTY_CAT_MEMORY, cleanCatName, countTaps, speak } from '../systems/catBrain';
import { addDaysLocal, localDaysUntil, toLocalDateString } from '../systems/date';
import { catOutfit, houseCats, leaderCat, type HouseCatView } from './house';
import { activeBank } from './index';

/** 還沒點過牠時的記憶（給保管記憶的呼叫端當起點） */
export { EMPTY_CAT_MEMORY };

function catView(world: World, cat?: CatId): HouseCatView | undefined {
  const id = cat ?? leaderCat(world);
  return houseCats(world).find((c) => c.id === id);
}

/** 使用者取的名字；沒取（或存檔裡的值不合規則）是 null。未指定 cat 時讀「陪我刷題」那隻。 */
export function catName(world: World, cat?: CatId): string | null {
  return catView(world, cat)?.named ?? null;
}

/** 輸入框裡打的字存起來會變成什麼（清理、截短之後）；null＝等於沒取名 */
export function cleanCatNameInput(text: string): string | null {
  return cleanCatName(text);
}

/** 畫面上怎麼稱呼牠：取了名字用名字，沒取用預設稱呼（或角色包的預設稱呼）。未指定 cat 時讀「陪我刷題」那隻。 */
export function catDisplayName(world: World, character: CatCharacter = CAT_CHARACTER, cat?: CatId): string {
  const view = catView(world, cat);
  if (view?.named) return view.named;
  if (character !== CAT_CHARACTER) return character.defaultName;
  return view?.name ?? character.defaultName;
}

/** 連續幾天蓋章：從今天往回數；今天還沒蓋就從昨天數起 */
function stampStreak(world: World, now: Date): number {
  const stamped = (offset: number) => (world.dayLog.get(addDaysLocal(now, offset)) ?? 0) >= DAILY_GOAL_QUESTIONS;
  let offset = stamped(0) ? 0 : -1;
  let streak = 0;
  while (stamped(offset)) {
    streak += 1;
    offset -= 1;
  }
  return streak;
}

/** 離考試幾天（當天是 0）；沒有題庫、或考試日已過是 null */
function daysToExam(world: World, now: Date): number | null {
  const bank = activeBank(world);
  if (!bank || bank.examDate < toLocalDateString(now)) return null;
  return localDaysUntil(bank.examDate, now);
}

/** 小貓現在看到的處境；taps＝這一下是連續點的第幾下 */
export function catSituation(world: World, tap: CatTap, taps: number, now: Date): CatSituation {
  const target = tap.cat ?? leaderCat(world);
  const outfit = catOutfit(world, target);
  return {
    ...tap,
    hour: now.getHours(),
    daysToExam: daysToExam(world, now),
    todayCount: world.dayLog.get(toLocalDateString(now)) ?? 0,
    dailyGoal: DAILY_GOAL_QUESTIONS,
    streak: stampStreak(world, now),
    wearing: Object.keys(outfit).filter((slot) => slot !== 'fur').length,
    name: catName(world, target),
    taps,
  };
}

/**
 * 點牠一下，牠說什麼。記憶（最近說過的、連點幾下）由呼叫端保管、每次把回傳的新記憶存回去；
 * 角色包可以換（預設是 CAT_CHARACTER）。
 */
export function catSays(
  world: World,
  tap: CatTap,
  memory: CatMemory,
  now: Date,
  rng: () => number,
  character: CatCharacter = CAT_CHARACTER,
): { line: CatLine | null; memory: CatMemory } {
  const nowMs = now.getTime();
  const situation = catSituation(world, tap, countTaps(memory, nowMs), now);
  const activeCharacter =
    character === CAT_CHARACTER
      ? { ...character, defaultName: catDisplayName(world, character, tap.cat ?? leaderCat(world)) }
      : character;
  return speak(activeCharacter, situation, memory, nowMs, rng);
}
