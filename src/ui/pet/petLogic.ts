// 自由亂跑的小貓：不碰 DOM 的計算（挑動作、挑落腳處、拋物線）。DOM 與動畫在 PetLayer。
import { PET_DUCK, PET_FLOAT, PET_GAITS, PET_GAIT_DEFAULT, PET_GLIDE, PET_ROCKET, PET_SLIME } from '../../core/constants/pet';
import type { Choice, OutfitSpecial, PetGait, RoamBehavior } from '../../core/types';

const BEHAVIORS: readonly RoamBehavior[] = ['walk', 'sit', 'groom', 'nap', 'perch', 'zoom'];
/** 她正在操作時只做原地的動作 */
const CALM: ReadonlySet<RoamBehavior> = new Set<RoamBehavior>(['sit', 'groom', 'nap']);

/**
 * 依權重挑下一個動作。calm＝她最近有操作，只挑原地的動作；
 * 不能用的動作（例如畫面上沒有卡片可以跳）傳在 unavailable。
 */
export function pickBehavior(
  weights: Readonly<Record<RoamBehavior, number>>,
  rng: () => number,
  options: { calm?: boolean; unavailable?: ReadonlySet<RoamBehavior> } = {},
): RoamBehavior {
  const pool = BEHAVIORS.filter(
    (b) => weights[b] > 0 && !options.unavailable?.has(b) && (!options.calm || CALM.has(b)),
  );
  if (pool.length === 0) return 'sit';
  const total = pool.reduce((sum, b) => sum + weights[b], 0);
  let roll = rng() * total;
  for (const b of pool) {
    roll -= weights[b];
    if (roll < 0) return b;
  }
  return pool[pool.length - 1] ?? 'sit';
}

/**
 * 目前不能挑的動作：在地面且畫面上沒有卡片時不能跳上去；
 * 在卡片上時不能暴衝，但保留 perch（代表跳回地面）。
 */
export function roamUnavailable(surface: 'floor' | 'perch', perchCount: number): Set<RoamBehavior> {
  const out = new Set<RoamBehavior>();
  if (surface === 'perch') out.add('zoom');
  else if (perchCount <= 0) out.add('perch');
  return out;
}

/** 這身穿著走路的樣子：PET_GAITS 裡第一個符合的，都不符合就是平常的步態 */
export function gaitFor(specials: ReadonlySet<OutfitSpecial>): PetGait {
  return PET_GAITS.find(({ when }) => specials.has(when))?.gait ?? PET_GAIT_DEFAULT;
}

/** 範圍內隨機（含下限、不含上限） */
export function between(range: { min: number; max: number }, rng: () => number): number {
  return range.min + rng() * (range.max - range.min);
}

/**
 * 挑一個走路目標 x：在 [min, max] 內、離現在至少 minTrip，而且腳下沒有按鈕（blocked 回 false）。
 * 試幾次都不行就回 null（原地待著）。
 */
export function pickWalkTarget(
  from: number,
  min: number,
  max: number,
  minTrip: number,
  rng: () => number,
  blocked: (x: number) => boolean,
  tries = 8,
): number | null {
  if (max <= min) return null;
  for (let i = 0; i < tries; i += 1) {
    const x = min + rng() * (max - min);
    if (Math.abs(x - from) < Math.min(minTrip, (max - min) / 2)) continue;
    if (!blocked(x)) return x;
  }
  return null;
}

/** 拋物線跳躍：t 從 0 到 1，lift＝比兩端較高者再高出多少 */
export function jumpPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  lift: number,
  t: number,
): { x: number; y: number } {
  const k = Math.min(1, Math.max(0, t));
  const peak = Math.min(from.y, to.y) - lift;
  // 二次貝茲：起點 → 控制點（中間、最高處上方）→ 終點
  const cx = (from.x + to.x) / 2;
  const cy = 2 * peak - (from.y + to.y) / 2;
  const u = 1 - k;
  return {
    x: u * u * from.x + 2 * u * k * cx + k * k * to.x,
    y: u * u * from.y + 2 * u * k * cy + k * k * to.y,
  };
}

/**
 * 走一步：從 x 往 to 走 speed×dt，不超過 to。回傳新的 x 和有沒有走到。
 */
export function stepWalk(x: number, to: number, speed: number, dt: number): { x: number; arrived: boolean } {
  const gap = to - x;
  const step = speed * dt;
  if (Math.abs(gap) <= step) return { x: to, arrived: true };
  return { x: x + Math.sign(gap) * step, arrived: false };
}

/**
 * 站在卡片上時，小貓的 x 只由「離卡片左緣多遠」（dx）決定：卡片跟著頁面動，小貓跟著卡片動。
 * 在卡片上走路後要用這個把走到的位置寫回 dx，否則下一個原地動作會被拉回剛跳上來的那一點。
 */
export function perchOffset(x: number, perchLeft: number): number {
  return x - perchLeft;
}

/** 把 v 限制在 [min, max]（max < min 時回 min） */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

/**
 * 想太久的提示要等多久（毫秒）：看題目和選項的字數，字多等久一點，落在 [minMs, maxMs]。
 */
export function hintDelay(
  chars: number,
  rng: () => number,
  spec: { minMs: number; maxMs: number; msPerChar: number; jitter: number },
): number {
  const base = spec.minMs + Math.max(0, chars) * spec.msPerChar;
  const wobble = 1 + (rng() * 2 - 1) * spec.jitter;
  return Math.round(clamp(base * wobble, spec.minMs, spec.maxMs));
}

/**
 * 小貓猜哪個選項：chance 的機率猜正確答案，不然從錯的裡面挑一個。
 * 沒有錯的選項（或沒有對的）時就只能從有的那一邊挑；選項是空的回 null。
 */
export function pickHint(
  order: readonly Choice[],
  answer: readonly Choice[],
  rng: () => number,
  chance: number,
): { choice: Choice; right: boolean } | null {
  const rights = order.filter((c) => answer.includes(c));
  const wrongs = order.filter((c) => !answer.includes(c));
  const wantRight = rng() < chance;
  const right = rights.length > 0 && (wantRight || wrongs.length === 0);
  const pool = right ? rights : wrongs;
  const choice = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  return choice ? { choice, right } : null;
}

/**
 * 披風飛行要給 jumpPoint 的 lift：從地面飛到地面是一道高出 lift 的弧線；
 * 從高處（卡片上）飛下來則是先平飛再滑下去，不往上衝（jumpPoint 的控制點落在起點的高度），免得飛出畫面上緣。
 */
export function flyLift(fromY: number, toY: number, lift: number): number {
  const drop = toY - fromY;
  return drop > lift ? -drop / 4 : lift;
}

// ── 鴨子裝與背飾單件的特效（docs/plans/back-specials.md；數字在 PET_DUCK、PET_GLIDE、PET_FLOAT、PET_SLIME、PET_ROCKET）──

/** 走路速度的倍數：蝸牛殼慢吞吞、氣球飄著走稍慢；暴衝時小火箭再加速 */
export function speedFactor(specials: ReadonlySet<OutfitSpecial>, zoom: boolean): number {
  let k = 1;
  if (specials.has('slime')) k *= PET_SLIME.speed;
  if (specials.has('float')) k *= PET_FLOAT.speed;
  if (zoom && specials.has('rocket')) k *= PET_ROCKET.speed;
  return k;
}

/** 往下掉最快多快（px／秒）：氣球最慢、翅膀其次；都沒有就不設限 */
export function fallCap(specials: ReadonlySet<OutfitSpecial>): number {
  if (specials.has('float')) return PET_FLOAT.maxVy;
  if (specials.has('glide')) return PET_GLIDE.maxVy;
  return Number.POSITIVE_INFINITY;
}

/** 掉下來落地時要不要踉蹌：慢慢飄下來的（翅膀、氣球）直接站好 */
export function landsSoftly(specials: ReadonlySet<OutfitSpecial>): boolean {
  return specials.has('glide') || specials.has('float');
}

/** 氣球飄著走時離地多高（px）：基本高度加上慢慢的上下飄；t＝毫秒 */
export function floatHeight(t: number): number {
  return PET_FLOAT.lift + Math.sin((t / PET_FLOAT.bobMs) * Math.PI * 2) * PET_FLOAT.bob;
}

/** 翅膀緩降時左右晃多少（px）；t＝毫秒 */
export function glideSway(t: number): number {
  return Math.sin((t / PET_GLIDE.swayMs) * Math.PI * 2) * PET_GLIDE.sway;
}

/**
 * 記下小貓走過的位置（只記 x：小鴨走在地面）：跟最後一點差 step 以上才記，最多留 PET_DUCK.trail 點。回傳新的陣列。
 */
export function pushTrail(trail: readonly number[], x: number, step: number): number[] {
  const last = trail[trail.length - 1];
  if (last !== undefined && Math.abs(x - last) < step) return trail as number[];
  const next = [...trail, x];
  return next.length > PET_DUCK.trail ? next.slice(next.length - PET_DUCK.trail) : next;
}

/**
 * 小鴨排隊的位置：第 i 隻（從 1 起）沿著走過的路往回量 i × gap；路不夠長時排在小貓背後（behind＝背後那一側：-1 左、1 右）。
 * catX＝小貓現在的中心 x
 */
export function ducklingTargets(trail: readonly number[], catX: number, count: number, gap: number, behind: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    const want = i * gap;
    let walked = 0;
    let prev = catX;
    let found: number | null = null;
    for (let k = trail.length - 1; k >= 0; k -= 1) {
      const p = trail[k] as number;
      const d = Math.abs(prev - p);
      if (walked + d >= want) {
        const left = want - walked;
        found = prev + Math.sign(p - prev) * left;
        break;
      }
      walked += d;
      prev = p;
    }
    out.push(found ?? catX + behind * want);
  }
  return out;
}
