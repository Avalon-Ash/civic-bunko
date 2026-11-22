// 小鴨（鴨子裝的跟班，docs/plans/back-specials.md §1）：側面、圓滾滾的黃色小鴨，畫法照頭上小雞（chick）。
// 亂跑的小貓（PetLayer）與小屋（HouseScene）共用；位置由呼叫的一方決定，這裡只畫圖。
// 動畫在 pet.css：走路一跳一跳（is-walking）、低頭啄（is-pecking）、呱的時候嘴巴張開（is-quacking）。

/** 圖的座標（寬 × 高）；腳底在下緣 */
export const DUCKLING_VIEW = { w: 28, h: 26 } as const;

export function Duckling({
  size,
  facing,
  walking = false,
  pecking = false,
  quacking = false,
}: {
  size: number;
  facing: 'left' | 'right';
  walking?: boolean;
  pecking?: boolean;
  quacking?: boolean;
}) {
  const cls = ['cb-duckling', walking ? 'is-walking' : '', pecking ? 'is-pecking' : '', quacking ? 'is-quacking' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <svg
      className={cls}
      width={size}
      height={(size * DUCKLING_VIEW.h) / DUCKLING_VIEW.w}
      viewBox={`0 0 ${DUCKLING_VIEW.w} ${DUCKLING_VIEW.h}`}
      overflow="visible"
      aria-hidden="true"
    >
      <g transform={facing === 'left' ? `translate(${DUCKLING_VIEW.w} 0) scale(-1 1)` : undefined}>
        <g className="cb-duckling-hop">
          {/* 腳 */}
          <path d="M10 22.4 V25 H13 M15 22.4 V25 H18" fill="none" stroke="var(--acc-orange)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          {/* 身體與小尾巴 */}
          <path
            d="M4.4 15.4 Q2 12 3.4 10.6 Q5.4 12.2 7 12.6 Q11 10.4 16 11.6 Q20.6 13 20.4 17.4 Q19.6 23 12.4 23 Q5.6 23 4.4 15.4 Z"
            fill="var(--acc-gold)"
            stroke="var(--cat-line)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* 小翅膀 */}
          <path d="M8.6 15.6 Q12 14.4 14.6 16.6 Q12.6 19.6 9.4 18.4 Z" fill="var(--acc-straw)" stroke="var(--cat-line)" strokeWidth="1.1" strokeLinejoin="round" />
          <g className="cb-duckling-head">
            {/* 頭、頭頂的一撮毛 */}
            <circle cx="18.6" cy="8.8" r="5.6" fill="var(--acc-gold)" stroke="var(--cat-line)" strokeWidth="1.5" />
            <path d="M17.4 3.4 Q17 1 19 0.8 Q18.2 2.2 19.4 3.2" fill="none" stroke="var(--cat-line)" strokeWidth="1.1" strokeLinecap="round" />
            <circle cx="20.2" cy="7.8" r="1" fill="var(--cat-line)" />
            {/* 嘴：上下兩片，呱的時候下面那片張開 */}
            <path d="M23.4 8.8 Q27.6 8.4 27.4 9.8 L23.6 10.4 Z" fill="var(--acc-orange)" stroke="var(--cat-line)" strokeWidth="0.9" strokeLinejoin="round" />
            <path className="cb-duckling-jaw" d="M23.6 10.4 L27 10.4 Q26.4 11.8 23.4 11.4 Z" fill="var(--acc-orange)" stroke="var(--cat-line)" strokeWidth="0.9" strokeLinejoin="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}
