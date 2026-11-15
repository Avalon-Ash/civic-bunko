import { useEffect, useRef, useState } from 'react';

export interface ProgressBarProps {
  value: number;
  total: number;
  ariaLabel?: string;
  showCat?: boolean;
  className?: string;
}

/** 進度條；可附帶一隻隨進度前進並在前進時彈跳的小貓頭。 */
export function ProgressBar({
  value,
  total,
  ariaLabel,
  showCat = false,
  className = '',
}: ProgressBarProps) {
  const safeTotal = Math.max(1, total);
  const ratio = Math.min(1, Math.max(0, value / safeTotal));
  const pct = Math.round(ratio * 1000) / 10;

  const prevValueRef = useRef(value);
  const [hopTick, setHopTick] = useState(0);

  useEffect(() => {
    if (value > prevValueRef.current) {
      setHopTick((t) => t + 1);
    }
    prevValueRef.current = value;
  }, [value]);

  return (
    <div
      className={`cb-prog-wrap ${showCat ? 'has-cat' : ''} ${className}`.trim()}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={Math.min(safeTotal, Math.max(0, value))}
    >
      <div className="cb-bar">
        <div
          className="cb-bar-fill"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      {showCat && (
        <div className="cb-bar-rail" aria-hidden="true">
          <div className="cb-bar-slider" style={{ transform: `translateX(${pct}%)` }}>
            <div key={hopTick} className={`cb-bar-cat ${hopTick > 0 ? 'is-hopping' : ''}`}>
              <svg viewBox="0 0 36 36" width="28" height="28">
                <path
                  d="M6 16L8 4l9 6zM30 16L28 4l-9 6z"
                  fill="var(--cat-patch)"
                  stroke="var(--cat-line)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <ellipse
                  cx="18"
                  cy="22"
                  rx="14"
                  ry="11"
                  fill="var(--cat-fur)"
                  stroke="var(--cat-line)"
                  strokeWidth="2.2"
                />
                <circle cx="13" cy="22" r="1.6" fill="var(--cat-line)" />
                <circle cx="23" cy="22" r="1.6" fill="var(--cat-line)" />
                <ellipse cx="9" cy="25" rx="2.4" ry="1.6" fill="var(--cat-blush)" />
                <ellipse cx="27" cy="25" rx="2.4" ry="1.6" fill="var(--cat-blush)" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
