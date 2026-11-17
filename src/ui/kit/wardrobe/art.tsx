// 小八喵配件的圖（每件一個 SVG 片段，畫在貓的 64×64 座標裡）。
// 配件清單（ID、部位、取得方式）在 src/core/constants/wardrobe.ts；這裡只放圖。顏色只用 theme.css 的 token。
import type { ReactNode } from 'react';
import type { ItemId } from '../../../core/types';

/** 配件自己的小動作（動畫在 styles/wardrobe.css 的 cb-motion-*） */
export type ItemMotion = 'bob' | 'hop' | 'flap';

export type ItemArt =
  /** 圖層：node 畫在貓的座標裡；box 是單獨顯示圖示時的 viewBox */
  | { kind: 'layer'; node: ReactNode; box: string; motion?: ItemMotion }
  /** 毛色：套在貓外層的 class（色票在 theme.css） */
  | { kind: 'fur'; className: string };

const LINE = 'var(--cat-line)';
/** 配件外框粗細：與貓本體的 2.5 同級、略細 */
const W = 2.2;
const WT = 1.8;

const stroke = { stroke: LINE, strokeWidth: W, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { stroke: LINE, strokeWidth: WT, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const ITEM_ART: Readonly<Record<ItemId, ItemArt>> = {
  // ── 舊集章配件（沿用原本的造型）──────────────────────────
  bow: {
    kind: 'layer',
    box: '35 12 24 20',
    node: (
      <g transform="translate(47 22) rotate(18)">
        <path d="M-1 0 L-8 -4.5 L-8 4.5 Z" fill="var(--pink-deep)" {...stroke} />
        <path d="M1 0 L8 -4.5 L8 4.5 Z" fill="var(--pink-deep)" {...stroke} />
        <circle cx="0" cy="0" r="2.6" fill="var(--acc-straw)" stroke={LINE} strokeWidth="2" />
      </g>
    ),
  },
  'straw-hat': {
    kind: 'layer',
    box: '8 1 48 26',
    node: (
      <g>
        <ellipse cx="32" cy="18" rx="22" ry="4.5" fill="var(--acc-straw)" stroke={LINE} strokeWidth="2.4" />
        <path d="M21 17 L23 7 Q32 4 41 7 L43 17 Z" fill="var(--acc-straw)" stroke={LINE} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M21.8 14.8 Q32 16.8 42.2 14.8" fill="none" stroke="var(--pink-deep)" strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
  },
  scarf: {
    kind: 'layer',
    box: '14 48 36 18',
    node: (
      <g>
        <path d="M36 57.5 L42 57.5 L43 62.5 L35.5 62.5 Z" fill="var(--acc-mint)" {...stroke} />
        <path d="M18 54 Q32 59.5 46 54 L44.5 59.5 Q32 62.5 19.5 59.5 Z" fill="var(--acc-mint)" {...stroke} />
      </g>
    ),
  },
  flower: {
    kind: 'layer',
    box: '5 12 20 20',
    node: (
      <g transform="translate(15 22)">
        {[
          [0, -4.5],
          [4.3, -1.4],
          [2.6, 3.6],
          [-2.6, 3.6],
          [-4.3, -1.4],
        ].map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r="3.2" fill="var(--pink-deep)" stroke={LINE} strokeWidth="2" />
        ))}
        <circle cx="0" cy="0" r="2.8" fill="var(--acc-straw)" stroke={LINE} strokeWidth="1.8" />
      </g>
    ),
  },
  glasses: {
    kind: 'layer',
    box: '8 28 48 24',
    node: (
      <g>
        <circle cx="22.5" cy="40" r="6.8" fill="var(--acc-sky)" fillOpacity="0.35" stroke={LINE} strokeWidth="2.3" />
        <circle cx="41.5" cy="40" r="6.8" fill="var(--acc-sky)" fillOpacity="0.35" stroke={LINE} strokeWidth="2.3" />
        <path d="M29.3 40 Q32 38 34.7 40" fill="none" stroke={LINE} strokeWidth="2.3" strokeLinecap="round" />
        <path d="M15.7 39.5 L10 38 M48.3 39.5 L54 38" fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    ),
  },
  crown: {
    kind: 'layer',
    box: '15 1 34 22',
    node: (
      <g>
        <path d="M21 19 L19 7 L27 13 L32 4 L37 13 L45 7 L43 19 Z" fill="var(--acc-straw)" stroke={LINE} strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="32" cy="14" r="2" fill="var(--pink-deep)" />
      </g>
    ),
  },

  // ── 頭頂 ────────────────────────────────────────────────
  beanie: {
    kind: 'layer',
    box: '9 1 46 30',
    node: (
      <g>
        <path d="M13 25 Q13 9 32 8.5 Q51 9 51 25 Z" fill="var(--acc-sky)" {...stroke} />
        <path d="M22 11.5 Q21 18 22 24 M32 9 V24 M42 11.5 Q43 18 42 24" fill="none" {...thin} strokeOpacity="0.45" />
        <rect x="11.5" y="21.5" width="41" height="6.5" rx="3.2" fill="var(--acc-cream)" {...stroke} />
        <circle cx="32" cy="7" r="4" fill="var(--acc-cream)" {...stroke} />
      </g>
    ),
  },
  beret: {
    kind: 'layer',
    box: '12 2 40 24',
    node: (
      <g transform="rotate(-10 32 16)">
        <path d="M31 8.5 Q32 5 34 6" fill="none" {...stroke} />
        <ellipse cx="32" cy="15" rx="17.5" ry="6.8" fill="var(--acc-navy)" {...stroke} />
        <path d="M18 17.5 Q32 22 46 17.5" fill="none" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.7" />
      </g>
    ),
  },
  'party-hat': {
    kind: 'layer',
    box: '18 -4 30 26',
    node: (
      <g transform="rotate(12 32 18)">
        <path d="M24 19 L32 1.5 L40 19 Q32 21.5 24 19 Z" fill="var(--acc-lav)" {...stroke} />
        <path d="M28.2 10.5 L33.8 12.5 M26 15.5 L37.6 18" fill="none" stroke="var(--acc-gold)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="32" cy="1.5" r="3" fill="var(--pink-deep)" {...thin} />
      </g>
    ),
  },
  chick: {
    kind: 'layer',
    motion: 'hop',
    box: '20 0 24 22',
    node: (
      <g>
        <path d="M25.5 15 Q25 6.5 32 6 Q39 6.5 38.5 15 Q38 19 32 19.2 Q26 19 25.5 15 Z" fill="var(--acc-gold)" {...stroke} />
        <path d="M31 6.2 Q31.5 3 33.5 3.4 M32.3 6 Q34.5 3.8 36 5" fill="none" {...thin} />
        <circle cx="30" cy="11.5" r="1.3" fill={LINE} />
        <circle cx="35" cy="11.5" r="1.3" fill={LINE} />
        <path d="M31 13.6 L32.5 15.6 L34 13.6 Z" fill="var(--acc-coral)" {...thin} />
        <path d="M37 13.5 Q40.5 13.5 39.5 16.5" fill="none" {...thin} />
      </g>
    ),
  },
  hachimaki: {
    kind: 'layer',
    box: '6 16 58 24',
    node: (
      <g>
        <path d="M54 30.5 L61.5 26.5 L60.5 32.5 Z" fill="var(--acc-cream)" {...thin} />
        <path d="M54 32.5 L62 35.5 L57.5 38.5 Z" fill="var(--acc-cream)" {...thin} />
        <path d="M9 30 Q32 18 55 30 L54.2 35 Q32 23.6 9.8 35 Z" fill="var(--acc-cream)" {...stroke} />
        <circle cx="32" cy="26.6" r="2.9" fill="var(--acc-coral)" />
      </g>
    ),
  },
  'grad-cap': {
    kind: 'layer',
    box: '11 1 42 25',
    node: (
      <g>
        <path d="M22 14 L22 20.5 Q32 24.5 42 20.5 L42 14" fill="var(--acc-navy)" {...stroke} />
        <path d="M13 11.5 L32 4.5 L51 11.5 L32 18.5 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M32 11.5 L46.5 13.5 L46.5 21" fill="none" stroke="var(--acc-gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M45 21 L48 21 L47.5 25 L45.5 25 Z" fill="var(--acc-gold)" {...thin} />
        <circle cx="32" cy="11.5" r="1.4" fill="var(--acc-gold)" />
      </g>
    ),
  },

  // ── 頭側 ────────────────────────────────────────────────
  'star-clip': {
    kind: 'layer',
    box: '37 12 20 20',
    node: (
      <path
        transform="translate(47 22) rotate(12)"
        d="M0 -7 L2 -2.3 L6.8 -2.1 L3.1 1.1 L4.3 5.9 L0 3.2 L-4.3 5.9 L-3.1 1.1 L-6.8 -2.1 L-2 -2.3 Z"
        fill="var(--acc-gold)"
        {...stroke}
      />
    ),
  },
  sakura: {
    kind: 'layer',
    box: '5 12 20 20',
    node: (
      <g transform="translate(15 22)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <path
            key={deg}
            transform={`rotate(${deg})`}
            d="M0 -0.5 Q-3.4 -3.2 -2.2 -6.4 L0 -5.4 L2.2 -6.4 Q3.4 -3.2 0 -0.5 Z"
            fill="var(--pink)"
            {...thin}
          />
        ))}
        <circle cx="0" cy="0" r="1.6" fill="var(--pink-deep)" />
      </g>
    ),
  },
  clover: {
    kind: 'layer',
    box: '37 11 20 22',
    node: (
      <g transform="translate(47 21) rotate(15)">
        <path d="M0 2 Q1 7 3 9" fill="none" {...thin} />
        {[0, 90, 180, 270].map((deg) => (
          <path
            key={deg}
            transform={`rotate(${deg + 45})`}
            d="M0 0 Q-4 -2 -3.2 -5 Q-1.6 -6.6 0 -4.6 Q1.6 -6.6 3.2 -5 Q4 -2 0 0 Z"
            fill="var(--acc-leaf)"
            {...thin}
          />
        ))}
      </g>
    ),
  },

  // ── 眼睛 ────────────────────────────────────────────────
  sunglasses: {
    kind: 'layer',
    box: '8 30 48 20',
    node: (
      <g>
        <path d="M15 35.5 H30 Q30.5 45 22.5 45.5 Q15 45 15 35.5 Z" fill="var(--acc-shade)" {...stroke} />
        <path d="M34 35.5 H49 Q49 45 41.5 45.5 Q33.5 45 34 35.5 Z" fill="var(--acc-shade)" {...stroke} />
        <path d="M30 37 Q32 35.6 34 37" fill="none" {...stroke} />
        <path d="M15 36 L9.5 34.5 M49 36 L54.5 34.5" fill="none" {...stroke} />
        <path d="M18 38 L21 38 M37 38 L40 38" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.8" />
      </g>
    ),
  },
  monocle: {
    kind: 'layer',
    box: '32 30 22 30',
    node: (
      <g>
        <path d="M45.5 46 Q49 52 47 58" fill="none" stroke="var(--acc-gold)" strokeWidth="1.4" strokeDasharray="1.6 1.4" strokeLinecap="round" />
        <circle cx="41.5" cy="40" r="6.6" fill="var(--acc-sky)" fillOpacity="0.3" stroke="var(--acc-gold)" strokeWidth="2.4" />
        <circle cx="41.5" cy="40" r="7.9" fill="none" stroke={LINE} strokeWidth="1.2" />
      </g>
    ),
  },

  // ── 嘴邊 ────────────────────────────────────────────────
  'fish-snack': {
    kind: 'layer',
    box: '30 36 30 22',
    node: (
      <g transform="translate(34 48) scale(1.25) rotate(-10) translate(-34 -48)">
        <path d="M49 48 L55 44 L54.5 52 Z" fill="var(--acc-silver)" {...thin} />
        <path d="M33 48 Q40 42.5 49.5 48 Q40 53.5 33 48 Z" fill="var(--acc-silver)" {...thin} />
        <circle cx="36.8" cy="47.2" r="1" fill={LINE} />
        <path d="M42 46 Q43.2 48 42 50 M45 46.4 Q46 48 45 49.6" fill="none" stroke={LINE} strokeWidth="1" strokeLinecap="round" />
      </g>
    ),
  },
  mustache: {
    kind: 'layer',
    box: '18 38 28 14',
    node: (
      <path
        d="M32 44.2 Q28 42 24.5 44 Q21.5 46 22.5 48.5 Q20 47.5 20.5 44.8 Q22 40.5 27 41.5 Q30.5 42.3 32 43.4 Q33.5 42.3 37 41.5 Q42 40.5 43.5 44.8 Q44 47.5 41.5 48.5 Q42.5 46 39.5 44 Q36 42 32 44.2 Z"
        fill="var(--acc-wood)"
        {...thin}
      />
    ),
  },
  mask: {
    kind: 'layer',
    box: '10 38 44 20',
    node: (
      <g>
        <path d="M19.5 44 Q14 43 11.5 40.5 M44.5 44 Q50 43 52.5 40.5" fill="none" {...thin} />
        <path d="M19 43 Q32 40.5 45 43 L44 51.5 Q32 56 20 51.5 Z" fill="var(--acc-cream)" {...stroke} />
        <path d="M21.5 46 Q32 44.5 42.5 46 M21.5 49 Q32 48.5 42.5 49" fill="none" {...thin} strokeOpacity="0.4" />
      </g>
    ),
  },

  // ── 頸部 ────────────────────────────────────────────────
  bell: {
    kind: 'layer',
    box: '14 50 36 16',
    node: (
      <g>
        <path d="M17 54 Q32 60 47 54 L46.5 57.6 Q32 63.4 17.5 57.6 Z" fill="var(--acc-coral)" {...stroke} />
        <circle cx="32" cy="61" r="3.6" fill="var(--acc-gold)" {...thin} />
        <path d="M30.2 61.6 H33.8 M32 61.6 V64" fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" />
      </g>
    ),
  },
  bowtie: {
    kind: 'layer',
    box: '20 50 24 16',
    node: (
      <g>
        <path d="M30.5 57.5 L22.5 53 Q21.5 57.5 22.5 62 Z" fill="var(--acc-lav)" {...stroke} />
        <path d="M33.5 57.5 L41.5 53 Q42.5 57.5 41.5 62 Z" fill="var(--acc-lav)" {...stroke} />
        <rect x="29.5" y="55" width="5" height="5" rx="1.6" fill="var(--pink-deep)" {...thin} />
      </g>
    ),
  },
  necktie: {
    kind: 'layer',
    box: '24 52 16 20',
    node: (
      <g>
        <path d="M30.3 59.5 L27.8 67 L32 70 L36.2 67 L33.7 59.5 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M28.6 54.6 L35.4 54.6 L34 59.8 L30 59.8 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M29.4 63.4 L34.8 61.4 M28.6 66.4 L35.6 63.8" stroke="var(--acc-gold)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ),
  },
  'exam-pass': {
    kind: 'layer',
    box: '18 48 28 18',
    node: (
      <g>
        <path d="M21 51.5 L30 57.5 M43 51.5 L34 57.5" fill="none" stroke="var(--acc-coral)" strokeWidth="2" strokeLinecap="round" />
        <rect x="26" y="56.5" width="12" height="8.5" rx="1.6" fill="var(--acc-cream)" {...thin} />
        <rect x="27.6" y="58.2" width="3.6" height="4.4" rx="0.6" fill="var(--acc-sky)" />
        <path d="M32.6 59 H36.2 M32.6 61.6 H35.4" stroke={LINE} strokeWidth="1" strokeLinecap="round" />
      </g>
    ),
  },

  // ── 身上 ────────────────────────────────────────────────
  sweater: {
    kind: 'layer',
    box: '6 50 52 26',
    node: (
      <g>
        <path d="M11 55 Q32 64.5 53 55 L54 63.5 Q32 73 10 63.5 Z" fill="var(--acc-lav)" {...stroke} />
        <path d="M16 58.6 L15.6 65 M21.5 60.6 L21.3 67.4 M27 61.8 L27 68.8 M32 62.2 V69.2 M37 61.8 L37 68.8 M42.5 60.6 L42.7 67.4 M48 58.6 L48.4 65" fill="none" stroke="var(--acc-cream)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.75" />
      </g>
    ),
  },
  sailor: {
    kind: 'layer',
    box: '4 50 56 26',
    node: (
      <g>
        <path d="M10 55 Q32 65 54 55 L56.5 64 Q32 75 7.5 64 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M11.6 59.2 Q32 69.6 52.4 59.2" fill="none" stroke="var(--acc-cream)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M27 62.4 L37 62.4 L32 71 Z" fill="var(--acc-coral)" {...thin} />
        <circle cx="32" cy="62.6" r="2.3" fill="var(--acc-coral)" {...thin} />
      </g>
    ),
  },

  // ── 背飾（畫在貓後面）────────────────────────────────────
  balloon: {
    kind: 'layer',
    motion: 'bob',
    box: '44 0 20 52',
    node: (
      <g>
        <path d="M54 46 Q52 34 56.5 19.5" fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="57" cy="11.5" rx="6.3" ry="7.8" fill="var(--acc-coral)" {...thin} />
        <path d="M55.5 19 L57 20.6 L58.5 19 Z" fill="var(--acc-coral)" {...thin} />
        <path d="M54 7.5 Q55 5.6 56.8 5.2" fill="none" stroke="var(--acc-cream)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ),
  },
  cape: {
    kind: 'layer',
    box: '-2 30 68 36',
    node: (
      <path d="M12 38 Q2 50 -0.5 63.5 Q16 60 32 64 Q48 60 64.5 63.5 Q62 50 52 38 Z" fill="var(--acc-coral)" {...stroke} />
    ),
  },
  wings: {
    kind: 'layer',
    motion: 'flap',
    box: '-8 20 80 36',
    node: (
      <g>
        <path
          d="M12 36 Q2 22 -5.5 27 Q-8 32 -3.5 35 Q-8 38 -4 42 Q-6.5 46 -1 48 Q4 50 11 46 Z"
          fill="var(--acc-cream)"
          {...stroke}
        />
        <path
          d="M52 36 Q62 22 69.5 27 Q72 32 67.5 35 Q72 38 68 42 Q70.5 46 65 48 Q60 50 53 46 Z"
          fill="var(--acc-cream)"
          {...stroke}
        />
        <path d="M-3.5 35 Q3 36 8 38 M-4 42 Q3 42 9 42.5 M67.5 35 Q61 36 56 38 M68 42 Q61 42 55 42.5" fill="none" stroke="var(--acc-lav)" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    ),
  },

  // ── 背景（畫在最後面）────────────────────────────────────
  cushion: {
    kind: 'layer',
    box: '-2 52 68 16',
    node: (
      <g>
        <path d="M0.5 57 L-2 54.5 M63.5 57 L66 54.5 M0.5 63 L-2 65.5 M63.5 63 L66 65.5" stroke="var(--acc-gold)" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="0" y="54" width="64" height="12" rx="6" fill="var(--pink)" {...stroke} />
        <path d="M6 60 Q32 63.5 58 60" fill="none" stroke="var(--pink-deep)" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
      </g>
    ),
  },
  'book-stack': {
    kind: 'layer',
    box: '44 26 24 38',
    node: (
      <g>
        <rect x="48" y="55" width="19" height="7" rx="1.6" fill="var(--acc-sky)" {...thin} />
        <rect x="50" y="48" width="16" height="7" rx="1.6" fill="var(--acc-coral)" {...thin} />
        <rect x="47.5" y="41" width="18" height="7" rx="1.6" fill="var(--acc-leaf)" {...thin} />
        <rect x="51" y="34" width="14" height="7" rx="1.6" fill="var(--acc-lav)" {...thin} />
        <path d="M51 58.5 H64 M53 51.5 H63 M50.5 44.5 H62.5" stroke="var(--acc-cream)" strokeWidth="1" strokeLinecap="round" />
        <path d="M55 34 L57 27.5 L59 34" fill="var(--acc-gold)" {...thin} />
      </g>
    ),
  },
  moon: {
    kind: 'layer',
    box: '-1 -1 66 66',
    node: (
      <g>
        <circle cx="32" cy="36" r="31" fill="var(--acc-night)" />
        <path d="M51 4.5 A10.5 10.5 0 1 0 61.5 17 A8 8 0 1 1 51 4.5 Z" fill="var(--acc-gold)" {...thin} />
        <path d="M11 12 l1 2.2 l2.2 1 l-2.2 1 l-1 2.2 l-1 -2.2 l-2.2 -1 l2.2 -1 Z M4.5 32 l0.7 1.5 l1.5 0.7 l-1.5 0.7 l-0.7 1.5 l-0.7 -1.5 l-1.5 -0.7 l1.5 -0.7 Z M59 33 l0.7 1.5 l1.5 0.7 l-1.5 0.7 l-0.7 1.5 l-0.7 -1.5 l-1.5 -0.7 l1.5 -0.7 Z" fill="var(--acc-cream)" />
      </g>
    ),
  },
  rainbow: {
    kind: 'layer',
    box: '-4 -4 72 50',
    node: (
      <g fill="none" strokeLinecap="round">
        <path d="M-1 42 A33 33 0 0 1 65 42" stroke="var(--acc-coral)" strokeWidth="4" />
        <path d="M3 42 A29 29 0 0 1 61 42" stroke="var(--acc-gold)" strokeWidth="4" />
        <path d="M7 42 A25 25 0 0 1 57 42" stroke="var(--acc-leaf)" strokeWidth="4" />
        <path d="M11 42 A21 21 0 0 1 53 42" stroke="var(--acc-sky)" strokeWidth="4" />
      </g>
    ),
  },

  // ── 毛色 ────────────────────────────────────────────────
  'fur-orange': { kind: 'fur', className: 'cb-fur-orange' },
  'fur-gray': { kind: 'fur', className: 'cb-fur-gray' },
  'fur-black': { kind: 'fur', className: 'cb-fur-black' },
  'fur-gold': { kind: 'fur', className: 'cb-fur-gold' },
};
