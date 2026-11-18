// 自由亂跑的小貓：不碰 DOM 的計算（挑動作、挑落腳處、拋物線）。DOM 與動畫在 PetLayer。
import type { RoamBehavior } from '../../core/types';

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
