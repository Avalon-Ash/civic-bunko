import { useId } from 'react';
import { HEAD_ORIGIN, PET_POSES, PET_VIEW_H, PET_VIEW_W } from '../../core/constants/pet';
import type { Outfit, PetAnchor, PetLeg, PetPose } from '../../core/types';
import { CatHead, furClass, type CatMood } from './Cat';
import { ITEM_ART } from './wardrobe/art';

export interface CatBodyProps {
  pose: PetPose;
  outfit: Outfit;
  /** 不給就用姿勢預設的表情 */
  mood?: CatMood;
  facing?: 'left' | 'right';
  /** 顯示寬度（px） */
  width?: number;
  className?: string;
}

/** 對位點 → SVG transform：把零件的原點 (ox, oy) 放到 anchor 上 */
function place(a: PetAnchor, ox: number, oy: number): string {
  return `translate(${a.x} ${a.y}) rotate(${a.rot}) scale(${a.scale}) translate(${-ox} ${-oy})`;
}

const LINE = 'var(--cat-line)';
/** 腿與尾巴的粗細 */
const LEG_W = 8;
const TAIL_W = 5;
/** 外框比本體每邊多出的寬度 */
const OUTLINE = 2.5;

function Leg({ leg, index, far }: { leg: PetLeg; index: number; far: boolean }) {
  if (leg.len <= 0) return null;
  return (
    <g transform={`translate(${leg.x} ${leg.y}) rotate(${leg.rot})`}>
      <g className={`cb-pet-leg cb-pet-leg-${index}`}>
        <rect
          x={-LEG_W / 2}
          y={-LEG_W / 2}
          width={LEG_W}
          height={leg.len + LEG_W / 2}
          rx={LEG_W / 2}
          fill={far ? 'var(--cat-patch)' : 'var(--cat-fur)'}
          stroke={LINE}
          strokeWidth={OUTLINE}
        />
      </g>
    </g>
  );
}

/**
 * 有身體的小貓（側身、短腿、頭朝前）。照 PET_POSES 的姿勢資料畫：
 * 頭沿用 CatHead（含頭上、臉上、頸部的配件），接在姿勢的頭對位點；背上配件接在背的對位點。
 */
export function CatBody({ pose, outfit, mood, facing = 'right', width = 72, className = '' }: CatBodyProps) {
  const spec = PET_POSES[pose];
  const clip = useId();
  const backId = outfit.back;
  const backArt = backId ? ITEM_ART[backId] : undefined;
  const { torso } = spec;
  const torsoTransform = `rotate(${torso.rot} ${torso.cx} ${torso.cy})`;

  return (
    <svg
      width={width}
      height={(width * PET_VIEW_H) / PET_VIEW_W}
      viewBox={`0 0 ${PET_VIEW_W} ${PET_VIEW_H}`}
      overflow="visible"
      aria-hidden="true"
      className={`cb-pet-svg ${furClass(outfit)} ${className}`.trim()}
    >
      <g
        className={`cb-pet cb-pet-motion-${spec.motion}`}
        transform={facing === 'left' ? `translate(${PET_VIEW_W} 0) scale(-1 1)` : undefined}
      >
        {backArt && backArt.kind === 'layer' ? (
          <g transform={place(spec.back, HEAD_ORIGIN.x, HEAD_ORIGIN.y)} className="cb-pet-back">
            {backArt.node}
          </g>
        ) : null}

        <g className="cb-pet-tail">
          <path d={spec.tail} fill="none" stroke={LINE} strokeWidth={TAIL_W + OUTLINE * 2} strokeLinecap="round" />
          <path d={spec.tail} fill="none" stroke="var(--cat-patch)" strokeWidth={TAIL_W} strokeLinecap="round" />
        </g>

        <g className="cb-pet-bob">
          <Leg leg={spec.legs[0]} index={0} far />
          <Leg leg={spec.legs[1]} index={1} far />

          <g className="cb-pet-torso" transform={torsoTransform}>
            <clipPath id={clip}>
              <ellipse cx={torso.cx} cy={torso.cy} rx={torso.rx} ry={torso.ry} />
            </clipPath>
            <ellipse cx={torso.cx} cy={torso.cy} rx={torso.rx} ry={torso.ry} fill="var(--cat-fur)" />
            <ellipse
              clipPath={`url(#${clip})`}
              cx={torso.cx - torso.rx * 0.25}
              cy={torso.cy - torso.ry * 0.9}
              rx={torso.rx * 0.7}
              ry={torso.ry * 0.75}
              fill="var(--cat-patch)"
            />
            <ellipse
              cx={torso.cx}
              cy={torso.cy}
              rx={torso.rx}
              ry={torso.ry}
              fill="none"
              stroke={LINE}
              strokeWidth={OUTLINE}
            />
          </g>

          <Leg leg={spec.legs[2]} index={2} far={false} />
          <Leg leg={spec.legs[3]} index={3} far={false} />

          <g transform={place(spec.head, HEAD_ORIGIN.x, HEAD_ORIGIN.y)}>
            <g className="cb-pet-head">
              <CatHead mood={mood ?? spec.mood} outfit={outfit} backdrop={false} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
