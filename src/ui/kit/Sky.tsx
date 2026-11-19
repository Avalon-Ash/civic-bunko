import type { Weather } from '../../core/types';

/** 雲：一朵的輪廓（寬約 60、高約 26） */
const CLOUD = 'M10 26 Q0 26 1 17 Q2 9 11 10 Q14 1 25 3 Q33 -2 40 6 Q51 4 53 13 Q61 14 59 21 Q58 26 50 26 Z';
/** 每朵雲的位置（畫面寬的百分比、離上緣 px）、大小倍數、飄一趟幾秒 */
const CLOUDS = [
  { left: 8, top: 18, scale: 1.25, sec: 46 },
  { left: 52, top: 52, scale: 0.9, sec: 64 },
  { left: 74, top: 6, scale: 1.05, sec: 55 },
] as const;
/** 星星的位置（百分比、px）與大小 */
const STARS = [
  [12, 30, 3],
  [30, 70, 2],
  [46, 22, 2.4],
  [63, 58, 2],
  [86, 96, 2.6],
] as const;

/**
 * 天氣天空：畫在頁面最上面那一段的背景（內容後面），照天氣畫太陽或月亮、雲、雨。純裝飾，不擋任何東西。
 * 小貓的背景配件（月亮、彩虹…）是牠自己的佈景，不跟著天氣變。
 */
export function Sky({ weather }: { weather: Weather | null }) {
  if (!weather) return null;
  const { kind, day } = weather;
  return (
    <div className={`cb-sky cb-sky-${kind} ${day ? 'is-day' : 'is-night'}`} aria-hidden="true">
      {kind === 'clear' && day ? (
        <svg className="cb-sky-sun" viewBox="-60 -60 120 120" width="150" height="150">
          <g className="cb-sky-rays" stroke="var(--acc-gold)" strokeWidth="5" strokeLinecap="round">
            {Array.from({ length: 10 }, (_, i) => (
              <path key={i} d="M0 -38 V-52" transform={`rotate(${i * 36})`} />
            ))}
          </g>
          <circle r="28" fill="var(--acc-gold)" />
        </svg>
      ) : null}
      {kind === 'clear' && !day ? (
        <>
          <svg className="cb-sky-moon" viewBox="0 0 60 60" width="84" height="84">
            <path d="M38 6 A25 25 0 1 0 54 40 A20 20 0 0 1 38 6 Z" fill="var(--acc-straw)" />
          </svg>
          {STARS.map(([left, top, r], i) => (
            <span
              key={left}
              className="cb-sky-star"
              style={{ left: `${left}%`, top, width: r * 2, height: r * 2, animationDelay: `${i * -0.7}s` }}
            />
          ))}
        </>
      ) : null}
      {kind !== 'clear'
        ? CLOUDS.map((cloud) => (
            <svg
              key={cloud.left}
              className="cb-sky-cloud"
              viewBox="0 0 60 28"
              width={60 * cloud.scale * 1.6}
              height={28 * cloud.scale * 1.6}
              style={{ left: `${cloud.left}%`, top: cloud.top, animationDuration: `${cloud.sec}s` }}
            >
              <path d={CLOUD} />
            </svg>
          ))
        : null}
      {kind === 'rain' ? <div className="cb-sky-drops" /> : null}
    </div>
  );
}
