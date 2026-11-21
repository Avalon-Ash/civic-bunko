// 小屋房間動作邏輯（純函式，不碰 DOM）：位置範圍、走進門、下一個動作、蹭蹭配對、時段判斷。
// 數字只讀 constants/house.ts 的 HOUSE_SCENE 與 constants/cat.ts 的 CAT_DAY_PARTS。
import { CAT_DAY_PARTS } from '../../core/constants/cat';
import { HOUSE_SCENE } from '../../core/constants/house';
import type { CatId, CatMood, PetPose } from '../../core/types';

export type HouseAction = 'walk' | 'sit' | 'groom' | 'loaf' | 'nuzzle';
export type HouseDayPart = 'day' | 'dusk' | 'night';

export interface RoomBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  floorHeight: number;
}

export interface HouseActor {
  id: CatId;
  /** 水平位置（px，小貓中心點） */
  x: number;
  /** 地板縱深（px，從地板上緣往下算；越大越靠前） */
  y: number;
  facing: 'left' | 'right';
  action: HouseAction;
  /** 走路目標；只有 action === 'walk' 時有值 */
  target?: { x: number; y: number };
  /** 靜止動作的剩餘時間（毫秒） */
  remainMs: number;
  /** 蹭蹭對象；只有 action === 'nuzzle' 時有值 */
  partnerId?: CatId;
  /** 點擊跳一下的剩餘時間（毫秒） */
  hopMs: number;
}

export interface HouseOptions {
  reducedMotion?: boolean;
}

export interface NuzzlePair {
  a: HouseActor;
  b: HouseActor;
  x: number;
  y: number;
}

type StationaryAction = 'sit' | 'groom' | 'loaf';
type PickableAction = 'walk' | StationaryAction;

const STATIONARY_ACTIONS: readonly StationaryAction[] = ['sit', 'groom', 'loaf'];
const ALL_ACTIONS: readonly PickableAction[] = ['walk', 'sit', 'groom', 'loaf'];

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

function between(range: { min: number; max: number }, rng: () => number): number {
  const r = clamp(rng(), 0, 0.999999);
  return Math.round(range.min + r * (range.max - range.min));
}

/** 照 CAT_DAY_PARTS 的界線決定窗外是白天、傍晚還是晚上。 */
export function dayPartOfHour(hour: number): HouseDayPart {
  const h = ((hour % 24) + 24) % 24;
  if (h >= CAT_DAY_PARTS.morning && h < CAT_DAY_PARTS.evening) return 'day';
  if (h >= CAT_DAY_PARTS.evening && h < CAT_DAY_PARTS.lateNight) return 'dusk';
  return 'night';
}

/** 依房間目前寬高算出地板可活動範圍。 */
export function roomBounds(width: number, height: number): RoomBounds {
  const safeW = Math.max(HOUSE_SCENE.catWidth, width);
  const safeH = Math.max(HOUSE_SCENE.shortHeight, height);
  const floorHeight = Math.round(safeH * HOUSE_SCENE.floorRatio);
  const edgeX = Math.min(HOUSE_SCENE.edgeX, Math.floor(safeW / 2) - 1);
  const minX = edgeX;
  const maxX = Math.max(edgeX, safeW - edgeX);
  const minY = Math.round(floorHeight * HOUSE_SCENE.floorInsetY.min);
  const maxY = Math.max(minY, Math.round(floorHeight * HOUSE_SCENE.floorInsetY.max));
  return { minX, maxX, minY, maxY, width: safeW, floorHeight };
}

/** 右邊門口的位置（新領養的小貓走進來的起點）。 */
export function doorPosition(bounds: RoomBounds): { x: number; y: number } {
  const x = Math.max(bounds.minX, bounds.width - HOUSE_SCENE.doorInset);
  const y = Math.round((bounds.minY + bounds.maxY) / 2);
  return { x, y };
}

function pickWeighted<T extends PickableAction>(pool: readonly T[], rng: () => number): T {
  const total = pool.reduce((sum, a) => sum + HOUSE_SCENE.weights[a], 0);
  if (total <= 0) return pool[0]!;
  let roll = clamp(rng(), 0, 0.999999) * total;
  for (const action of pool) {
    roll -= HOUSE_SCENE.weights[action];
    if (roll < 0) return action;
  }
  return pool[pool.length - 1]!;
}

/** 挑一個在房間地板範圍內的走路目標；空間太小時回 null。 */
export function pickFloorTarget(
  from: { x: number; y: number },
  bounds: RoomBounds,
  rng: () => number,
): { x: number; y: number } | null {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  if (spanX <= 0 && spanY <= 0) return null;
  const minTrip = Math.min(HOUSE_SCENE.minTrip, Math.max(spanX, spanY) / 2);

  let fallback: { x: number; y: number } | null = null;
  for (let i = 0; i < HOUSE_SCENE.walkTries; i += 1) {
    const x = bounds.minX + clamp(rng(), 0, 0.999999) * spanX;
    const y = bounds.minY + clamp(rng(), 0, 0.999999) * spanY;
    fallback = { x, y };
    if (Math.hypot(x - from.x, y - from.y) >= minTrip) {
      return { x, y };
    }
  }
  return fallback;
}

/** 畫面上是否已經有一對在蹭蹭。 */
export function hasActiveNuzzle(actors: readonly HouseActor[]): boolean {
  return actors.some((a) => a.action === 'nuzzle');
}

/** 找距離小於門檻、目前空閒且最近的一隻蹭蹭對象；場上已有一對在蹭蹭時回 null。 */
export function findNuzzlePartner(
  actor: HouseActor,
  actors: readonly HouseActor[],
): HouseActor | null {
  if (hasActiveNuzzle(actors)) return null;
  let best: HouseActor | null = null;
  let bestDist: number = HOUSE_SCENE.nuzzle.dist;
  for (const other of actors) {
    if (other.id === actor.id) continue;
    if (other.action === 'walk' || other.action === 'nuzzle') continue;
    const dist = Math.hypot(actor.x - other.x, actor.y - other.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = other;
    }
  }
  return best;
}

/** 取得目前正在蹭蹭的那一對（沒有就回 null），供畫面在兩隻上方冒一顆 ♥。 */
export function activeNuzzlePair(actors: readonly HouseActor[]): NuzzlePair | null {
  for (const a of actors) {
    if (a.action !== 'nuzzle' || !a.partnerId) continue;
    const b = actors.find((other) => other.id === a.partnerId && other.action === 'nuzzle');
    if (b) {
      return { a, b, x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) };
    }
  }
  return null;
}

/** 初始化房間裡的小貓，均勻散在地板上，動作與剩餘時間錯開。 */
export function createInitialActors(
  catIds: readonly CatId[],
  bounds: RoomBounds,
  rng: () => number,
  options: HouseOptions = {},
): HouseActor[] {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const count = catIds.length;

  return catIds.map((id, idx) => {
    const slotCenter = count <= 1 ? 0.5 : (idx + 0.5) / count;
    const jitter = count <= 1 ? (clamp(rng(), 0, 1) - 0.5) * 0.2 : (clamp(rng(), 0, 1) - 0.5) * (0.5 / count);
    const x = clamp(bounds.minX + (slotCenter + jitter) * spanX, bounds.minX, bounds.maxX);
    const y = clamp(bounds.minY + clamp(rng(), 0, 0.999999) * spanY, bounds.minY, bounds.maxY);
    const action = pickWeighted(STATIONARY_ACTIONS, rng);
    const facing: 'left' | 'right' = rng() < 0.5 ? 'left' : 'right';
    const fullDur = between(HOUSE_SCENE.dur[action], rng);
    // 初次進房間錯開換動作的節奏，避免全部同時動
    const remainMs = options.reducedMotion ? fullDur : Math.round(fullDur * (0.4 + clamp(rng(), 0, 0.6)));
    return { id, x, y, facing, action, remainMs, hopMs: 0 };
  });
}

/** 新領養的小貓：起點在右邊門口，面向左走進房間（減少動態時停在門口附近坐著）。 */
export function createEnteringActor(
  id: CatId,
  bounds: RoomBounds,
  rng: () => number,
  options: HouseOptions = {},
): HouseActor {
  const door = doorPosition(bounds);
  if (options.reducedMotion) {
    return {
      id,
      x: door.x,
      y: door.y,
      facing: 'left',
      action: 'sit',
      remainMs: between(HOUSE_SCENE.dur.sit, rng),
      hopMs: 0,
    };
  }
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const ratio =
    HOUSE_SCENE.enterTargetRatio.min +
    clamp(rng(), 0, 0.999999) * (HOUSE_SCENE.enterTargetRatio.max - HOUSE_SCENE.enterTargetRatio.min);
  const tx = clamp(bounds.minX + ratio * spanX, bounds.minX, bounds.maxX);
  const ty = clamp(bounds.minY + clamp(rng(), 0, 0.999999) * spanY, bounds.minY, bounds.maxY);
  return {
    id,
    x: door.x,
    y: door.y,
    facing: 'left',
    action: 'walk',
    target: { x: tx, y: ty },
    remainMs: 0,
    hopMs: 0,
  };
}

/** 幫指定小貓挑下一個動作；可能跟靠近的另一隻一起進入蹭蹭（同時最多一對）。 */
export function decideNextAction(
  id: CatId,
  actors: readonly HouseActor[],
  bounds: RoomBounds,
  rng: () => number,
  options: HouseOptions = {},
): HouseActor[] {
  const next = actors.map((a) => ({ ...a }));
  const idx = next.findIndex((a) => a.id === id);
  if (idx === -1) return next;
  const me = next[idx]!;

  // 結束蹭蹭時，把對象也一起帶回一般靜止動作，避免單獨蹭蹭
  if (me.action === 'nuzzle' && me.partnerId) {
    const pIdx = next.findIndex((a) => a.id === me.partnerId);
    if (pIdx !== -1 && next[pIdx]!.action === 'nuzzle' && next[pIdx]!.partnerId === me.id) {
      next[pIdx] = {
        ...next[pIdx]!,
        action: 'sit',
        partnerId: undefined,
        target: undefined,
        remainMs: between(HOUSE_SCENE.dur.sit, rng),
      };
    }
    me.partnerId = undefined;
    me.action = 'sit';
  }

  // 減少動態：不走動、只坐／理毛／睡
  if (options.reducedMotion) {
    const picked = pickWeighted(STATIONARY_ACTIONS, rng);
    next[idx] = {
      ...me,
      action: picked,
      target: undefined,
      partnerId: undefined,
      remainMs: between(HOUSE_SCENE.dur[picked], rng),
    };
    return next;
  }

  // 檢查能不能跟附近的一隻蹭蹭（同時最多一對）
  const partner = findNuzzlePartner(me, next);
  if (partner && rng() < HOUSE_SCENE.nuzzle.chance) {
    const pIdx = next.findIndex((a) => a.id === partner.id);
    if (pIdx !== -1) {
      const dur = between(HOUSE_SCENE.dur.nuzzle, rng);
      const meLeft = me.x <= partner.x;
      next[idx] = {
        ...me,
        action: 'nuzzle',
        facing: meLeft ? 'right' : 'left',
        target: undefined,
        partnerId: partner.id,
        remainMs: dur,
      };
      next[pIdx] = {
        ...next[pIdx]!,
        action: 'nuzzle',
        facing: meLeft ? 'left' : 'right',
        target: undefined,
        partnerId: me.id,
        remainMs: dur,
      };
      return next;
    }
  }

  const picked = pickWeighted(ALL_ACTIONS, rng);
  if (picked === 'walk') {
    const target = pickFloorTarget(me, bounds, rng);
    if (target) {
      next[idx] = {
        ...me,
        action: 'walk',
        target,
        partnerId: undefined,
        remainMs: 0,
        facing: target.x === me.x ? me.facing : target.x < me.x ? 'left' : 'right',
      };
      return next;
    }
    // 空間太小走不動時改坐下
    next[idx] = {
      ...me,
      action: 'sit',
      target: undefined,
      partnerId: undefined,
      remainMs: between(HOUSE_SCENE.dur.sit, rng),
    };
    return next;
  }

  next[idx] = {
    ...me,
    action: picked,
    target: undefined,
    partnerId: undefined,
    remainMs: between(HOUSE_SCENE.dur[picked], rng),
  };
  return next;
}

/** 推進所有小貓的動作 dtMs 毫秒。 */
export function stepHouse(
  actors: readonly HouseActor[],
  dtMs: number,
  bounds: RoomBounds,
  rng: () => number,
  options: HouseOptions = {},
): HouseActor[] {
  const dt = Math.max(0, dtMs);
  const step = HOUSE_SCENE.walkSpeed * (dt / 1000);
  const finished: CatId[] = [];

  let next: HouseActor[] = actors.map((actor) => {
    const hopMs = Math.max(0, actor.hopMs - dt);
    if (actor.action === 'walk') {
      if (options.reducedMotion || !actor.target) {
        finished.push(actor.id);
        return { ...actor, hopMs, target: undefined, remainMs: 0 };
      }
      const dx = actor.target.x - actor.x;
      const dy = actor.target.y - actor.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= step || dist === 0) {
        finished.push(actor.id);
        return {
          ...actor,
          hopMs,
          x: clamp(actor.target.x, bounds.minX, bounds.maxX),
          y: clamp(actor.target.y, bounds.minY, bounds.maxY),
          target: undefined,
          remainMs: 0,
        };
      }
      return {
        ...actor,
        hopMs,
        x: actor.x + (dx / dist) * step,
        y: actor.y + (dy / dist) * step,
        facing: Math.abs(dx) > 0.5 ? (dx < 0 ? 'left' : 'right') : actor.facing,
      };
    }

    const remainMs = actor.remainMs - dt;
    if (remainMs <= 0) {
      finished.push(actor.id);
    }
    return { ...actor, hopMs, remainMs };
  });

  for (const id of finished) {
    const cur = next.find((a) => a.id === id);
    if (!cur) continue;
    // 如果剛才跟著蹭蹭對象一起換掉動作了，就不重複換
    if (cur.action !== 'walk' && cur.remainMs > 0) continue;
    next = decideNextAction(id, next, bounds, rng, options);
  }

  return next;
}

/** 同步房間裡的小貓清單與邊界：新增的從右邊門口走進來，既有的夾進新範圍。 */
export function syncActorsWithCats(
  actors: readonly HouseActor[],
  catIds: readonly CatId[],
  bounds: RoomBounds,
  rng: () => number,
  options: HouseOptions & { enteringId?: CatId | null } = {},
): HouseActor[] {
  const idSet = new Set(catIds);
  const door = doorPosition(bounds);
  const byId = new Map<CatId, HouseActor>();

  for (const actor of actors) {
    if (!idSet.has(actor.id)) continue;
    const enteringFromDoor = actor.action === 'walk' && actor.x > bounds.maxX;
    const maxAllowedX = enteringFromDoor ? Math.max(bounds.maxX, door.x) : bounds.maxX;
    const target = actor.target
      ? {
          x: clamp(actor.target.x, bounds.minX, bounds.maxX),
          y: clamp(actor.target.y, bounds.minY, bounds.maxY),
        }
      : undefined;
    const partnerAlive = actor.partnerId !== undefined && idSet.has(actor.partnerId);
    byId.set(actor.id, {
      ...actor,
      x: clamp(actor.x, bounds.minX, maxAllowedX),
      y: clamp(actor.y, bounds.minY, bounds.maxY),
      target,
      ...(actor.action === 'nuzzle' && !partnerAlive
        ? { action: 'sit', partnerId: undefined, remainMs: between(HOUSE_SCENE.dur.sit, rng) }
        : {}),
    });
  }

  return catIds.map((id) => {
    if (options.enteringId === id) {
      return createEnteringActor(id, bounds, rng, options);
    }
    const existing = byId.get(id);
    if (existing) return existing;
    return createEnteringActor(id, bounds, rng, options);
  });
}

/** 讓指定小貓跳一下（點牠選中時用）。 */
export function hopActor(actors: readonly HouseActor[], id: CatId): HouseActor[] {
  return actors.map((a) => (a.id === id ? { ...a, hopMs: HOUSE_SCENE.hopMs } : a));
}

/** 對應到 CatBody 的姿勢。 */
export function actorPose(actor: HouseActor): PetPose {
  if (actor.hopMs > 0) return 'hop';
  if (actor.action === 'walk') return 'walk';
  if (actor.action === 'groom') return 'groom';
  if (actor.action === 'loaf') return 'loaf';
  return 'sit';
}

/** 對應到 CatBody 的表情（未指定時照姿勢預設）。 */
export function actorMood(actor: HouseActor): CatMood | undefined {
  if (actor.hopMs > 0 || actor.action === 'nuzzle') return 'yay';
  return undefined;
}

/** 下一次畫面需要更新的方式：有貓在走或跳時用連續影格，全部靜止時等到最近一個動作結束。 */
export function nextTickDelayMs(actors: readonly HouseActor[]): number | null {
  if (actors.length === 0) return null;
  if (actors.some((a) => a.action === 'walk' || a.hopMs > 0)) return 0;
  let soonest = Infinity;
  for (const a of actors) {
    if (a.remainMs < soonest) soonest = a.remainMs;
  }
  return Number.isFinite(soonest) ? Math.max(50, Math.round(soonest)) : null;
}
