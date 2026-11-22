// 小屋房間動作邏輯（純函式，不碰 DOM）：位置範圍、走進門、下一個動作、蹭蹭配對、時段判斷、套裝步態與飛行／蹦跳高度。
// 數字只讀 constants/house.ts 的 HOUSE_SCENE、constants/cat.ts 的 CAT_DAY_PARTS 與 constants/pet.ts 的 PET_GAIT_DEFAULT／PET_PLAY。
import { CAT_DAY_PARTS } from '../../core/constants/cat';
import { HOUSE_SCENE } from '../../core/constants/house';
import { PET_FLOAT, PET_GAIT_DEFAULT, PET_PLAY, PET_ROCKET, PET_SLIME } from '../../core/constants/pet';
import { speedFactor } from '../pet/petLogic';
import type { CatId, CatMood, OutfitSpecial, PetGait, PetPose } from '../../core/types';

export type HouseAction = 'walk' | 'zoom' | 'fly' | 'hover' | 'sit' | 'groom' | 'loaf' | 'nuzzle';
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
  /** 移動目標；只有 action 為 walk／zoom／fly 時有值 */
  target?: { x: number; y: number };
  /** 移動起點；用於計算飛行拋物線與蹦跳步距 */
  origin?: { x: number; y: number };
  /** 靜止動作的剩餘時間（毫秒） */
  remainMs: number;
  /** 蹭蹭對象；只有 action === 'nuzzle' 時有值 */
  partnerId?: CatId;
  /** 點擊跳一下的剩餘時間（毫秒） */
  hopMs: number;
  /** 小鴨跟班（穿小鴨裝才有）：一隻跟著一隻排隊，位置是房間地板座標 */
  ducks?: HouseDuck[];
}

export interface HouseDuck {
  x: number;
  y: number;
  facing: 'left' | 'right';
  walking: boolean;
}

export interface HouseOptions {
  reducedMotion?: boolean;
  specials?: ReadonlyMap<CatId, ReadonlySet<OutfitSpecial>>;
}

export interface NuzzlePair {
  a: HouseActor;
  b: HouseActor;
  x: number;
  y: number;
}

type StationaryAction = 'sit' | 'groom' | 'loaf';
type MovingAction = 'walk' | 'zoom' | 'fly' | 'hover';
type PickableAction = 'walk' | StationaryAction | 'zoom';

const STATIONARY_ACTIONS: readonly StationaryAction[] = ['sit', 'groom', 'loaf'];
const ALL_ACTIONS: readonly PickableAction[] = ['walk', 'sit', 'groom', 'loaf', 'zoom'];

function isMovingAction(action: HouseAction): action is MovingAction {
  return action === 'walk' || action === 'zoom' || action === 'fly' || action === 'hover';
}

function actionWeight(action: PickableAction, specials?: ReadonlySet<OutfitSpecial>): number {
  const base = HOUSE_SCENE.weights[action];
  if (action === 'loaf' && specials?.has('dream')) {
    return base * HOUSE_SCENE.napBoost;
  }
  return base;
}

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

function pickWeighted<T extends PickableAction>(
  pool: readonly T[],
  rng: () => number,
  specials?: ReadonlySet<OutfitSpecial>,
): T {
  const total = pool.reduce((sum, a) => sum + actionWeight(a, specials), 0);
  if (total <= 0) return pool[0]!;
  let roll = clamp(rng(), 0, 0.999999) * total;
  for (const action of pool) {
    roll -= actionWeight(action, specials);
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

/** 暴衝、飛行的落點：房間另一側靠牆的這一段（佔地板寬度的比例） */
const FAR_SIDE_BAND = 0.2;

/** 挑房間另一側（離現在較遠的那一邊，地板範圍內）的目標；供暴衝與飛行使用。 */
function pickFarTarget(
  from: { x: number; y: number },
  bounds: RoomBounds,
  rng: () => number,
): { x: number; y: number } | null {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  if (spanX <= 0 && spanY <= 0) return null;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const band = spanX * FAR_SIDE_BAND;
  const goRight = from.x <= midX;
  const lowX = goRight
    ? Math.min(bounds.maxX, Math.max(bounds.maxX - band, from.x + spanX / 2))
    : bounds.minX;
  const highX = goRight
    ? bounds.maxX
    : Math.max(bounds.minX, Math.min(bounds.minX + band, from.x - spanX / 2));
  const x = clamp(lowX + clamp(rng(), 0, 0.999999) * Math.max(0, highX - lowX), bounds.minX, bounds.maxX);
  const y = clamp(bounds.minY + clamp(rng(), 0, 0.999999) * spanY, bounds.minY, bounds.maxY);
  return { x, y };
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
    if (isMovingAction(other.action) || other.action === 'nuzzle') continue;
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
    const action = pickWeighted(STATIONARY_ACTIONS, rng, options.specials?.get(id));
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
    origin: { x: door.x, y: door.y },
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
  const mySpecials = options.specials?.get(id);

  // 結束蹭蹭時，把對象也一起帶回一般靜止動作，避免單獨蹭蹭
  if (me.action === 'nuzzle' && me.partnerId) {
    const pIdx = next.findIndex((a) => a.id === me.partnerId);
    if (pIdx !== -1 && next[pIdx]!.action === 'nuzzle' && next[pIdx]!.partnerId === me.id) {
      next[pIdx] = {
        ...next[pIdx]!,
        action: 'sit',
        partnerId: undefined,
        target: undefined,
        origin: undefined,
        remainMs: between(HOUSE_SCENE.dur.sit, rng),
      };
    }
    me.partnerId = undefined;
    me.action = 'sit';
  }

  // 減少動態：不走動、不暴衝、不飛，只坐／理毛／睡
  if (options.reducedMotion) {
    const picked = pickWeighted(STATIONARY_ACTIONS, rng, mySpecials);
    next[idx] = {
      ...me,
      action: picked,
      target: undefined,
      origin: undefined,
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
        origin: undefined,
        partnerId: partner.id,
        remainMs: dur,
      };
      next[pIdx] = {
        ...next[pIdx]!,
        action: 'nuzzle',
        facing: meLeft ? 'left' : 'right',
        target: undefined,
        origin: undefined,
        partnerId: me.id,
        remainMs: dur,
      };
      return next;
    }
  }

  const picked = pickWeighted(ALL_ACTIONS, rng, mySpecials);
  if (picked === 'walk' || picked === 'zoom') {
    // 披風：飛過房間；天使翅膀：飛起來繞一小段再慢慢降落（都照 flyChance 擲一次）
    const flying = (mySpecials?.has('fly') || mySpecials?.has('glide')) && rng() < HOUSE_SCENE.flyChance;
    const action: MovingAction = flying ? (mySpecials?.has('fly') ? 'fly' : 'hover') : picked;
    const target = action === 'walk' ? pickFloorTarget(me, bounds, rng) : pickFarTarget(me, bounds, rng);
    if (target) {
      next[idx] = {
        ...me,
        action,
        target,
        origin: { x: me.x, y: me.y },
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
      origin: undefined,
      partnerId: undefined,
      remainMs: between(HOUSE_SCENE.dur.sit, rng),
    };
    return next;
  }

  next[idx] = {
    ...me,
    action: picked,
    target: undefined,
    origin: undefined,
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
  const finished: CatId[] = [];

  let next: HouseActor[] = actors.map((actor) => {
    const hopMs = Math.max(0, actor.hopMs - dt);
    if (isMovingAction(actor.action)) {
      if (options.reducedMotion || !actor.target) {
        finished.push(actor.id);
        return { ...actor, hopMs, target: undefined, origin: undefined, remainMs: 0 };
      }
      const mySpecials = options.specials?.get(actor.id);
      const speed =
        actor.action === 'zoom'
          ? HOUSE_SCENE.zoomSpeed
          : actor.action === 'fly'
            ? HOUSE_SCENE.flySpeed
            : actor.action === 'hover'
              ? HOUSE_SCENE.hoverSpeed
              : HOUSE_SCENE.walkSpeed;
      // 蝸牛殼慢吞吞、氣球飄著走稍慢、小火箭暴衝更快（倍數跟亂跑的小貓同一處）
      const factor =
        actor.action === 'walk' || actor.action === 'zoom' ? speedFactor(mySpecials ?? new Set(), actor.action === 'zoom') : 1;
      const step = speed * factor * (dt / 1000);
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
          origin: undefined,
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
    if (!isMovingAction(cur.action) && cur.remainMs > 0) continue;
    next = decideNextAction(id, next, bounds, rng, options);
  }

  return next.map((actor) => stepDucks(actor, Boolean(options.specials?.get(actor.id)?.has('ducklings')), dt));
}

/**
 * 小鴨跟班（小屋版）：一隻跟著一隻——每隻只追前面那隻（第一隻追小貓），離得比 HOUSE_SCENE.duck.gap 遠才走；
 * 不穿小鴨裝就拿掉。剛穿上時排在小貓背後。
 */
export function stepDucks(actor: HouseActor, wearing: boolean, dtMs: number): HouseActor {
  if (!wearing) return actor.ducks ? { ...actor, ducks: undefined } : actor;
  const { count, gap, speed } = HOUSE_SCENE.duck;
  const behind = actor.facing === 'right' ? -1 : 1;
  const prev = actor.ducks ?? Array.from({ length: count }, (_, i) => ({
    x: actor.x + behind * gap * (i + 1),
    y: actor.y,
    facing: actor.facing,
    walking: false,
  }));
  const step = speed * (Math.max(0, dtMs) / 1000);
  let leader = { x: actor.x, y: actor.y };
  const ducks = prev.map((d) => {
    const dx = leader.x - d.x;
    const dy = leader.y - d.y;
    const dist = Math.hypot(dx, dy);
    let moved = d;
    if (dist > gap) {
      const k = Math.min(step, dist - gap) / dist;
      moved = { x: d.x + dx * k, y: d.y + dy * k, facing: Math.abs(dx) > 0.5 ? (dx < 0 ? 'left' : 'right') : d.facing, walking: true };
    } else {
      moved = { ...d, facing: dx < 0 ? 'left' : 'right', walking: false };
    }
    leader = { x: moved.x, y: moved.y };
    return moved;
  });
  return { ...actor, ducks };
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

/** 對應到 CatBody 的姿勢（步態由 petLogic 的 gaitFor 決定）。 */
export function actorPose(actor: HouseActor, gait: PetGait = PET_GAIT_DEFAULT): PetPose {
  if (actor.hopMs > 0) return 'hop';
  if (actor.action === 'walk') return gait.walk;
  if (actor.action === 'zoom') return gait.zoom;
  if (actor.action === 'fly' || actor.action === 'hover') return 'fly';
  if (actor.action === 'groom') return 'groom';
  if (actor.action === 'loaf') return 'loaf';
  return gait.rest;
}

/** 計算小貓離地高度（px）：飛行時走拋物線（最高 HOUSE_SCENE.flyLift），蹦跳步態走路／暴衝時一蹦一蹦。 */
export function actorLift(
  actor: HouseActor,
  gait: PetGait = PET_GAIT_DEFAULT,
  specials?: ReadonlySet<OutfitSpecial>,
): number {
  const traveled = actor.origin ? Math.hypot(actor.x - actor.origin.x, actor.y - actor.origin.y) : 0;
  const total = actor.origin && actor.target ? Math.hypot(actor.target.x - actor.origin.x, actor.target.y - actor.origin.y) : 0;
  if (actor.action === 'fly') {
    if (total <= 0) return 0;
    const t = clamp(traveled / total, 0, 1);
    return 4 * t * (1 - t) * HOUSE_SCENE.flyLift;
  }
  if (actor.action === 'hover') {
    // 天使翅膀：很快飛到最高，剩下的路慢慢降落
    if (total <= 0) return 0;
    const t = clamp(traveled / total, 0, 1);
    const up = HOUSE_SCENE.hoverRise;
    return HOUSE_SCENE.flyLift * (t < up ? t / up : 1 - (t - up) / (1 - up));
  }
  if (specials?.has('float') && actor.action === 'walk' && total > 0) {
    // 氣球：飄著走，起步與停下都慢慢升降；飄的時候上下晃
    const ease = Math.min(1, traveled / HOUSE_SCENE.floatEase, (total - traveled) / HOUSE_SCENE.floatEase);
    const bob = Math.sin((traveled / HOUSE_SCENE.floatStride) * Math.PI * 2) * PET_FLOAT.bob;
    return Math.max(0, ease) * (PET_FLOAT.lift + bob);
  }
  if (gait.hop && (actor.action === 'walk' || actor.action === 'zoom')) {
    const dist = actor.origin
      ? Math.hypot(actor.x - actor.origin.x, actor.y - actor.origin.y)
      : Math.abs(actor.x);
    const phase = (dist % PET_PLAY.hop.stride) / PET_PLAY.hop.stride;
    return Math.sin(phase * Math.PI) * PET_PLAY.hop.lift;
  }
  return 0;
}

/** 對應到 CatBody 的表情（未指定時照姿勢預設）。 */
export function actorMood(actor: HouseActor): CatMood | undefined {
  if (actor.hopMs > 0 || actor.action === 'nuzzle') return 'yay';
  return undefined;
}

/** 下一次畫面需要更新的方式：有貓在移動（走／暴衝／飛）或跳時用連續影格，全部靜止時等到最近一個動作結束。 */
export function nextTickDelayMs(actors: readonly HouseActor[]): number | null {
  if (actors.length === 0) return null;
  if (actors.some((a) => isMovingAction(a.action) || a.hopMs > 0 || a.ducks?.some((d) => d.walking))) return 0;
  let soonest = Infinity;
  for (const a of actors) {
    if (a.remainMs < soonest) soonest = a.remainMs;
  }
  return Number.isFinite(soonest) ? Math.max(50, Math.round(soonest)) : null;
}

/** 小屋地板上留下的痕跡：蝸牛殼走過的亮晶晶的線、小火箭暴衝的煙圈（x、y＝房間地板座標，y 是小貓腳底那一排） */
export interface HouseMark {
  kind: 'trail' | 'puff';
  x: number;
  y: number;
}

/**
 * 這隻小貓現在要不要留一個痕跡（跟亂跑的小貓同一套數字：PET_SLIME.stride、PET_ROCKET.stride）：
 * 蝸牛殼走路時、小火箭暴衝時，離上一個痕跡（last）夠遠就留一個；煙圈留在屁股後面（behind＝離中心多遠）。
 */
export function houseMark(
  actor: HouseActor,
  specials: ReadonlySet<OutfitSpecial> | undefined,
  last: { x: number; y: number } | undefined,
  behind: number,
): HouseMark | null {
  const kind =
    actor.action === 'walk' && specials?.has('slime')
      ? 'trail'
      : actor.action === 'zoom' && specials?.has('rocket')
        ? 'puff'
        : null;
  if (!kind) return null;
  const stride = kind === 'trail' ? PET_SLIME.stride : PET_ROCKET.stride;
  if (last && Math.hypot(actor.x - last.x, actor.y - last.y) < stride) return null;
  const back = kind === 'puff' ? (actor.facing === 'right' ? -behind : behind) : 0;
  return { kind, x: actor.x + back, y: actor.y };
}
