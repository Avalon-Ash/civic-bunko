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
};

export function ComicProp({ id, title }: { id: ComicPropId; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className="cb-comic-prop-svg" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {PROP_ART[id]}
    </svg>
  );
}
