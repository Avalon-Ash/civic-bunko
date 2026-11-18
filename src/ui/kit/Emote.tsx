// 表情符號泡泡（像 RO 的表情）：小貓頭邊冒出一顆泡泡，裡面是符號。頭像（Cat）和有身體的小貓（CatBody）共用。
// 哪個表情冒哪個符號在 constants/pet.ts 的 CAT_EMOTES；動畫在 styles/wardrobe.css 的 cb-emote-*。
import type { CSSProperties, ReactNode } from 'react';
import { CAT_EMOTES, EMOTE } from '../../core/constants/pet';
import type { CatEmote, CatMood } from '../../core/types';

/** 泡泡和符號的線：固定用深色（外框線的顏色在黑貓＋深色模式會變淺，畫在淺色泡泡上看不清楚） */
const INK = 'var(--acc-shade)';
const line = { fill: 'none', stroke: INK, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
/** 尖角（泡泡朝右上長的版本；原點是尖端）：根部在圓上的兩個點，各離尖端多遠 */
const TAIL = { near: [2.4, -5.6], far: [5.6, -2.4] } as const;

/** 符號（原點在泡泡圓心，大約落在半徑 5 以內） */
const GLYPHS: Readonly<Record<CatEmote['glyph'], ReactNode>> = {
  note: (
    <g>
      <path d="M1.4 2.2 V-4.2 Q4.4 -3.6 4.4 -0.8" {...line} stroke="var(--pink-deep)" strokeWidth="1.7" />
      <ellipse cx="-0.6" cy="2.4" rx="2.2" ry="1.7" fill="var(--pink-deep)" />
    </g>
  ),
  sweat: (
    <path
      d="M0 -4.6 Q3.8 0.4 3.2 2.2 Q2.6 4.6 0 4.6 Q-2.6 4.6 -3.2 2.2 Q-3.8 0.4 0 -4.6 Z"
      fill="var(--acc-sky)"
      stroke={INK}
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  ),
  zzz: (
    <g>
      <path d="M-4.2 -0.6 H0.2 L-4.2 4.2 H0.2" {...line} strokeWidth="1.7" />
      <path d="M1.6 -4.4 H4.6 L1.6 -1.2 H4.6" {...line} strokeWidth="1.3" />
    </g>
  ),
};

export interface EmoteProps {
  mood: CatMood;
  /** 泡泡的尖角指在哪（這張小貓圖的座標） */
  at: { x: number; y: number };
  /** 泡泡往哪一邊長：1＝右上、-1＝左上 */
  side: 1 | -1;
  /** 這張圖一個座標單位是畫面上幾 px（決定泡泡要不要放大到看得見） */
  pxPerUnit: number;
}

const n2 = (v: number) => Math.round(v * 100) / 100;

/** 這個表情的泡泡；沒有對應符號的表情回傳 null。放在小貓的 svg 裡、所有配件之後、不跟著翻面的那一層 */
export function Emote({ mood, at, side, pxPerUnit }: EmoteProps) {
  const emote = CAT_EMOTES[mood];
  if (!emote) return null;
  const scale = Math.max(1, EMOTE.minPx / (EMOTE.r * 2 * pxPerUnit));
  const reach = EMOTE.r * EMOTE.reach;
  return (
    <g key={mood} transform={`translate(${n2(at.x)} ${n2(at.y)}) scale(${n2(scale)})`} className="cb-emote-host">
      <g
        className={`cb-emote cb-emote-${emote.hold} cb-emote-${emote.glyph}`}
        style={{ '--emote-once-ms': `${EMOTE.onceMs}ms` } as CSSProperties}
      >
        {/* 泡泡的形狀照 side 左右翻；符號不翻（Z、音符翻過來就反了） */}
        <g transform={side === 1 ? undefined : 'scale(-1 1)'}>
          <path
            d={`M0 0 L${TAIL.near[0]} ${TAIL.near[1]} L${TAIL.far[0]} ${TAIL.far[1]} Z`}
            fill="var(--acc-cream)"
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx={n2(reach)} cy={n2(-reach)} r={EMOTE.r} fill="var(--acc-cream)" stroke={INK} strokeWidth="1.5" />
          {/* 蓋掉尖角根部那一段圓的外框，尖角和圓才連成一塊 */}
          <path d={`M${TAIL.near[0]} ${TAIL.near[1]} L${TAIL.far[0]} ${TAIL.far[1]}`} stroke="var(--acc-cream)" strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <g transform={`translate(${n2(side * reach)} ${n2(-reach)})`}>
          <g className="cb-emote-glyph">{GLYPHS[emote.glyph]}</g>
        </g>
      </g>
    </g>
  );
}
