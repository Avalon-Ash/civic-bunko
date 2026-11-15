import { useEffect, useRef, useState } from 'react';

export type CatMood = 'idle' | 'yay' | 'oops' | 'sleepy';

/** 點擊角色時隨機冒出的鼓勵語句。 */
export const CAT_ENCOURAGEMENTS: readonly string[] = [
  '今天刷一題，離上榜就更近一步！',
  '慢慢看沒關係，看懂比刷快更重要。',
  '答錯只是先把地雷踩掉，考試就不會踩了！',
  '深呼吸，你記住的比你以為的多。',
  '再刷 5 題就休息一下，我陪你！',
  '看到「何者錯誤」記得先圈起來喔。',
  '法條有點長，抓住關鍵字就對了。',
  '每天一點點，累積起來超驚人！',
  '你超棒的，繼續保持這個節奏！',
  '累了就看看我，充飽電再出發！',
];

export interface CatProps {
  size?: number;
  mood?: CatMood;
  interactive?: boolean;
  spin?: boolean;
  className?: string;
}

/** 原創角色：八字臉的圓貓。支援四種表情、待機眨眼、點擊壓扁回彈與隨機鼓勵氣泡。 */
export function Cat({
  size = 64,
  mood = 'idle',
  interactive = true,
  spin = false,
  className = '',
}: CatProps) {
  const [squishing, setSquishing] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const lastIndexRef = useRef(-1);

  useEffect(() => {
    if (!bubble) return;
    const id = window.setTimeout(() => setBubble(null), 2600);
    return () => window.clearTimeout(id);
  }, [bubble]);

  useEffect(() => {
    if (!squishing) return;
    const id = window.setTimeout(() => setSquishing(false), 380);
    return () => window.clearTimeout(id);
  }, [squishing]);

  const handleTap = () => {
    if (!interactive) return;
    setSquishing(false);
    window.requestAnimationFrame(() => setSquishing(true));
    const len = CAT_ENCOURAGEMENTS.length;
    if (len > 0) {
      let idx = Math.floor(Math.random() * len);
      if (len > 1 && idx === lastIndexRef.current) {
        idx = (idx + 1) % len;
      }
      lastIndexRef.current = idx;
      const msg = CAT_ENCOURAGEMENTS[idx];
      if (msg) {
        setBubble(msg);
      }
    }
  };

  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="cb-cat-svg"
    >
      <path
        d="M11 28L14 7l15 10zM53 28L50 7 35 17z"
        fill="var(--cat-patch)"
        stroke="var(--cat-line)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="39" rx="26" ry="21" fill="var(--cat-fur)" />
      <path
        d="M6 40Q6 19 30 18l-5 12q-9 3-13 14zM58 40Q58 19 34 18l5 12q9 3 13 14z"
        fill="var(--cat-patch)"
      />
      <ellipse
        cx="32"
        cy="39"
        rx="26"
        ry="21"
        fill="none"
        stroke="var(--cat-line)"
        strokeWidth="2.5"
      />
      <ellipse cx="15" cy="46" rx="4.5" ry="3" fill="var(--cat-blush)" />
      <ellipse cx="49" cy="46" rx="4.5" ry="3" fill="var(--cat-blush)" />

      {mood === 'yay' && (
        <path
          d="M19 41q3.5-5 7 0M38 41q3.5-5 7 0"
          fill="none"
          stroke="var(--cat-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}

      {mood === 'sleepy' && (
        <>
          <path
            d="M19 40q3.5 3.5 7 0M38 40q3.5 3.5 7 0"
            fill="none"
            stroke="var(--cat-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text
            x="50"
            y="22"
            fill="var(--ink-soft)"
            fontSize="11"
            fontWeight="900"
          >
            z
          </text>
        </>
      )}

      {(mood === 'idle' || mood === 'oops') && (
        <g className={mood === 'idle' ? 'cb-cat-eyes' : undefined}>
          <circle cx="22.5" cy="40" r="2.8" fill="var(--cat-line)" />
          <circle cx="41.5" cy="40" r="2.8" fill="var(--cat-line)" />
        </g>
      )}

      {mood === 'oops' ? (
        <>
          <path
            d="M29 48h6"
            stroke="var(--cat-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M56 14q4 6 0 8q-4-2 0-8z"
            fill="var(--blue-bg)"
            stroke="var(--cat-line)"
            strokeWidth="1.8"
          />
        </>
      ) : (
        <path
          d="M27 46q2.5 3.5 5 0q2.5 3.5 5 0"
          fill="none"
          stroke="var(--cat-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );

  if (!interactive) {
    return (
      <span
        className={`cb-cat-wrap ${spin ? 'is-spinning' : ''} ${className}`.trim()}
      >
        {svg}
      </span>
    );
  }

  return (
    <span className={`cb-cat-host ${className}`.trim()}>
      {bubble && (
        <span className="cb-cat-bubble" role="status" aria-live="polite">
          {bubble}
        </span>
      )}
      <button
        type="button"
        className={`cb-cat-btn ${squishing ? 'is-squishing' : ''} ${spin ? 'is-spinning' : ''}`.trim()}
        onClick={handleTap}
        aria-label="點一點小貓看鼓勵的話"
      >
        {svg}
      </button>
    </span>
  );
}
