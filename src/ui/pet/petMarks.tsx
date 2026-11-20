// 小貓搗蛋留在卡片上的痕跡（老虎的爪痕、企鵝的冰）：只是裝飾，畫在卡片的邊緣外面或邊上，不蓋住卡片的內容、不擋點擊。
// 卡通畫法（2026-11-20 查的教學）：爪痕＝三道兩頭尖、中間粗、微彎的刀口（深色刀口、淺色描邊，深淺卡片上都看得到）；
// 冰柱＝一條相連的彎曲上緣、長短不一互相交疊的尖 V、底下一滴水；雪＝沿著邊緣堆起來的不規則圓弧。
// 位置與存活時間在 constants/pet.ts（PET_POUNCE、PET_SLIDE），PetLayer 把它們釘在卡片上。
import type { ReactNode } from 'react';

const LINE = 'var(--cat-line)';
const n1 = (v: number) => Math.round(v * 10) / 10;

/** 每次畫都一樣的「隨機」：同一個痕跡重畫不會閃 */
function wobble(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 爪痕的圖：w、h＝圖的大小；rise＝圖的上緣在卡片上緣上面多少（刀口從卡片的上緣劃下來，大半落在卡片上）；
 * slashes＝三道刀口的位置（x、往下錯開多少、長度）；bulge＝刀口中間鼓多寬；lean＝整組往前倒幾度
 */
export const CLAW_MARK = {
  w: 46,
  h: 40,
  rise: 3,
  slashes: [
    [10, 4, 30],
    [23, 0, 36],
    [36, 4, 30],
  ],
  bulge: 17,
  lean: 14,
} as const;

/** 一道刀口：從 (x, y) 往下 len，兩頭尖、中間往右鼓 */
function slash(x: number, y: number, len: number): ReactNode {
  const drift = len * 0.2;
  const mid = x - drift / 2;
  const b = CLAW_MARK.bulge;
  const end = `${n1(x - drift)} ${n1(y + len)}`;
  return (
    <g key={x}>
      <path d={`M${x} ${y} Q${n1(mid + b)} ${n1(y + len / 2)} ${end} Q${n1(mid + b * 0.25)} ${n1(y + len / 2)} ${x} ${y} Z`} fill="var(--acc-shade)" stroke="var(--acc-cream)" strokeWidth="1.2" strokeLinejoin="round" />
    </g>
  );
}

/** 老虎的爪痕：三道刀口，上緣的中間對準前腳 */
export function ClawMark() {
  const { w, h, slashes, lean } = CLAW_MARK;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
      <g transform={`rotate(${lean} ${w / 2} ${h / 2})`}>{slashes.map(([x, y, len]) => slash(x, y, len))}</g>
    </svg>
  );
}

/**
 * 冰的畫法：cap＝卡片上緣的雪堆（rise＝堆多高、every＝圓弧多寬、drip＝邊上垂下來的雪滴多長）；
 * icicles＝下緣的冰柱（every＝間距、w＝寬、min／max＝長短）；兩者都從卡片圓角的 inset 成處開始，不壓在圓角上
 */
export const FROST_MARK = {
  inset: 0.7,
  cap: { rise: 11, every: 34, drip: 8 },
  icicles: { every: 16, w: 14, min: 9, max: 24, gap: 0.25, band: 2.5 },
  sparkle: 5,
} as const;

/** 上緣的雪堆：底線是卡片上緣（y＝rise），上面一團團圓弧，邊上偶爾垂一滴 */
function snowCap(width: number, inset: number, seed: number): string {
  const { rise, every, drip } = FROST_MARK.cap;
  const left = inset;
  const right = width - inset;
  const count = Math.max(1, Math.round((right - left) / every));
  const step = (right - left) / count;
  let d = `M${n1(left)} ${rise}`;
  for (let i = 0; i < count; i += 1) {
    const x = left + step * (i + 1);
    // 中間堆得高、兩端低（像屋頂上的雪）
    const envelope = 0.5 + 0.5 * Math.sin((Math.PI * (i + 0.5)) / count);
    const h = rise * (0.45 + 0.55 * wobble(seed, i)) * envelope;
    d += ` Q${n1(x - step / 2)} ${n1(rise - h * 2)} ${n1(x)} ${n1(i === count - 1 ? rise : rise - h * 0.25)}`;
  }
  // 底線往回走，經過幾滴垂下來的雪
  for (let i = count - 1; i >= 0; i -= 1) {
    const x = left + step * (i + 0.5);
    if (wobble(seed, i + 50) > 0.6) {
      const len = drip * (0.5 + 0.5 * wobble(seed, i + 90));
      d += ` L${n1(x + 4)} ${rise} Q${n1(x + 4.5)} ${n1(rise + len)} ${n1(x)} ${n1(rise + len)} Q${n1(x - 4.5)} ${n1(rise + len)} ${n1(x - 4)} ${rise}`;
    }
  }
  return `${d} L${n1(left)} ${rise} Z`;
}

/**
 * 下緣的冰：一條貼著卡片下緣、下緣起伏的冰邊（band），冰柱從它底下垂下來；
 * 冰柱長短落差大、偶爾空一格（gap＝空格的機率），尖端微微歪。回傳冰邊、冰柱、每根左邊的亮線、最長那根的尖端
 */
function icicles(width: number, inset: number, seed: number): { band: string; body: string; shine: string; tip: { x: number; y: number } } {
  const { every, w, min, max, gap, band: bandH } = FROST_MARK.icicles;
  const left = inset;
  const right = width - inset;
  let body = '';
  let shine = '';
  let tip = { x: width / 2, y: 0 };
  for (let x = left + w / 2, i = 0; x + w / 2 <= right; x += every, i += 1) {
    if (wobble(seed, i + 400) < gap) continue;
    const len = min + (max - min) * wobble(seed, i + 200);
    const bend = (wobble(seed, i + 300) - 0.5) * 3;
    body += `M${n1(x - w / 2)} 0 Q${n1(x - w / 5)} ${n1(len * 0.55)} ${n1(x + bend)} ${n1(len)} Q${n1(x + w / 5)} ${n1(len * 0.55)} ${n1(x + w / 2)} 0 Z `;
    shine += `M${n1(x - w / 4)} ${bandH + 1} L${n1(x - w / 10 + bend / 2)} ${n1(len * 0.55)} `;
    if (len > tip.y) tip = { x: x + bend, y: len };
  }
  // 冰邊：上緣貼著卡片下緣，下緣一段段往下鼓
  let band = `M${n1(left)} -1 L${n1(right)} -1 L${n1(right)} ${bandH}`;
  const bumps = Math.max(1, Math.round((right - left) / every));
  const step = (right - left) / bumps;
  for (let i = bumps - 1; i >= 0; i -= 1) {
    band += ` Q${n1(left + step * (i + 0.5))} ${n1(bandH * 2.2)} ${n1(left + step * i)} ${bandH}`;
  }
  return { band: `${band} Z`, body, shine, tip };
}

/** 四角星（雪堆上的一閃） */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.3;
  return `M${n1(x)} ${n1(y - r)} Q${n1(x + k)} ${n1(y - k)} ${n1(x + r)} ${n1(y)} Q${n1(x + k)} ${n1(y + k)} ${n1(x)} ${n1(y + r)} Q${n1(x - k)} ${n1(y + k)} ${n1(x - r)} ${n1(y)} Q${n1(x - k)} ${n1(y - k)} ${n1(x)} ${n1(y - r)} Z`;
}

/** 企鵝的冰：上緣堆雪、下緣掛冰柱、冰柱尖端滴一滴水；卡片中間什麼都不畫 */
export function FrostMark({ width, height, radius, seed }: { width: number; height: number; radius: number; seed: number }) {
  const inset = radius * FROST_MARK.inset;
  const { rise, drip } = FROST_MARK.cap;
  const ice = icicles(width, inset, seed);
  const capH = rise + drip;
  return (
    <>
      <svg className="cb-pet-snowcap" width={width} height={capH} viewBox={`0 0 ${n1(width)} ${capH}`} style={{ top: -rise }} overflow="visible">
        <path d={snowCap(width, inset, seed)} fill="var(--acc-cream)" stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" />
        <path d={sparkle(width - inset - 2, 0, FROST_MARK.sparkle)} fill="var(--acc-sky)" stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
      <svg
        className="cb-pet-icicles"
        width={width}
        height={FROST_MARK.icicles.max + 6}
        viewBox={`0 0 ${n1(width)} ${FROST_MARK.icicles.max + 6}`}
        style={{ top: height }}
        overflow="visible"
      >
        <path d={ice.body} fill="var(--acc-sky)" stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />
        <path d={ice.band} fill="var(--acc-sky)" stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />
        <path d={ice.shine} fill="none" stroke="var(--acc-cream)" strokeWidth="1.4" strokeLinecap="round" />
        <ellipse className="cb-pet-drop" cx={n1(ice.tip.x)} cy={n1(ice.tip.y + 3)} rx="1.4" ry="1.9" fill="var(--acc-sky)" stroke={LINE} strokeWidth="0.8" />
      </svg>
    </>
  );
}
