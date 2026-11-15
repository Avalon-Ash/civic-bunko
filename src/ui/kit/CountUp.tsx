import { useEffect, useState } from 'react';

export interface CountUpProps {
  value: number;
  durationMs?: number;
  className?: string;
}

/** 數字從 0 平滑跳動到目標值；尊重系統減少動態效果設定。 */
export function CountUp({ value, durationMs = 520, className = '' }: CountUpProps) {
  const [display, setDisplay] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return value;
    }
    return 0;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDisplay(value);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || value === 0) {
      setDisplay(value);
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return <span className={`cb-num-tabular ${className}`.trim()}>{display}</span>;
}
