import { useId, type ReactNode } from 'react';
import {
  BACKDROP_ORIGIN,
  HEAD_ORIGIN,
  HEAD_RADIUS,
  PET_BACKDROP,
  PET_HEAD_SCALE,
  PET_LINE_W,
  PET_PAW_TOE,
  PET_PIVOT_SHIFT,
  PET_POSES,
  PET_TAIL_W,
  PET_VIEW_H,
  PET_VIEW_W,
} from '../../core/constants/pet';
import { SLOTS } from '../../core/constants/wardrobe';
import type { Outfit, PetAnchor, PetLeg, PetPose, PetPoseSpec } from '../../core/types';
import { CatHead, furClass, type CatMood } from './Cat';
import { frontalBuild, legPath, r2, torsoShape } from './petShape';
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
  /**
   * 會移動的小貓（亂跑、進度條）要開：換姿勢、轉身時整隻貓以自己的中心為軸（PET_PIVOT_SHIFT），
   * 不開的話側身的頭在前面、正面坐的頭在中間，一換姿勢頭就往回跳。
   */
  pivot?: boolean;
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
/** 沿脊椎鏡像（身體座標的 y 反向：背那側 ↔ 肚子那側）。正面坐時身體左右對稱，背那側的花色、布面鏡像到另一側再畫一次 */
const MIRROR = 'scale(1 -1)';
function Leg({ leg, index, far, toe, sleeve }: { leg: PetLeg; index: number; far: boolean; toe: number; sleeve: ReactNode }) {
  if (leg.len <= 0) return null;
  /** 腿根要不要封口：遠側的腿（從身體邊緣露出來）、從肩膀舉起來的手臂 */
  const capped = far || leg.shoulder === true;
  const d = legPath(leg.len, capped, toe);
  return (
    <g transform={`translate(${leg.x} ${leg.y}) rotate(${leg.rot})`}>
      <g className={`cb-pet-leg cb-pet-leg-${index}`}>
        <path d={capped ? d : `${d}Z`} fill={far ? 'var(--cat-fur-far)' : 'var(--cat-fur)'} />
        <path d={d} {...outline} />
        {sleeve}
      </g>
    </g>
  );
}

/**
 * 頭的下緣蓋到身體脖子那端下面多遠（沿著身體的方向量；頭歪的角度不算）。
 * 脖子那端＝身體中心沿著身體方向往前 rx；頭的最低點＝頭的對位點往下一個頭的半高。
 */
function chinDepth(spec: PetPoseSpec): number {
  const { torso, head } = spec;
  const rad = (torso.rot * Math.PI) / 180;
  /** 身體的方向（從屁股指向脖子）在畫面上的單位向量 */
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const neck = { x: torso.cx + ux * torso.rx, y: torso.cy + uy * torso.rx };
  const chin = { x: head.x, y: head.y + HEAD_RADIUS.y * head.scale };
  /** 下巴相對脖子那端，沿著「往屁股」的方向（-u）的分量 */
  return -((chin.x - neck.x) * ux + (chin.y - neck.y) * uy);
}

/** 前腿在 PetPoseSpec.legs 裡的編號（順序：後腿遠、前腿遠、後腿近、前腿近）；袖子只套前腿 */
const FRONT_LEGS: ReadonlySet<number> = new Set([1, 3]);

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
export function CatBody({
  pose,
  outfit,
  mood,
  facing = 'right',
  width = 72,
  className = '',
  backdrop = false,
  pivot = false,
}: CatBodyProps) {
  const spec = PET_POSES[pose];
  /** 支點對齊：平移量換成圖寬的百分比（translateX 的 % 是元素自己的寬） */
  const shift = pivot ? (PET_PIVOT_SHIFT[pose] * (facing === 'left' ? -1 : 1) * 100) / PET_VIEW_W : 0;
  const worn = bodyArts(outfit);
  const backId = outfit.back;
  const backArt = backId ? ITEM_ART[backId] : undefined;
  const bgId = backdrop ? outfit.bg : undefined;
  const bgArt = bgId ? ITEM_ART[bgId] : undefined;
  const { torso } = spec;
  const build = spec.frontal ? frontalBuild(spec.build) : spec.build;
  const shape = torsoShape(torso, build);
  /** 給衣服看的身體尺寸：衣服照它長，換姿勢、改體型都會跟著身體 */
  const geom: BodyGeom = {
    len: torso.rx * 2,
    back: torso.ry,
    belly: torso.ry * build.belly,
    chest: build.chest,
    shoulder: build.shoulder,
    hip: build.hip,
    chin: chinDepth(spec),
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
  const sleeves = worn.map(({ slot, art }) =>
    art.sleeve ? (
      <g key={slot} className="cb-pet-sleeve">
        {art.sleeve}
      </g>
    ) : null,
  );
  const sleeve = worn.some(({ art }) => art.sleeve) ? sleeves : null;
  /**
   * 這條前腿要不要套袖子：側身時前腿從肩膀垂下來，套；正面坐時放下的兩隻前腳只是從身體下面露出來的腳掌，
   * 袖子在衣服裡面看不到，不套；舉起來的手臂（shoulder）整隻露在外面，套。
   */
  const sleeveOn = (leg: PetLeg): ReactNode => (!spec.frontal || leg.shoulder ? sleeve : null);
  const toe = spec.frontal ? 0 : PET_PAW_TOE;
  /** 脖子上有沒有東西：頸部的配件，或衣服自己留在下巴下面的領口。有的話，披風這類配件就不再畫自己的領子 */
  const neckTaken = Boolean(outfit.neck) || worn.some(({ art }) => art.head !== undefined);
  /** 畫在身體前面的腿（照腿的編號）：後腿近、前腿近；正面坐時前腿遠那一條也在前面 */
  const nearLegs = (spec.frontal ? [1, 2, 3] : [2, 3]).map((index) => ({ index, leg: spec.legs[index] as PetLeg }));
  /**
   * 正面的座標：原點在身體的脖子那端（頭的正下方）、+x 朝畫面右、+y 朝下。身體直立的姿勢（backFront）背上的配件
   * （披在背後的披風、左右展開的翅膀）照它畫。
   * inTorso＝已經在身體座標裡時用的那一段
   */
  const frontInTorso = `translate(${torso.rx} 0) rotate(90)`;
  const frontFrame = `${torsoFrame} ${frontInTorso}`;

  return (
    <svg
      width={width}
      height={(width * PET_VIEW_H) / PET_VIEW_W}
      viewBox={`0 0 ${PET_VIEW_W} ${PET_VIEW_H}`}
      overflow="visible"
      aria-hidden="true"
      className={`cb-pet-svg ${furClass(outfit)} ${className}`.trim()}
      data-pose={pose}
      style={pivot ? { transform: `translateX(${r2(shift)}%)` } : undefined}
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
            spec.backFront && art.frontal ? (
              art.frontal.behind ? (
                <g key={slot} transform={frontFrame} className="cb-pet-back">
                  {art.frontal.behind(geom)}
                </g>
              ) : null
            ) : art.behind ? (
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
            <Leg leg={spec.legs[0]} index={0} far toe={toe} sleeve={null} />
            {spec.frontal ? null : <Leg leg={spec.legs[1]} index={1} far toe={toe} sleeve={sleeveOn(spec.legs[1])} />}

            <g className="cb-pet-torso" transform={torsoFrame}>
              <path className="cb-pet-torso-shape" d={shape.outline} fill="var(--cat-fur)" />
              <path className="cb-pet-saddle" d={shape.saddle} fill="var(--cat-patch)" />
              {spec.frontal ? <path className="cb-pet-saddle" d={shape.saddle} transform={MIRROR} fill="var(--cat-patch)" /> : null}
              {worn.some(({ art }) => art.wrap) ? (
                <>
                  <clipPath id={clip}>
                    <path d={shape.outline} />
                  </clipPath>
                  <g clipPath={`url(#${clip})`} className="cb-pet-wrap">
                    {worn.map(({ slot, art }) =>
                      art.wrap ? (
                        <g key={slot}>
                          <g transform={neckFrame}>{art.wrap(geom)}</g>
                          {spec.frontal ? <g transform={`${MIRROR} ${neckFrame}`}>{art.wrap(geom)}</g> : null}
                        </g>
                      ) : null,
                    )}
                  </g>
                </>
              ) : null}
              <path d={shape.outline} {...outline} />
              {worn.map(({ slot, art }) =>
                spec.backFront && art.frontal ? (
                  art.frontal.collar && !neckTaken ? (
                    <g key={slot} transform={frontInTorso} className="cb-pet-back">
                      {art.frontal.collar(geom)}
                    </g>
                  ) : null
                ) : art.over ? (
                  <g key={slot} className="cb-pet-back">
                    {spec.frontal ? <g transform={`${MIRROR} ${neckFrame}`}>{art.over(geom)}</g> : null}
                    <g transform={neckFrame}>{art.over(geom)}</g>
                  </g>
                ) : null,
              )}
            </g>

            {/* 近側的腿：放下的畫在頭後面；從肩膀舉起來的手臂（shoulder）畫在頭前面，腳掌才碰得到臉頰 */}
            {nearLegs.filter(({ leg }) => !leg.shoulder).map(({ leg, index }) => (
              <Leg key={index} leg={leg} index={index} far={false} toe={toe} sleeve={FRONT_LEGS.has(index) ? sleeveOn(leg) : null} />
            ))}

            <g transform={place(spec.head, HEAD_ORIGIN.x, HEAD_ORIGIN.y)}>
              <g className="cb-pet-head">
                <CatHead mood={mood ?? spec.mood} outfit={outfit} standalone={false} />
              </g>
            </g>

            {nearLegs.filter(({ leg }) => leg.shoulder).map(({ leg, index }) => (
              <Leg key={index} leg={leg} index={index} far={false} toe={toe} sleeve={FRONT_LEGS.has(index) ? sleeveOn(leg) : null} />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}
