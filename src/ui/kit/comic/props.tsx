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
        d="M14 10 L18.5 6 L23 10 L27.5 6 L32 10 L36.5 6 L41 10 L45.5 6 L50 10 V56 Q50 59 47 59 H17 Q14 59 14 56 Z"
        fill="var(--acc-rose)"
        {...stroke}
      />
      <path d="M17 15 H47" fill="none" stroke={LINE} strokeWidth="1.3" strokeDasharray="2.5 3" strokeLinecap="round" strokeOpacity="0.45" />
      <path d="M29 21 Q29 19 32 19 Q35 19 35 21 L34.2 35 Q34 37 32 37 Q30 37 29.8 35 Z" fill="var(--acc-coral)" {...thin} />
      <circle cx="32" cy="43.5" r="3.4" fill="var(--acc-coral)" {...thin} />
      <path d="M20 51.5 H44 M24 55 H40" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
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
      <rect x="4" y="42" width="56" height="18" rx="4" fill="var(--acc-silver)" {...stroke} />
      <path d="M8 50 H12.5" fill="none" stroke="var(--acc-cream)" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 51 Q17 45.5 25 46 Q34 45.5 37 50 Q38 55 28 56 Q17 56.5 15 51 Z" fill="var(--acc-shade)" {...thin} />
      <path d="M17 48 L12 45 L9 46 M26 46 L28 43 M36 51 L41 53 M21 56 L18 59" fill="none" {...fine} />
      <rect x="38" y="45" width="20" height="5.5" rx="2.2" fill="var(--acc-orange)" {...stroke} />
      <path d="M41.5 45 L46 21 Q48 18.5 50 21 L54.5 45 Z" fill="var(--acc-orange)" {...stroke} />
      <path d="M43.4 36 H52.6 L51.4 30 H44.6 Z" fill="var(--acc-cream)" {...fine} />
    </g>
  ),
  lamp: (
    <g>
      <path d="M19 17 Q19 7 32 7 H38 Q42 7 42 12 V16" fill="none" stroke={LINE} strokeWidth="6.2" strokeLinecap="round" />
      <path d="M19 17 Q19 7 32 7 H38 Q42 7 42 12 V16" fill="none" stroke="var(--acc-silver)" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="16.5" y="16" width="5" height="37" rx="2" fill="var(--acc-silver)" {...stroke} />
      <path d="M10 60 H28 L25 53 H13 Z" fill="var(--acc-navy)" {...stroke} />
      <g transform="translate(41 18) rotate(24)">
        <path d="M-9 2 H9 L7 10 L3 7 L0 13 L-7 13 Z" fill="var(--acc-cream)" {...stroke} />
        <circle cx="-1" cy="5.5" r="2.8" fill="var(--acc-gold)" {...fine} />
        <path d="M-4 3 L-2.5 7 L-4.5 10" fill="none" {...fine} />
        <path d="M-11 2 Q-10 -6 0 -6 Q10 -6 11 2 Z" fill="var(--acc-navy)" {...stroke} />
      </g>
      <path d="M55.5 14 L51 21 H54.5 L52 28 L59.5 20 H56 Z" fill="var(--acc-gold)" {...fine} />
      <path d="M45.5 34 L41.5 41 H45 L43 47 L49.5 39.5 H46 Z" fill="var(--acc-gold)" {...fine} />
      <path d="M29.5 33 L26 39 H29 L27.5 44 L33 37.5 H30 Z" fill="var(--acc-gold)" {...fine} />
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
