import { useId, type ReactNode } from 'react';
import {
  BACKDROP_ORIGIN,
  HEAD_ORIGIN,
  PET_BACKDROP,
  PET_BACK_EASE,
  PET_HEAD_SCALE,
  PET_LEG_W,
  PET_LINE_W,
  PET_PAW_H,
  PET_PAW_TOE,
  PET_POSES,
  PET_SADDLE,
  PET_TAIL_W,
  PET_VIEW_H,
  PET_VIEW_W,
  type PetBuild,
} from '../../core/constants/pet';
import { SLOTS } from '../../core/constants/wardrobe';
import type { Outfit, PetAnchor, PetLeg, PetPose, PetPoseSpec } from '../../core/types';
import { CatHead, furClass, type CatMood } from './Cat';
import { ITEM_ART, type BodyArt, type BodyGeom } from './wardrobe/art';

export interface CatBodyProps {
  pose: PetPose;
  outfit: Outfit;
  /** 不給就用姿勢預設的表情 */
  mood?: CatMood;
  facing?: 'left' | 'right';
  /** 顯示寬度（px） */
  width?: number;
  className?: string;
  /** 畫背景配件（坐墊、月亮…）：試衣間要；出來亂跑時不要（背景跟著貓跑很怪） */
  backdrop?: boolean;
}

/** 對位點 → SVG transform：把零件的原點 (ox, oy) 放到 anchor 上 */
function place(a: PetAnchor, ox: number, oy: number): string {
  return `translate(${a.x} ${a.y}) rotate(${a.rot}) scale(${a.scale}) translate(${-ox} ${-oy})`;
}

const LINE = 'var(--cat-line)';
const outline = {
  fill: 'none',
  stroke: LINE,
  strokeWidth: PET_LINE_W,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
/** 貝茲曲線近似四分之一圓的把手長度 */
const ARC = 0.5523;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Pt = readonly [number, number];
type Cubic = readonly [Pt, Pt, Pt, Pt];
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
 * 站著是一顆豆子，坐著（身體直起來）是下大上小的梨形，屁股那端可以壓平貼地。
 * saddle＝背上的花色：上緣直接取輪廓背側的那幾段、下緣的控制點都在輪廓內，所以它一定貼著身體，不靠剪裁。
 */
function torsoShape(torso: PetPoseSpec['torso'], build: PetBuild): { outline: string; saddle: string } {
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
  const path = [neckToShoulder, back, hipToRump, rumpToBelly, bellyLine, chestToNeck].map(curveTo).join('');

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
  };
}

/**
 * 一條腿的輪廓（原點在腿根、+y 往下）：短短胖胖的腿，底下是往前伸一點的圓腳掌。
 * 近側的腿上端不封口，跟身體接在一起；遠側的腿畫在身體後面，上端收成圓頭（從身體邊緣露出來時才有肩膀）。
 */
function legPath(len: number, capped: boolean): string {
  const w = PET_LEG_W / 2;
  const pawTop = Math.max(0, len - PET_LEG_W * PET_PAW_H);
  const heel = Math.max(0, len - w);
  const front = w + PET_PAW_TOE;
  return [
    `M${-w} 0`,
    `L${-w} ${r2(heel)}`,
    `Q${-w} ${len} 0 ${len}`,
    `L${PET_PAW_TOE} ${len}`,
    `Q${r2(front)} ${len} ${r2(front)} ${r2((len + pawTop) / 2)}`,
    `Q${r2(front)} ${r2(pawTop)} ${w} ${r2(pawTop)}`,
    `L${w} 0`,
    capped ? `A${w} ${w} 0 0 0 ${-w} 0Z` : '',
  ].join('');
}

function Leg({ leg, index, far, sleeve }: { leg: PetLeg; index: number; far: boolean; sleeve: ReactNode }) {
  if (leg.len <= 0) return null;
  const d = legPath(leg.len, far);
  return (
    <g transform={`translate(${leg.x} ${leg.y}) rotate(${leg.rot})`}>
      <g className={`cb-pet-leg cb-pet-leg-${index}`}>
        <path d={far ? d : `${d}Z`} fill={far ? 'var(--cat-fur-far)' : 'var(--cat-fur)'} />
        <path d={d} {...outline} />
        {sleeve}
      </g>
    </g>
  );
}

/** 穿著裡有「身體版」圖的配件，照 SLOTS 的圖層順序排好 */
function bodyArts(outfit: Outfit): Array<{ slot: string; art: BodyArt; motion?: string }> {
  const list: Array<{ slot: string; art: BodyArt; motion?: string }> = [];
  for (const slot of SLOTS) {
    const id = outfit[slot.id];
    const art = id ? ITEM_ART[id] : undefined;
    if (art && art.kind === 'layer' && art.onBody) list.push({ slot: slot.id, art: art.onBody, motion: art.motion });
  }
  return list;
}

/**
 * 有身體的小貓（大頭朝前、身體圓滾滾、腿短短的）。照 PET_POSES 的姿勢資料畫：
 * 頭沿用 CatHead（含頭上、臉上、頸部的配件），接在姿勢的頭對位點；
 * 有身體版圖的配件（衣服、披風、翅膀、氣球）照 art.tsx 的 onBody 穿到身體上，沒有的照頭像的圖接在背上。
 */
export function CatBody({ pose, outfit, mood, facing = 'right', width = 72, className = '', backdrop = false }: CatBodyProps) {
  const spec = PET_POSES[pose];
  const worn = bodyArts(outfit);
  const backId = outfit.back;
  const backArt = backId ? ITEM_ART[backId] : undefined;
  const bgId = backdrop ? outfit.bg : undefined;
  const bgArt = bgId ? ITEM_ART[bgId] : undefined;
  const { torso, build } = spec;
  const shape = torsoShape(torso, build);
  /** 給衣服看的身體尺寸：衣服照它長，換姿勢、改體型都會跟著身體 */
  const geom: BodyGeom = {
    len: torso.rx * 2,
    back: torso.ry,
    belly: torso.ry * build.belly,
    chest: build.chest,
    shoulder: build.shoulder,
    hip: build.hip,
  };
  /**
   * 衣服的剪裁框 id：每隻貓自己一個（useId），再加上姿勢（一個姿勢一種身體形狀）。
   * 只用 useId 的話，分開渲染的貓（看圖頁、不同的 React 樹）會撞同一個 id、拿到別隻貓的輪廓；加上姿勢後就算撞了也是同一個形狀。
   */
  const clip = `${useId()}cb-torso-${pose}`;
  /** 身體的座標：原點在身體中心、+x 朝脖子 */
  const torsoFrame = `translate(${torso.cx} ${torso.cy}) rotate(${torso.rot})`;
  /** 衣服的座標：原點在脖子那端、+x 朝前（衣服從脖子往後穿） */
  const neckFrame = `translate(${torso.rx} 0)`;
  const sleeves = worn.map(({ slot, art }) => (art.sleeve ? <g key={slot}>{art.sleeve}</g> : null));
  const sleeve = worn.some(({ art }) => art.sleeve) ? sleeves : null;

  return (
    <svg
      width={width}
      height={(width * PET_VIEW_H) / PET_VIEW_W}
      viewBox={`0 0 ${PET_VIEW_W} ${PET_VIEW_H}`}
      overflow="visible"
      aria-hidden="true"
      className={`cb-pet-svg ${furClass(outfit)} ${className}`.trim()}
    >
      {/* 面向左＝整張圖沿身體座標的中線翻面。翻面單獨放在外層：動作的 CSS 動畫（transform、fill-box 支點）掛在內層，
          兩者放同一個元素時，翻面會以外框左上角為支點（整隻貓偏掉、靠邊被切），被拎著時還會被動畫蓋掉 */}
      <g transform={facing === 'left' ? `translate(${PET_VIEW_W} 0) scale(-1 1)` : undefined}>
        <g className={`cb-pet cb-pet-motion-${spec.motion}`}>
          {bgArt && bgArt.kind === 'layer' ? (
            bgArt.stage ? (
              <g className="cb-slot cb-slot-bg">{bgArt.stage}</g>
            ) : (
              <g transform={place(PET_BACKDROP, BACKDROP_ORIGIN.x, BACKDROP_ORIGIN.y)} className="cb-slot cb-slot-bg">
                {bgArt.node}
              </g>
            )
          ) : null}

          {worn.map(({ slot, art, motion }) =>
            art.behind ? (
              <g key={slot} transform={place(spec.back, 0, 0)} className="cb-pet-back">
                <g className={motion ? `cb-pet-onback-${motion}` : undefined}>{art.behind}</g>
              </g>
            ) : null,
          )}
          {backArt && backArt.kind === 'layer' && !backArt.onBody ? (
            <g
              transform={place({ ...spec.back, scale: spec.back.scale * PET_HEAD_SCALE }, HEAD_ORIGIN.x, HEAD_ORIGIN.y)}
              className="cb-pet-back"
            >
              {backArt.node}
            </g>
          ) : null}

          <g className="cb-pet-tail">
            <path d={spec.tail} {...outline} strokeWidth={PET_TAIL_W + PET_LINE_W * 2} />
            <path d={spec.tail} fill="none" stroke="var(--cat-patch)" strokeWidth={PET_TAIL_W} strokeLinecap="round" />
          </g>

          <g className="cb-pet-bob">
            <Leg leg={spec.legs[0]} index={0} far sleeve={null} />
            {spec.frontal ? null : <Leg leg={spec.legs[1]} index={1} far sleeve={sleeve} />}

            <g className="cb-pet-torso" transform={torsoFrame}>
              <path className="cb-pet-torso-shape" d={shape.outline} fill="var(--cat-fur)" />
              <path className="cb-pet-saddle" d={shape.saddle} fill="var(--cat-patch)" />
              {worn.some(({ art }) => art.wrap) ? (
                <>
                  <clipPath id={clip}>
                    <path d={shape.outline} />
                  </clipPath>
                  <g clipPath={`url(#${clip})`} className="cb-pet-wrap">
                    {worn.map(({ slot, art }) =>
                      art.wrap ? (
                        <g key={slot} transform={neckFrame}>
                          {art.wrap(geom)}
                        </g>
                      ) : null,
                    )}
                  </g>
                </>
              ) : null}
              <path d={shape.outline} {...outline} />
              {worn.map(({ slot, art }) =>
                art.over ? (
                  <g key={slot} transform={neckFrame} className="cb-pet-back">
                    {art.over(geom)}
                  </g>
                ) : null,
              )}
            </g>

            {/* 身體上的摺線（坐著時大腿的弧線），和正面坐時的兩隻前腳：都畫在身體前面 */}
            {spec.crease ? <path className="cb-pet-crease" d={spec.crease} {...outline} /> : null}
            {spec.frontal ? <Leg leg={spec.legs[1]} index={1} far={false} sleeve={sleeve} /> : null}
            <Leg leg={spec.legs[2]} index={2} far={false} sleeve={null} />
            <Leg leg={spec.legs[3]} index={3} far={false} sleeve={sleeve} />

            <g transform={place(spec.head, HEAD_ORIGIN.x, HEAD_ORIGIN.y)}>
              <g className="cb-pet-head">
                <CatHead mood={mood ?? spec.mood} outfit={outfit} standalone={false} />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
