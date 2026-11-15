import { useEffect, type CSSProperties } from 'react';

interface ParticleSpec {
  dx: number;
  dy: number;
  rot: number;
  kind: 'paw' | 'star';
  tone: 'pink' | 'butter' | 'green' | 'blue';
  delayMs: number;
}

const PARTICLES: readonly ParticleSpec[] = [
  { dx: -68, dy: -46, rot: -28, kind: 'paw', tone: 'pink', delayMs: 0 },
  { dx: -38, dy: -66, rot: 22, kind: 'star', tone: 'butter', delayMs: 20 },
  { dx: 0, dy: -74, rot: -12, kind: 'paw', tone: 'green', delayMs: 10 },
  { dx: 40, dy: -64, rot: 34, kind: 'star', tone: 'blue', delayMs: 25 },
  { dx: 70, dy: -44, rot: 45, kind: 'paw', tone: 'pink', delayMs: 5 },
  { dx: -76, dy: -10, rot: -48, kind: 'star', tone: 'blue', delayMs: 30 },
  { dx: 76, dy: -8, rot: 40, kind: 'star', tone: 'butter', delayMs: 15 },
  { dx: -52, dy: 24, rot: -20, kind: 'star', tone: 'green', delayMs: 20 },
  { dx: 52, dy: 24, rot: 26, kind: 'paw', tone: 'butter', delayMs: 10 },
  { dx: 0, dy: -44, rot: 14, kind: 'star', tone: 'pink', delayMs: 35 },
];

export interface BurstProps {
  onDone: () => void;
}

/** 答對時從選項位置噴出 10 個小貓掌與星星，動畫結束後自動移除。 */
export function Burst({ onDone }: BurstProps) {
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeout = window.setTimeout(onDone, reduced ? 0 : 720);
    return () => window.clearTimeout(timeout);
  }, [onDone]);

  return (
    <div className="cb-burst" aria-hidden="true">
      {PARTICLES.map((p, idx) => {
        const style = {
          '--dx': `${p.dx}px`,
          '--dy': `${p.dy}px`,
          '--rot': `${p.rot}deg`,
          '--delay': `${p.delayMs}ms`,
        } as CSSProperties;

        return (
          <span key={idx} className={`cb-burst-p cb-burst-${p.tone}`} style={style}>
            {p.kind === 'paw' ? (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <ellipse cx="12" cy="16" rx="6" ry="4.6" />
                <circle cx="5.5" cy="10" r="2.4" />
                <circle cx="12" cy="7" r="2.6" />
                <circle cx="18.5" cy="10" r="2.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 2.5l2.7 6.2 6.8.6-5.1 4.4 1.6 6.6L12 16.7 6 20.3l1.6-6.6L2.5 9.3l6.8-.6z" />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}
