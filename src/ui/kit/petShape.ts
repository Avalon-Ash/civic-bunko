// 小貓身體的幾何（純計算，不碰 React）：身體輪廓、背上的花色、腿的輪廓。CatBody 照它畫，petShape.test.ts 照它檢查。
import { PET_BACK_EASE, PET_LEG_W, PET_PAW_H, PET_SADDLE } from '../../core/constants/pet';
import type { PetBuild, PetPoseSpec } from '../../core/types';

/** 貝茲曲線近似四分之一圓的把手長度 */
const ARC = 0.5523;
export const r2 = (n: number) => Math.round(n * 100) / 100;

export type Pt = readonly [number, number];
export type Cubic = readonly [Pt, Pt, Pt, Pt];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** 三次貝茲曲線切一刀：回傳 t 之前、t 之後兩段 */
function split(c: Cubic, t: number): [Cubic, Cubic] {
  const ab = lerp(c[0], c[1], t);
  const bc = lerp(c[1], c[2], t);
  const cd = lerp(c[2], c[3], t);
  const abc = lerp(ab, bc, t);
  const bcd = lerp(bc, cd, t);
  const mid = lerp(abc, bcd, t);
  return [
    [c[0], ab, abc, mid],
    [mid, bcd, cd, c[3]],
  ];
}
const pt = (p: Pt) => `${r2(p[0])} ${r2(p[1])}`;
const curveTo = (c: Cubic) => `C${pt(c[1])} ${pt(c[2])} ${pt(c[3])}`;

/**
 * 身體的形狀（以身體中心為原點、+x 朝脖子、-y 是背、+y 是肚子）：
 * outline＝輪廓。屁股那端比胸口厚，背線從肩膀滑到屁股，肚子那側比背厚（下垂）；
 * 站著是一顆豆子，正面坐著是直立、下大上小的蛋形，趴著時兩端可以收成方角。
 * saddle＝背上的花色：上緣直接取輪廓背側的那幾段、下緣的控制點都在輪廓內，所以它一定貼著身體，不靠剪裁。
 * curves＝同樣兩條線的貝茲曲線段（給測試取樣）。
 */
export function torsoShape(
  torso: PetPoseSpec['torso'],
  build: PetBuild,
): { outline: string; saddle: string; curves: { outline: readonly Cubic[]; saddle: readonly Cubic[] } } {
  const { rx, ry } = torso;
  const { chest, shoulder, hip, belly, flat, patch } = build;
  /** 屁股那端的圓角：0＝正圓弧，越大越方 */
  const k = ARC + flat * (1 - ARC);
  const neck: Pt = [rx, 0];
  const shoulderBack: Pt = [rx - shoulder, -chest];
  const hipBack: Pt = [-rx + hip, -ry];
  const rump: Pt = [-rx, 0];
  const hipBelly: Pt = [-rx + hip, ry * belly];
  const chestBelly: Pt = [rx - shoulder, chest * belly];
  const span = (shoulderBack[0] - hipBack[0]) * PET_BACK_EASE;

  const neckToShoulder: Cubic = [neck, [rx, -chest * ARC], [shoulderBack[0] + shoulder * ARC, -chest], shoulderBack];
  const back: Cubic = [shoulderBack, [shoulderBack[0] - span, -chest], [hipBack[0] + span, -ry], hipBack];
  const hipToRump: Cubic = [hipBack, [hipBack[0] - hip * k, -ry], [-rx, -ry * k], rump];
  const rumpToBelly: Cubic = [rump, [-rx, ry * belly * k], [hipBelly[0] - hip * k, hipBelly[1]], hipBelly];
  const bellyLine: Cubic = [hipBelly, [hipBelly[0] + span, hipBelly[1]], [chestBelly[0] - span, chestBelly[1]], chestBelly];
  const chestToNeck: Cubic = [chestBelly, [chestBelly[0] + shoulder * ARC, chestBelly[1]], [rx, chestBelly[1] * ARC], neck];
  const around: readonly Cubic[] = [neckToShoulder, back, hipToRump, rumpToBelly, bellyLine, chestToNeck];
  const path = around.map(curveTo).join('');

  const fromNeck = split(neckToShoulder, PET_SADDLE.front)[1];
  const toRump = split(hipToRump, PET_SADDLE.rear)[0];
  const start = fromNeck[0];
  const end = toRump[3];
  /** 下緣：從屁股那端往回彎到脖子那端，垂到屁股半厚的幾成（體型決定） */
  const sag = ry * patch;
  const lower: Cubic = [end, [end[0] + rx * PET_SADDLE.easeRear, sag], [start[0] - rx * PET_SADDLE.easeFront, sag], start];
  return {
    outline: `M${pt(neck)}${path}Z`,
    saddle: `M${pt(start)}${curveTo(fromNeck)}${curveTo(back)}${curveTo(toRump)}${curveTo(lower)}Z`,
    curves: { outline: around, saddle: [fromNeck, back, toRump, lower] },
  };
}

/**
 * 一條腿的輪廓（原點在腿根、+y 往下）：短短胖胖的腿，底下是圓腳掌。toe＝腳掌往前（+x）多伸多少；正面坐時腳掌朝你，給 0。
 * 近側的腿上端不封口，跟身體接在一起；遠側的腿畫在身體後面，上端收成圓頭（從身體邊緣露出來時才有肩膀）。
 */
export function legPath(len: number, capped: boolean, toe: number): string {
  const w = PET_LEG_W / 2;
  const pawTop = Math.max(0, len - PET_LEG_W * PET_PAW_H);
  const heel = Math.max(0, len - w);
  const front = w + toe;
  return [
    `M${-w} 0`,
    `L${-w} ${r2(heel)}`,
    `Q${-w} ${len} 0 ${len}`,
    `L${toe} ${len}`,
    `Q${r2(front)} ${len} ${r2(front)} ${r2((len + pawTop) / 2)}`,
    `Q${r2(front)} ${r2(pawTop)} ${w} ${r2(pawTop)}`,
    `L${w} 0`,
    capped ? `A${w} ${w} 0 0 0 ${-w} 0Z` : '',
  ].join('');
}

/**
 * 正面坐的體型：身體一定左右對稱（背那側的花色、布面沿脊椎鏡像到另一側再畫一次，對稱才會落在輪廓裡），
 * 所以肚子那側和背那側一樣厚，不讀體型的 belly。
 */
export function frontalBuild(build: PetBuild): PetBuild {
  return { ...build, belly: 1 };
}
