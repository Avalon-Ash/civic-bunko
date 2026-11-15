import { useEffect, useRef, useState } from 'react';
import type { AccessoryId } from '../../core/types';

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
  accessory?: AccessoryId | null;
  className?: string;
}

const ACCESSORY_VIEWBOX: Record<AccessoryId, string> = {
  bow: '35 12 24 20',
  'straw-hat': '8 1 48 26',
  scarf: '14 48 36 18',
  flower: '5 12 20 20',
  glasses: '8 28 48 24',
  crown: '15 1 34 22',
};

function CatAccessoryLayer({ accessory }: { accessory: AccessoryId }) {
  switch (accessory) {
    case 'bow':
      return (
        <g transform="translate(47 22) rotate(18)">
          <path
            d="M-1 0 L-8 -4.5 L-8 4.5 Z"
            fill="var(--pink-deep)"
            stroke="var(--cat-line)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M1 0 L8 -4.5 L8 4.5 Z"
            fill="var(--pink-deep)"
            stroke="var(--cat-line)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle
            cx="0"
            cy="0"
            r="2.6"
            fill="var(--butter)"
            stroke="var(--cat-line)"
            strokeWidth="2"
          />
        </g>
      );
    case 'straw-hat':
      return (
        <g>
          <ellipse
            cx="32"
            cy="18"
            rx="22"
            ry="4.5"
            fill="var(--butter)"
            stroke="var(--cat-line)"
            strokeWidth="2.4"
          />
          <path
            d="M21 17 L23 7 Q32 4 41 7 L43 17 Z"
            fill="var(--butter)"
            stroke="var(--cat-line)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M21.8 14.8 Q32 16.8 42.2 14.8"
            fill="none"
            stroke="var(--pink-deep)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );
    case 'scarf':
      return (
        <g>
          <path
            d="M36 57.5 L42 57.5 L43 62.5 L35.5 62.5 Z"
            fill="var(--mint)"
            stroke="var(--cat-line)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M18 54 Q32 59.5 46 54 L44.5 59.5 Q32 62.5 19.5 59.5 Z"
            fill="var(--mint)"
            stroke="var(--cat-line)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </g>
      );
    case 'flower':
      return (
        <g transform="translate(15 22)">
          <circle cx="0" cy="-4.5" r="3.2" fill="var(--pink-deep)" stroke="var(--cat-line)" strokeWidth="2" />
          <circle cx="4.3" cy="-1.4" r="3.2" fill="var(--pink-deep)" stroke="var(--cat-line)" strokeWidth="2" />
          <circle cx="2.6" cy="3.6" r="3.2" fill="var(--pink-deep)" stroke="var(--cat-line)" strokeWidth="2" />
          <circle cx="-2.6" cy="3.6" r="3.2" fill="var(--pink-deep)" stroke="var(--cat-line)" strokeWidth="2" />
          <circle cx="-4.3" cy="-1.4" r="3.2" fill="var(--pink-deep)" stroke="var(--cat-line)" strokeWidth="2" />
          <circle cx="0" cy="0" r="2.8" fill="var(--butter)" stroke="var(--cat-line)" strokeWidth="1.8" />
        </g>
      );
    case 'glasses':
      return (
        <g>
          <circle
            cx="22.5"
            cy="40"
            r="6.8"
            fill="var(--blue)"
            fillOpacity="0.18"
            stroke="var(--cat-line)"
            strokeWidth="2.3"
          />
          <circle
            cx="41.5"
            cy="40"
            r="6.8"
            fill="var(--blue)"
            fillOpacity="0.18"
            stroke="var(--cat-line)"
            strokeWidth="2.3"
          />
          <path
            d="M29.3 40 Q32 38 34.7 40"
            fill="none"
            stroke="var(--cat-line)"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M15.7 39.5 L10 38 M48.3 39.5 L54 38"
            fill="none"
            stroke="var(--cat-line)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path
            d="M21 19 L19 7 L27 13 L32 4 L37 13 L45 7 L43 19 Z"
            fill="var(--butter)"
            stroke="var(--cat-line)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="14" r="2" fill="var(--pink-deep)" />
        </g>
      );
  }
}

/** 單獨顯示指定小貓配件的 SVG 圖示，共用 Cat 的幾何造型。 */
export function AccessoryIcon({ id, size = 36 }: { id: AccessoryId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={ACCESSORY_VIEWBOX[id]}
      aria-hidden="true"
      className="cb-acc-svg"
    >
      <CatAccessoryLayer accessory={id} />
    </svg>
  );
}

/** 原創角色：八字臉的圓貓。支援四種表情、待機眨眼、點擊壓扁回彈、配件疊加與隨機鼓勵氣泡。 */
export function Cat({
  size = 64,
  mood = 'idle',
  interactive = true,
  spin = false,
  accessory = null,
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
      {accessory && <CatAccessoryLayer accessory={accessory} />}
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
