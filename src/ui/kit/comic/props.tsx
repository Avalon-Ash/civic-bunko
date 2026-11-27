// 四格漫畫的道具圖（ADR 0020）。一個道具一筆：viewBox 64×64、底邊貼著 y=60（站在地上）。
// 畫法比照衣櫥配件（kit/wardrobe/art.tsx）：線條 var(--cat-line)、填色只用 theme.css 的 --acc-* 與 --surface 等 token，日夜兩套自動切換。
// 名稱在 constants/comic.ts 的 COMIC_PROPS；這裡的 Record 讓每個道具一定有圖（tsc 守門）。
import type { ReactNode } from 'react';
import type { ComicPropId } from '../../../core/types';

const LINE = 'var(--cat-line)';
const stroke = { stroke: LINE, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { stroke: LINE, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const fine = { stroke: LINE, strokeWidth: 1.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const OFFICE_WINDOWS = [
  [17, 26],
  [29, 26],
  [41, 26],
  [17, 36],
  [29, 36],
  [41, 36],
  [17, 46],
  [41, 46],
] as const;

const COIN_LAYERS = [
  [31, 51],
  [31, 44.5],
  [31, 38],
  [31, 31.5],
  [16, 53],
  [16, 46.5],
  [47, 53],
  [47, 46.5],
  [47, 40],
] as const;

const FENCE_PICKETS = [10, 21, 32, 43, 54] as const;

const RAINDROPS = [
  [11, 10],
  [45, 5.5],
  [54, 12],
] as const;

const TEST_ROWS = [
  [26, true],
  [34.5, false],
  [43, true],
  [51.5, false],
] as const;

const BENCH_SLATS = [32, 39] as const;

/** 暫時的圓角方塊：還沒畫的道具（派工單 docs/dispatch/CC4c-props.md 會換掉並刪掉這個函式） */
function draft(): ReactNode {
  return <rect x="10" y="18" width="44" height="42" rx="8" fill="var(--acc-shade)" {...stroke} />;
}

export const PROP_ART: Readonly<Record<ComicPropId, ReactNode>> = {
  stamp: (
    <g>
      <path
        d="M17 37 C17 29 12.5 25 12.5 17 C12.5 10.5 16.5 7 22 7 C27.5 7 31.5 10.5 31.5 17 C31.5 25 27 29 27 37 Z"
        fill="var(--acc-wood)"
        {...stroke}
      />
      <path d="M16.5 14 Q17.8 10.5 21 10" fill="none" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.65" />
      <rect x="6" y="36" width="32" height="14" rx="4" fill="var(--acc-wood)" {...stroke} />
      <rect x="8" y="50" width="28" height="9" rx="3" fill="var(--acc-coral)" {...stroke} />
      <g transform="rotate(-7 50.5 51)">
        <rect x="43" y="43.5" width="15" height="15" rx="2.5" fill="var(--acc-cream)" stroke="var(--acc-coral)" strokeWidth="2.4" />
        <path
          d="M46.5 47.5 H54.5 M46.5 51 H54.5 M46.5 54.5 H51 M50.5 47.5 V54.5"
          fill="none"
          stroke="var(--acc-coral)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </g>
    </g>
  ),
  document: (
    <g>
      <path d="M15 6 H40 L52 18 V56 Q52 59 49 59 H15 Q12 59 12 56 V9 Q12 6 15 6 Z" fill="var(--acc-cream)" {...stroke} />
      <path d="M40 6 V15 Q40 18 43 18 H52 Z" fill="var(--acc-silver)" {...stroke} />
      <path d="M18 16 H34" fill="none" stroke="var(--acc-navy)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M18 25 H46 M18 32 H46 M18 39 H42 M18 46 H30" fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
      <rect x="35" y="43" width="12" height="12" rx="2" fill="var(--acc-coral)" {...thin} />
      <path d="M38 46.5 H44 M38 49 H44 M41 46.5 V52" fill="none" stroke="var(--acc-cream)" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  ticket: (
    <g>
      <path
        d="M11 9.5 L15.2 5 L19.4 9.5 L23.6 5 L27.8 9.5 L32 5 L36.2 9.5 L40.4 5 L44.6 9.5 L48.8 5 L53 9.5 V56 Q53 59 50 59 H14 Q11 59 11 56 Z"
        fill="var(--acc-cream)"
      />
      <path
        d="M11 9.5 L15.2 5 L19.4 9.5 L23.6 5 L27.8 9.5 L32 5 L36.2 9.5 L40.4 5 L44.6 9.5 L48.8 5 L53 9.5 V17.5 H11 Z"
        fill="var(--acc-coral)"
      />
      <path d="M21 13.5 H43" fill="none" stroke="var(--acc-cream)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11 17.5 H53" fill="none" {...thin} />
      <path
        d="M11 9.5 L15.2 5 L19.4 9.5 L23.6 5 L27.8 9.5 L32 5 L36.2 9.5 L40.4 5 L44.6 9.5 L48.8 5 L53 9.5 V56 Q53 59 50 59 H14 Q11 59 11 56 Z"
        fill="none"
        {...stroke}
      />
      <path d="M29.8 22 Q29.8 20.5 32 20.5 Q34.2 20.5 34.2 22 L33.5 29.5 Q33.3 31 32 31 Q30.7 31 30.5 29.5 Z" fill="var(--acc-coral)" {...fine} />
      <circle cx="32" cy="34.8" r="2.3" fill="var(--acc-coral)" {...fine} />
      <rect x="15.5" y="40" width="23" height="13.5" rx="2" fill="var(--acc-rose)" {...thin} />
      <path d="M19.5 44.5 H24.5 M28.5 44.5 H34.5 M19.5 49.5 H34.5" fill="none" stroke={LINE} strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="46.5" cy="51.5" r="6.3" fill="var(--acc-coral)" {...thin} />
      <circle cx="46.5" cy="51.5" r="3.8" fill="none" stroke="var(--acc-cream)" strokeWidth="1.2" />
      <path d="M44.8 50.2 H48.2 M46.5 50.2 V53" fill="none" stroke="var(--acc-cream)" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  ),
  envelope: (
    <g>
      <rect x="5" y="20" width="54" height="38" rx="5" fill="var(--acc-cream)" {...stroke} />
      <path d="M7 56 L25 40 M57 56 L39 40" fill="none" {...thin} strokeOpacity="0.5" />
      <path d="M7 23 L32 43.5 L57 23" fill="none" stroke="var(--acc-silver)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.55" />
      <path d="M6.5 21.5 L30 40.5 Q32 42 34 40.5 L57.5 21.5" fill="var(--acc-cream)" {...stroke} />
      <circle cx="32" cy="40" r="6.8" fill="var(--acc-coral)" {...stroke} />
      <circle cx="32" cy="40" r="3.8" fill="none" stroke="var(--acc-cream)" strokeWidth="1.3" strokeOpacity="0.85" />
    </g>
  ),
  hourglass: (
    <g>
      <path
        d="M17 13 H47 V18 C47 26 36 30 35 33 C36 36 47 40 47 48 V53 H17 V48 C17 40 28 36 29 33 C28 30 17 26 17 18 Z"
        fill="var(--acc-sky)"
      />
      <path d="M23 25 Q32 27.5 41 25 C39 28.5 34.5 31 32 32.5 C29.5 31 25 28.5 23 25 Z" fill="var(--acc-gold)" />
      <path d="M32 32 V42" fill="none" stroke="var(--acc-gold)" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 53 V48.5 Q24 41 32 39.5 Q40 41 46 48.5 V53 Z" fill="var(--acc-gold)" />
      <path
        d="M21 17 C21 21 23 24 25 26 M21 49 C21 45 23 42 25 40"
        fill="none"
        stroke="var(--acc-cream)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <path
        d="M17 13 H47 V18 C47 26 36 30 35 33 C36 36 47 40 47 48 V53 H17 V48 C17 40 28 36 29 33 C28 30 17 26 17 18 Z"
        fill="none"
        {...stroke}
      />
      <rect x="13" y="6" width="38" height="7" rx="3.2" fill="var(--acc-wood)" {...stroke} />
      <rect x="13" y="53" width="38" height="7" rx="3.2" fill="var(--acc-wood)" {...stroke} />
    </g>
  ),
  calendar: (
    <g>
      <rect x="9" y="13" width="46" height="46" rx="6" fill="var(--acc-cream)" {...stroke} />
      <path d="M9 19 Q9 13 15 13 H49 Q55 13 55 19 V25 H9 Z" fill="var(--acc-coral)" {...stroke} />
      <rect x="18" y="6" width="6" height="12" rx="3" fill="var(--acc-silver)" {...stroke} />
      <rect x="40" y="6" width="6" height="12" rx="3" fill="var(--acc-silver)" {...stroke} />
      <path d="M26 29 V55 M38 29 V55 M14 37.5 H50 M14 46.5 H50" fill="none" stroke={LINE} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.35" />
      <path
        d="M18 33 H22 M30 33 H34 M42 33 H46 M18 42 H22 M30 42 H34 M18 51 H22 M30 51 H34 M42 51 H46"
        fill="none"
        stroke={LINE}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeOpacity="0.32"
      />
      <circle cx="44" cy="42" r="2.2" fill="var(--acc-coral)" />
      <circle cx="44" cy="42" r="5.8" fill="none" stroke="var(--acc-coral)" strokeWidth="2.6" />
    </g>
  ),
  courthouse: (
    <g>
      <rect x="12" y="31" width="40" height="19" fill="var(--acc-navy)" {...thin} />
      {[14, 28.5, 43].map((x) => (
        <rect key={x} x={x} y="31" width="7" height="19" rx="1.4" fill="var(--acc-cream)" {...stroke} />
      ))}
      <rect x="9" y="27" width="46" height="4.5" rx="1.4" fill="var(--acc-silver)" {...stroke} />
      <path d="M5 27 L32 6 L59 27 Z" fill="var(--acc-cream)" {...stroke} />
      <path d="M13 24.8 L32 10 L51 24.8 Z" fill="var(--acc-night)" {...fine} />
      <path d="M32 14 V23.2 M28.5 23.2 H35.5 M24.5 17 H39.5" fill="none" stroke="var(--acc-gold)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24.5 17 V21 M39.5 17 V21" fill="none" stroke="var(--acc-gold)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M22 21 Q24.5 23.8 27 21 Z M37 21 Q39.5 23.8 42 21 Z" fill="var(--acc-gold)" />
      <rect x="9" y="50" width="46" height="5" rx="1.6" fill="var(--acc-cream)" {...stroke} />
      <rect x="5" y="55" width="54" height="5" rx="1.8" fill="var(--acc-silver)" {...stroke} />
    </g>
  ),
  office: (
    <g>
      <path d="M32 18 V6" fill="none" {...stroke} />
      <path d="M32 6.5 Q38.5 5 45 7.5 V14 Q38.5 11.5 32 13.5 Z" fill="var(--acc-coral)" {...thin} />
      <rect x="12" y="21" width="40" height="39" rx="2.5" fill="var(--acc-navy)" {...stroke} />
      <rect x="10" y="17" width="44" height="5" rx="2" fill="var(--acc-silver)" {...stroke} />
      {OFFICE_WINDOWS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1.2" fill="var(--acc-cream)" {...fine} />
      ))}
      <rect x="27" y="47" width="10" height="13" rx="1.5" fill="var(--acc-sky)" {...thin} />
      <path d="M32 47 V60" fill="none" {...fine} />
    </g>
  ),
  pothole: (
    <g>
      <path d="M9 33 H55 Q58 33 58.5 36 L60 57 Q60 60 57 60 H7 Q4 60 4 57 L5.5 36 Q6 33 9 33 Z" fill="var(--acc-silver)" {...stroke} />
      <rect x="45.5" y="31" width="12" height="4" rx="1.6" fill="var(--acc-orange)" {...thin} />
      <path d="M47.6 31 L50.4 17 Q51.5 15 52.6 17 L55.4 31 Z" fill="var(--acc-orange)" {...thin} />
      <path d="M49 25 H54 L53.3 21.2 H49.7 Z" fill="var(--acc-cream)" {...fine} />
      <path
        d="M11 49 L15 41.5 L20.5 43.5 L26 39 L33.5 41.5 L39.5 39.5 L44.5 46 L41.5 50.5 L44 53.5 L36 56 L29 54.5 L22 56.5 L15 53 Z"
        fill="var(--acc-shade)"
      />
      <path
        d="M11 49 L15 41.5 L20.5 43.5 L26 39 L33.5 41.5 L39.5 39.5 L44.5 46 L41.5 48 L39.5 45 L33.5 47 L26 44.5 L20.5 49 L15 47 Z"
        fill="var(--acc-wood)"
      />
      <path d="M15 41.5 V47 M26 39 V44.5 M33.5 41.5 V47 M39.5 39.5 V45" fill="none" {...fine} />
      <path
        d="M11 49 L15 41.5 L20.5 43.5 L26 39 L33.5 41.5 L39.5 39.5 L44.5 46 L41.5 50.5 L44 53.5 L36 56 L29 54.5 L22 56.5 L15 53 Z"
        fill="none"
        stroke="var(--acc-silver)"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M11 49 L15 41.5 L20.5 43.5 L26 39 L33.5 41.5 L39.5 39.5 L44.5 46 L41.5 50.5 L44 53.5 L36 56 L29 54.5 L22 56.5 L15 53 Z"
        fill="none"
        {...thin}
      />
      <path d="M16 54.5 L22 57.6 L29 55.8 L36 57.3 L42.8 55" fill="none" stroke="var(--acc-cream)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13 43 L9 39.5 M26 39 L27.5 35.5 M44 46 L49.5 44.5 M21 56.5 L18 59" fill="none" {...fine} />
      <path
        d="M14 35.5 L19.5 34.5 L21 38 L15.5 38.8 Z M36.5 35.5 L41.5 35 L42.5 38.2 L38 38.5 Z M7 49 L10.5 47.8 L11 52 L7.5 53 Z M45 53 L50.5 51.8 L51.5 55.8 L46 56.8 Z"
        fill="var(--acc-silver)"
        {...fine}
      />
    </g>
  ),
  lamp: (
    <g>
      <path d="M16 56 V14 Q16 7 24 7 H35 Q41 7 41 12.5" fill="none" stroke={LINE} strokeWidth="6.8" strokeLinecap="round" />
      <path d="M16 56 V14 Q16 7 24 7 H35 Q41 7 41 12.5" fill="none" stroke="var(--acc-silver)" strokeWidth="2.8" strokeLinecap="round" />
      <rect x="13" y="50" width="6" height="5.5" rx="1.4" fill="var(--acc-sky)" {...thin} />
      <rect x="11" y="55.5" width="10" height="4.5" rx="1.5" fill="var(--acc-silver)" {...stroke} />
      <ellipse cx="39.5" cy="23.5" rx="4.5" ry="3.6" fill="var(--acc-cream)" {...thin} />
      <path
        d="M41 11.5 Q32 12 28 21.5 L39.5 23.5 L44.5 19.5 L42 16.5 L49.5 15.8 Q46.5 12 41 11.5 Z"
        fill="var(--acc-sky)"
        {...stroke}
      />
      <path d="M51 19 L45.5 27.5 H51.5 L47.5 36.5 L59 25 H53 L56.5 19 Z" fill="var(--acc-gold)" {...thin} />
    </g>
  ),
  target: (
    <g>
      <path d="M16 49 L11 60 H16 L21 51 Z M44 49 L49 60 H44 L39 51 Z" fill="var(--acc-wood)" {...stroke} />
      <circle cx="30" cy="35" r="21" fill="var(--acc-coral)" {...stroke} />
      <circle cx="30" cy="35" r="14" fill="var(--acc-cream)" {...thin} />
      <circle cx="30" cy="35" r="7" fill="var(--acc-coral)" {...thin} />
      <circle cx="30" cy="35" r="2.2" fill={LINE} />
      <path d="M30 35 L51 14" fill="none" stroke={LINE} strokeWidth="5" strokeLinecap="round" />
      <path d="M30 35 L51 14" fill="none" stroke="var(--acc-wood)" strokeWidth="2.2" strokeLinecap="round" />
      <g transform="translate(51 14) rotate(-45)">
        <path d="M-8 0 L-3 -6 H5 L1 0 Z M-8 0 L-3 6 H5 L1 0 Z" fill="var(--acc-gold)" {...thin} />
      </g>
    </g>
  ),
  door: (
    <g>
      <path d="M10 56 V28 A22 22 0 0 1 54 28 V56 Z" fill="var(--acc-silver)" {...stroke} />
      <path d="M15 56 V28 A17 17 0 0 1 49 28 V56 Z" fill="var(--acc-wood)" {...stroke} />
      <path d="M32 11 V56" fill="none" {...stroke} />
      <path
        d="M18.5 32 V28 Q19 19 28.5 16.5 V32 Z M45.5 32 V28 Q45 19 35.5 16.5 V32 Z"
        fill="none"
        stroke={LINE}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeOpacity="0.45"
      />
      <rect x="18.5" y="42" width="10" height="10" rx="1.8" fill="none" stroke={LINE} strokeWidth="1.4" strokeOpacity="0.45" />
      <rect x="35.5" y="42" width="10" height="10" rx="1.8" fill="none" stroke={LINE} strokeWidth="1.4" strokeOpacity="0.45" />
      <circle cx="26.8" cy="37" r="2.6" fill="var(--acc-gold)" {...thin} />
      <circle cx="37.2" cy="37" r="2.6" fill="var(--acc-gold)" {...thin} />
      <rect x="7" y="56" width="50" height="4" rx="1.6" fill="var(--acc-silver)" {...stroke} />
    </g>
  ),
  'torn-paper': (
    <g>
      <g transform="rotate(-3 18 56)">
        <path
          d="M11 8 H29.5 L32 16 L27 24 L32 33 L27 42 L31.5 50 L29 58 H11 Q8.5 58 8.5 55.5 V10.5 Q8.5 8 11 8 Z"
          fill="var(--acc-cream)"
        />
        <path d="M13.5 15.5 H30.8" fill="none" stroke="var(--acc-navy)" strokeWidth="3" strokeLinecap="round" />
        <path d="M13.5 23 H27.1 M13.5 30.5 H30" fill="none" stroke={LINE} strokeWidth="2.1" strokeLinecap="round" strokeOpacity="0.65" />
        <path d="M30.05 36.52 A8.5 8.5 0 1 0 30.41 53.45 L31.5 50 L27 42 Z" fill="var(--acc-coral)" />
        <path d="M27.8 39.9 A5.4 5.4 0 0 0 29.5 50.4 M26 45 H28.3" fill="none" stroke="var(--acc-cream)" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M11 8 H29.5 L32 16 L27 24 L32 33 L27 42 L31.5 50 L29 58 H11 Q8.5 58 8.5 55.5 V10.5 Q8.5 8 11 8 Z"
          fill="none"
          {...stroke}
        />
      </g>
      <g transform="rotate(3 46 56)">
        <path
          d="M34.5 8 H53 Q55.5 8 55.5 10.5 V55.5 Q55.5 58 53 58 H34 L36.5 50 L32 42 L37 33 L32 24 L37 16 Z"
          fill="var(--acc-cream)"
        />
        <path d="M37.9 15.5 H50.5" fill="none" stroke="var(--acc-navy)" strokeWidth="3" strokeLinecap="round" />
        <path d="M33.2 23 H50.5 M36.2 30.5 H50.5" fill="none" stroke={LINE} strokeWidth="2.1" strokeLinecap="round" strokeOpacity="0.65" />
        <path d="M35.05 36.52 A8.5 8.5 0 0 1 35.41 53.45 L36.5 50 L32 42 Z" fill="var(--acc-coral)" />
        <path d="M34.5 39.6 A5.4 5.4 0 0 1 37.2 49.7 M34.4 45 H38" fill="none" stroke="var(--acc-cream)" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M34.5 8 H53 Q55.5 8 55.5 10.5 V55.5 Q55.5 58 53 58 H34 L36.5 50 L32 42 L37 33 L32 24 L37 16 Z"
          fill="none"
          {...stroke}
        />
      </g>
    </g>
  ),
  eraser: (
    <g>
      <path d="M8 42 H56 Q58.5 42 59 45 L60 56.5 Q60 59.5 57 59.5 H7 Q4 59.5 4 56.5 L5 45 Q5.5 42 8 42 Z" fill="var(--acc-cream)" {...stroke} />
      <path d="M10 53.5 Q18 46.5 29.5 49.5 Q33 51 29 54.5 Q19 57 10 53.5 Z" fill="var(--acc-silver)" fillOpacity="0.5" />
      <path d="M13 49.5 H17 M21 49.5 H24.5" fill="none" stroke={LINE} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.25" />
      <path d="M36 48.5 H52 M40 54 H52" fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.72" />
      <ellipse cx="13" cy="54.5" rx="2.4" ry="1.4" transform="rotate(-14 13 54.5)" fill="var(--acc-rose)" {...fine} />
      <circle cx="19.5" cy="55.8" r="1.5" fill="var(--acc-rose)" {...fine} />
      <ellipse cx="34.5" cy="54.8" rx="2.2" ry="1.3" transform="rotate(18 34.5 54.8)" fill="var(--acc-rose)" {...fine} />
      <circle cx="15" cy="47.5" r="1.3" fill="var(--acc-rose)" {...fine} />
      <g transform="translate(36 27) rotate(-38)">
        <rect x="-20.5" y="-9.5" width="19" height="19" rx="3.5" fill="var(--acc-rose)" {...stroke} />
        <path d="M-19.5 5 H-2 V8.5 H-17 Q-19.5 8.5 -19.5 6 Z" fill="var(--pink-deep)" fillOpacity="0.4" />
        <path d="M-16.5 -6 H-8.5" fill="none" stroke="var(--acc-cream)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.85" />
        <rect x="-4" y="-10.5" width="24.5" height="21" rx="2.8" fill="var(--acc-navy)" />
        <rect x="2.5" y="-10.5" width="7.5" height="21" fill="var(--acc-sky)" />
        <rect x="10" y="-10.5" width="4" height="21" fill="var(--acc-cream)" />
        <path d="M2.5 -10.5 V10.5 M10 -10.5 V10.5 M14 -10.5 V10.5" fill="none" {...fine} />
        <rect x="-4" y="-10.5" width="24.5" height="21" rx="2.8" fill="none" {...stroke} />
      </g>
    </g>
  ),
  coins: (
    <g>
      {COIN_LAYERS.map(([cx, y]) => (
        <g key={`${cx}-${y}`}>
          <path d={`M${cx - 10.5} ${y - 3.5} V${y + 2} A10.5 4 0 0 0 ${cx + 10.5} ${y + 2} V${y - 3.5} Z`} fill="var(--acc-orange)" {...stroke} />
          <path
            d={`M${cx - 5.5} ${y + 0.5} V${y + 4.4} M${cx} ${y + 1.2} V${y + 5} M${cx + 5.5} ${y + 0.5} V${y + 4.4}`}
            fill="none"
            stroke={LINE}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeOpacity="0.65"
          />
          <ellipse cx={cx} cy={y - 3.5} rx="10.5" ry="4" fill="var(--acc-gold)" {...thin} />
        </g>
      ))}
      <circle cx="31" cy="17.5" r="11.5" fill="var(--acc-gold)" {...stroke} />
      <circle cx="31" cy="17.5" r="8.2" fill="none" stroke="var(--acc-orange)" strokeWidth="1.8" />
      <path d="M24 12.8 A8.2 8.2 0 0 1 29.5 9.6" fill="none" stroke="var(--acc-cream)" strokeWidth="1.7" strokeLinecap="round" strokeOpacity="0.85" />
      <rect x="27.8" y="14.3" width="6.4" height="6.4" rx="1.1" fill="var(--acc-cream)" {...thin} />
    </g>
  ),
  scissors: (
    <g>
      <path d="M19 27 L22 25 L28 33 L49 39.5 Q50.5 40.5 49 42 Q41 46 26 39 Z" fill="var(--acc-silver)" {...stroke} />
      <path d="M45 6 H55 Q57 6 57 8 V31.5 L43 35 V8 Q43 6 45 6 Z" fill="var(--acc-cream)" {...stroke} />
      <path d="M46.5 12 H53.5" fill="none" stroke="var(--acc-navy)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M46.5 18 H53.5 M46.5 23.5 H52.5" fill="none" stroke={LINE} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.65" />
      <g transform="translate(49 49.5) rotate(15)">
        <path d="M-7 -6.5 L7 -8.5 V6 Q7 8 5 8 H-5 Q-7 8 -7 6 Z" fill="var(--acc-cream)" {...stroke} />
        <path d="M-4 -1 H4 M-4 3.5 H2.5" fill="none" stroke={LINE} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.65" />
      </g>
      <path d="M56.5 38 L59.5 40.5 M37.5 43 L35 46.5" fill="none" {...fine} />
      <path d="M19 42 L26 30 Q42 21 51 25.5 Q52.5 26.5 51 28 L28 36 L22 44 Z" fill="var(--acc-silver)" {...stroke} />
      <circle cx="15" cy="21" r="6.8" fill="none" stroke={LINE} strokeWidth="7.8" />
      <circle cx="15" cy="21" r="6.8" fill="none" stroke="var(--acc-coral)" strokeWidth="3.6" />
      <circle cx="15" cy="48.5" r="6.8" fill="none" stroke={LINE} strokeWidth="7.8" />
      <circle cx="15" cy="48.5" r="6.8" fill="none" stroke="var(--acc-coral)" strokeWidth="3.6" />
      <circle cx="28" cy="34.5" r="2.7" fill="var(--acc-gold)" {...fine} />
    </g>
  ),
  handcuffs: (
    <g>
      <ellipse cx="26.4" cy="24.4" rx="4.8" ry="3.2" transform="rotate(-38 26.4 24.4)" fill="var(--acc-silver)" {...stroke} />
      <path d="M25.3 25.3 L27.5 23.5" fill="none" {...fine} />
      <ellipse cx="37.6" cy="25.2" rx="4.8" ry="3.2" transform="rotate(38 37.6 25.2)" fill="var(--acc-silver)" {...stroke} />
      <path d="M36.5 24.3 L38.7 26.1" fill="none" {...fine} />
      <ellipse cx="32" cy="21.4" rx="5" ry="3.3" transform="rotate(3 32 21.4)" fill="var(--acc-silver)" {...stroke} />
      <path d="M30.5 21.3 L33.5 21.5" fill="none" {...fine} />
      <circle cx="18.5" cy="45" r="8.8" fill="none" stroke={LINE} strokeWidth="8.2" />
      <circle cx="18.5" cy="45" r="8.8" fill="none" stroke="var(--acc-silver)" strokeWidth="4.2" />
      <path d="M11.6 41.5 A7.8 7.8 0 0 1 16.5 36.8" fill="none" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.85" />
      <circle cx="12.4" cy="51.2" r="1.4" fill={LINE} />
      <g transform="translate(23 32.5) rotate(24)">
        <rect x="-4.8" y="-5" width="9.6" height="10" rx="2.6" fill="var(--acc-silver)" {...stroke} />
        <circle cx="0" cy="0.5" r="1.6" fill={LINE} />
      </g>
      <circle cx="45.5" cy="46" r="8.8" fill="none" stroke={LINE} strokeWidth="8.2" />
      <circle cx="45.5" cy="46" r="8.8" fill="none" stroke="var(--acc-silver)" strokeWidth="4.2" />
      <path d="M47.5 37.8 A7.8 7.8 0 0 1 52.4 42.5" fill="none" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.85" />
      <circle cx="51.6" cy="52.2" r="1.4" fill={LINE} />
      <g transform="translate(41 33.5) rotate(-24)">
        <rect x="-4.8" y="-5" width="9.6" height="10" rx="2.6" fill="var(--acc-silver)" {...stroke} />
        <circle cx="0" cy="0.5" r="1.6" fill={LINE} />
      </g>
    </g>
  ),
  'ballot-box': (
    <g>
      <path d="M13 20 H51 L56.5 29.5 H7.5 Z" fill="var(--acc-silver)" {...stroke} />
      <rect x="15" y="23.2" width="34" height="3.8" rx="1.9" fill="var(--acc-shade)" {...fine} />
      <path d="M20 26.4 V8.5 Q20 6 22.5 6 H41.5 Q44 6 44 8.5 V26.4" fill="var(--acc-cream)" {...stroke} />
      <rect x="26" y="10.2" width="12" height="12" rx="1.6" fill="none" {...thin} />
      <path
        d="M28.8 16.4 L31.6 19.2 L36.4 12.8"
        fill="none"
        stroke="var(--acc-coral)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 26.6 H49" fill="none" {...stroke} />
      <rect x="8" y="33.5" width="48" height="22" fill="var(--acc-cream)" {...stroke} />
      <rect x="6.5" y="29" width="51" height="5.5" rx="2" fill="var(--acc-navy)" {...stroke} />
      <rect x="6.5" y="54.5" width="51" height="5" rx="2" fill="var(--acc-navy)" {...stroke} />
      <rect x="14" y="39.5" width="36" height="10" rx="2.5" fill="var(--acc-sky)" {...thin} />
      <path d="M20 44.5 H44" fill="none" stroke="var(--acc-navy)" strokeWidth="2.8" strokeLinecap="round" />
    </g>
  ),
  crown: (
    <g>
      <circle cx="7.5" cy="54" r="2.6" fill="var(--acc-gold)" {...thin} />
      <circle cx="56.5" cy="54" r="2.6" fill="var(--acc-gold)" {...thin} />
      <path
        d="M9 48 Q13 43 32 43 Q51 43 55 48 Q57 52 54 56.5 Q51 59.5 32 59.5 Q13 59.5 10 56.5 Q7 52 9 48 Z"
        fill="var(--acc-coral)"
        {...stroke}
      />
      <path d="M15 47.5 Q32 45 49 47.5" fill="none" stroke="var(--acc-rose)" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.65" />
      <path d="M13 55.2 Q32 57.5 51 55.2" fill="none" stroke={LINE} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.35" />
      <path
        d="M15 44 L11.5 22 Q18 29 23 29 Q27.5 28 32 16.5 Q36.5 28 41 29 Q46 29 52.5 22 L49 44 Q32 47 15 44 Z"
        fill="var(--acc-gold)"
      />
      <path d="M13.8 36.5 Q32 39 50.2 36.5 L49 44 Q32 47 15 44 Z" fill="var(--acc-orange)" {...thin} />
      <path
        d="M15 44 L11.5 22 Q18 29 23 29 Q27.5 28 32 16.5 Q36.5 28 41 29 Q46 29 52.5 22 L49 44 Q32 47 15 44 Z"
        fill="none"
        {...stroke}
      />
      <path d="M32 38.6 L35 41.8 L32 44.8 L29 41.8 Z" fill="var(--acc-coral)" {...fine} />
      <circle cx="21.5" cy="40.8" r="2.3" fill="var(--acc-sky)" {...fine} />
      <circle cx="42.5" cy="40.8" r="2.3" fill="var(--acc-sky)" {...fine} />
      <circle cx="11.5" cy="19" r="3.2" fill="var(--acc-gold)" {...stroke} />
      <circle cx="32" cy="13" r="3.8" fill="var(--acc-gold)" {...stroke} />
      <circle cx="52.5" cy="19" r="3.2" fill="var(--acc-gold)" {...stroke} />
      <circle cx="30.6" cy="11.7" r="1.1" fill="var(--acc-cream)" />
    </g>
  ),
  scale: (
    <g>
      <path d="M13.5 17.5 L6.5 37 M13.5 17.5 L20.5 37 M50.5 17.5 L43.5 37 M50.5 17.5 L57.5 37" fill="none" stroke="var(--acc-gold)" strokeWidth="3" strokeLinecap="round" />
      <path d="M13.5 17.5 L6.5 37 M13.5 17.5 L20.5 37 M50.5 17.5 L43.5 37 M50.5 17.5 L57.5 37" fill="none" {...fine} />
      <rect x="29.5" y="16" width="5" height="33" rx="2" fill="var(--acc-gold)" {...stroke} />
      <path d="M22 54 Q23 48 32 48 Q41 48 42 54 Z" fill="var(--acc-gold)" {...stroke} />
      <rect x="16" y="54" width="32" height="5.5" rx="2.5" fill="var(--acc-wood)" {...stroke} />
      <rect x="10" y="13.5" width="44" height="4.2" rx="2.1" fill="var(--acc-gold)" {...stroke} />
      <path d="M32 7 L34.6 12.2 H29.4 Z" fill="var(--acc-orange)" {...thin} />
      <circle cx="32" cy="15.6" r="4.2" fill="var(--acc-gold)" {...stroke} />
      <circle cx="30.8" cy="14.4" r="1.1" fill="var(--acc-cream)" />
      <circle cx="13.5" cy="15.6" r="2.2" fill="var(--acc-orange)" {...fine} />
      <circle cx="50.5" cy="15.6" r="2.2" fill="var(--acc-orange)" {...fine} />
      <circle cx="13.5" cy="33" r="5" fill="var(--acc-coral)" {...stroke} />
      <path d="M10.8 31.2 A3.2 3.2 0 0 1 13.2 29.8" fill="none" stroke="var(--acc-cream)" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.85" />
      <rect x="46" y="28.5" width="9" height="9" rx="2" fill="var(--acc-sky)" {...stroke} />
      <path d="M48.2 31 H51.5" fill="none" stroke="var(--acc-cream)" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.85" />
      <path d="M4.5 37 H22.5 C21.5 43.5 17.5 44.5 13.5 44.5 C9.5 44.5 5.5 43.5 4.5 37 Z" fill="var(--acc-gold)" {...stroke} />
      <path d="M41.5 37 H59.5 C58.5 43.5 54.5 44.5 50.5 44.5 C46.5 44.5 42.5 43.5 41.5 37 Z" fill="var(--acc-gold)" {...stroke} />
    </g>
  ),
  fence: (
    <g>
      <rect x="4.5" y="29" width="55" height="5.8" rx="2.4" fill="var(--acc-wood)" {...stroke} />
      <rect x="4.5" y="47" width="55" height="5.8" rx="2.4" fill="var(--acc-wood)" {...stroke} />
      {FENCE_PICKETS.map((cx) => (
        <g key={cx}>
          <path
            d={`M${cx - 4} 25.5 L${cx} 18.5 L${cx + 4} 25.5 V57.5 Q${cx + 4} 59.5 ${cx + 2} 59.5 H${cx - 2} Q${cx - 4} 59.5 ${cx - 4} 57.5 Z`}
            fill="var(--acc-wood)"
            {...stroke}
          />
          <circle cx={cx} cy="31.9" r="1.2" fill="var(--acc-silver)" />
          <circle cx={cx} cy="49.9" r="1.2" fill="var(--acc-silver)" />
        </g>
      ))}
      <circle cx="32" cy="40.8" r="7.5" fill="var(--acc-coral)" {...thin} />
      <circle cx="32" cy="40.8" r="4.8" fill="var(--acc-cream)" {...fine} />
      <path d="M28.8 37.6 L35.2 44" fill="none" stroke="var(--acc-coral)" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  ),
  umbrella: (
    <g>
      {RAINDROPS.map(([x, y]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${y} C${x + 3.6} ${y + 4.2} ${x + 3.6} ${y + 8.2} ${x} ${y + 8.2} C${x - 3.6} ${y + 8.2} ${x - 3.6} ${y + 4.2} ${x} ${y} Z`}
          fill="var(--acc-sky)"
          {...thin}
        />
      ))}
      <path d="M32 34 V49" fill="none" stroke={LINE} strokeWidth="5.4" strokeLinecap="round" />
      <path d="M32 34 V49" fill="none" stroke="var(--acc-silver)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M32 47.5 V51 A5.2 5.2 0 0 1 21.6 51" fill="none" stroke={LINE} strokeWidth="7" strokeLinecap="round" />
      <path d="M32 47.5 V51 A5.2 5.2 0 0 1 21.6 51" fill="none" stroke="var(--acc-wood)" strokeWidth="3" strokeLinecap="round" />
      <rect x="30.2" y="11.5" width="3.6" height="5.5" rx="1.8" fill="var(--acc-gold)" {...thin} />
      <path
        d="M6 37 C6 21 18 16.5 32 16.5 C46 16.5 58 21 58 37 Q51.5 31.5 45 37 Q38.5 31.5 32 37 Q25.5 31.5 19 37 Q12.5 31.5 6 37 Z"
        fill="var(--acc-lav)"
      />
      <path d="M32 16.5 Q22 23 19 37 Q25.5 31.5 32 37 Z" fill="var(--acc-cream)" fillOpacity="0.32" />
      <path d="M32 16.5 Q42 23 45 37 Q51.5 31.5 58 37 C58 21 46 16.5 32 16.5 Z" fill="var(--acc-cream)" fillOpacity="0.32" />
      <path d="M32 16.5 Q22 23 19 37 M32 16.5 V37 M32 16.5 Q42 23 45 37" fill="none" {...thin} />
      <path d="M12.5 27.5 Q16.5 20.8 24.5 19.2" fill="none" stroke="var(--acc-cream)" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.85" />
      <path
        d="M6 37 C6 21 18 16.5 32 16.5 C46 16.5 58 21 58 37 Q51.5 31.5 45 37 Q38.5 31.5 32 37 Q25.5 31.5 19 37 Q12.5 31.5 6 37 Z"
        fill="none"
        {...stroke}
      />
    </g>
  ),
  magnifier: (
    <g>
      <g transform="translate(26 25) rotate(45)">
        <rect x="17.5" y="-3.8" width="6.5" height="7.6" rx="1.8" fill="var(--acc-silver)" {...stroke} />
        <rect x="23" y="-5" width="21.5" height="10" rx="5" fill="var(--acc-wood)" {...stroke} />
        <path d="M27.5 -1.8 H40.5" fill="none" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.55" />
      </g>
      <circle cx="26" cy="25" r="18.5" fill="var(--acc-gold)" {...stroke} />
      <circle cx="26" cy="25" r="13.5" fill="var(--acc-sky)" {...stroke} />
      <path d="M20.5 33.5 L33.5 20.5" fill="none" stroke="var(--acc-cream)" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.4" />
      <path d="M17.5 23 A9.5 9.5 0 0 1 25 15.5" fill="none" stroke="var(--acc-cream)" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.9" />
      <circle cx="17.2" cy="27.5" r="1.6" fill="var(--acc-cream)" fillOpacity="0.9" />
    </g>
  ),
  'test-paper': (
    <g>
      <rect x="7" y="6.5" width="38" height="52.5" rx="4.5" fill="var(--acc-cream)" {...stroke} />
      <path d="M13 14 H31" fill="none" stroke="var(--acc-navy)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M13 19 H38" fill="none" stroke={LINE} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.35" />
      {TEST_ROWS.map(([y, filled]) => (
        <g key={y}>
          <circle cx="16.5" cy={y} r="3" fill={filled ? 'var(--acc-navy)' : 'var(--acc-cream)'} {...thin} />
          <path d={`M23 ${y} H37.5`} fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.65" />
        </g>
      ))}
      <g transform="translate(47.5 37.5) rotate(16)">
        <path d="M-4.5 -17 V-20.5 Q-4.5 -23.5 0 -23.5 Q4.5 -23.5 4.5 -20.5 V-17 Z" fill="var(--acc-rose)" {...stroke} />
        <rect x="-4.5" y="-17" width="9" height="4.5" fill="var(--acc-silver)" {...stroke} />
        <rect x="-4.5" y="-12.5" width="9" height="24.5" fill="var(--acc-gold)" {...stroke} />
        <path d="M0 -12.5 V12" fill="none" stroke="var(--acc-orange)" strokeWidth="1.6" />
        <path d="M-4.5 12 L0 22.5 L4.5 12 Z" fill="var(--acc-wood)" {...stroke} />
        <path d="M-1.8 18.2 L0 22.5 L1.8 18.2 Z" fill={LINE} />
      </g>
    </g>
  ),
  house: (
    <g>
      <rect x="42.5" y="11" width="7.5" height="16" rx="1.8" fill="var(--acc-wood)" {...stroke} />
      <rect x="41" y="9" width="10.5" height="3.8" rx="1.5" fill="var(--acc-silver)" {...stroke} />
      <rect x="12" y="30" width="40" height="29.5" rx="2.5" fill="var(--acc-cream)" {...stroke} />
      <path d="M17.5 59.5 V42.5 Q17.5 38 22.5 38 Q27.5 38 27.5 42.5 V59.5 Z" fill="var(--acc-wood)" {...stroke} />
      <circle cx="24.5" cy="49.5" r="1.6" fill="var(--acc-gold)" />
      <rect x="33.5" y="38.5" width="13" height="12.5" rx="2.2" fill="var(--acc-sky)" {...stroke} />
      <path d="M40 38.5 V51 M33.5 44.8 H46.5" fill="none" {...fine} />
      <rect x="32" y="50.8" width="16" height="3" rx="1.4" fill="var(--acc-wood)" {...thin} />
      <path d="M5.5 32 L30.2 9.8 Q32 8.2 33.8 9.8 L58.5 32 Q59.5 33 58 34 H6 Q4.5 33 5.5 32 Z" fill="var(--acc-coral)" {...stroke} />
      <path d="M12.5 29.5 L31 13" fill="none" stroke="var(--acc-rose)" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.65" />
    </g>
  ),
  bench: (
    <g>
      <path d="M46.5 59.5 L47.2 34 H51.8 L52.5 59.5 Z" fill="var(--acc-wood)" {...stroke} />
      <path
        d="M38.5 28.5 C36.5 24 38.5 18.5 42.5 17 C43.5 11.5 47.5 9.5 51.8 10.8 C55.5 12 57.8 15.5 57.2 19.5 C60 22 60 28 56.8 31.5 C54.5 34 51 34.5 48.2 33.8 C44 35.2 39.8 33 38.5 28.5 Z"
        fill="var(--acc-leaf)"
        {...stroke}
      />
      <path d="M43.5 16.5 Q45.8 12.8 50 13.2" fill="none" stroke="var(--acc-mint)" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="8.5" y="31" width="4.4" height="28.5" rx="1.8" fill="var(--acc-navy)" {...stroke} />
      <rect x="31.1" y="31" width="4.4" height="28.5" rx="1.8" fill="var(--acc-navy)" {...stroke} />
      {BENCH_SLATS.map((y) => (
        <rect key={y} x="5" y={y} width="34" height="5" rx="2" fill="var(--acc-wood)" {...stroke} />
      ))}
      <path d="M6 46 H38 L40 50 H4 Z" fill="var(--acc-wood)" {...stroke} />
      <path d="M9 48 H35" fill="none" stroke="var(--acc-cream)" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.45" />
      <rect x="4" y="49.5" width="36" height="3.6" rx="1.5" fill="var(--acc-wood)" {...stroke} />
    </g>
  ),
  'money-bag': (
    <g>
      <circle cx="24" cy="14" r="5.5" fill="var(--acc-gold)" {...stroke} />
      <circle cx="40" cy="14" r="5.5" fill="var(--acc-gold)" {...stroke} />
      <circle cx="32" cy="11.5" r="6" fill="var(--acc-gold)" {...stroke} />
      <circle cx="32" cy="11.5" r="3.4" fill="none" stroke="var(--acc-orange)" strokeWidth="1.4" />
      <path d="M22.5 23 L17.5 15 Q24.5 18 32 16.5 Q39.5 18 46.5 15 L41.5 23 Z" fill="var(--acc-cream)" {...stroke} />
      <path
        d="M22.5 23 C14 28 9 37 9 46.5 C9 55.5 16.5 59.5 32 59.5 C47.5 59.5 55 55.5 55 46.5 C55 37 50 28 41.5 23 Z"
        fill="var(--acc-cream)"
        {...stroke}
      />
      <path d="M13 51.5 Q32 57.5 51 51.5 Q47.5 57.8 32 58.2 Q16.5 57.8 13 51.5 Z" fill="var(--acc-silver)" fillOpacity="0.4" />
      <path d="M26 27.5 Q24 31 22.5 33 M38 27.5 Q40 31 41.5 33" fill="none" stroke={LINE} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.4" />
      <path d="M42.5 24.5 L48.5 22 L47 26.5 Z M42 25.5 L49 28.5 L45 30 Z" fill="var(--acc-coral)" {...thin} />
      <rect x="20.5" y="21.5" width="23" height="5" rx="2.5" fill="var(--acc-coral)" {...stroke} />
      <circle cx="32" cy="43" r="9.2" fill="var(--acc-gold)" {...stroke} />
      <circle cx="32" cy="43" r="5.6" fill="none" stroke="var(--acc-orange)" strokeWidth="1.8" />
      <path d="M26.5 39.2 A6.8 6.8 0 0 1 30.8 36.6" fill="none" stroke="var(--acc-cream)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
    </g>
  ),
  stopwatch: draft(),
  'org-chart': draft(),
  'ship-wheel': draft(),
  flag: draft(),
  crane: draft(),
  key: draft(),
  curtain: draft(),
  ladder: draft(),
  heart: draft(),
  megaphone: draft(),
};

export function ComicProp({ id, title }: { id: ComicPropId; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className="cb-comic-prop-svg" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {PROP_ART[id]}
    </svg>
  );
}
