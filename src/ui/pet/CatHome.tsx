import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { HOUSE_OUTING } from '../../core/constants/house';
import type { World } from '../../core/world';
import { outingCats } from '../../selectors/house';
import { useWorld } from '../useWorld';
import { getPet, recallPet, releasePet, subscribePet } from './petStore';

/** 減少動態設定開著時，小貓不出來亂跑 */
function subscribeMotion(fn: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}
function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCanRoam(): boolean {
  return !useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
}

export interface CatHomeProps {
  world: World;
  /** 頭像的大小（px）：小貓出門時，空的家維持一樣大，版面不跳 */
  size: number;
  /** 在家時顯示的頭像（Cat） */
  children: ReactNode;
}

/**
 * 小貓的家：頭像加一個「放出來玩」的肉球按鈕。小貓出門時變成空的坐墊，點它＝叫牠回來。
 * PetLayer 用 data-cat-home 找家在哪（跳出來、跳回去、拎回家都看這個位置）。
 */
export function CatHome({ world, size, children }: CatHomeProps) {
  useWorld(world);
  const cats = outingCats(world);
  const anyOut = useSyncExternalStore(
    subscribePet,
    () => cats.some((id) => getPet(id).out),
    () => false,
  );
  const canRoam = useCanRoam();
  const ref = useRef<HTMLSpanElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const handleRelease = () => {
    if (cats.length === 0) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const from = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    clearTimers();
    cats.forEach((id, index) => {
      if (index === 0) {
        releasePet(id, from);
      } else {
        const timer = window.setTimeout(() => {
          const cur = ref.current?.getBoundingClientRect();
          releasePet(
            id,
            cur ? { left: cur.left, top: cur.top, width: cur.width, height: cur.height } : from,
          );
        }, index * HOUSE_OUTING.staggerMs);
        timersRef.current.push(timer);
      }
    });
  };

  const handleRecall = () => {
    clearTimers();
    for (const id of cats) {
      if (getPet(id).out) recallPet(id);
    }
  };

  const empty = cats.length === 0;

  return (
    <span
      ref={ref}
      className={`cb-cat-home ${anyOut ? 'is-empty' : ''}`.trim()}
      style={{ width: size, height: size }}
      data-cat-home=""
    >
      {anyOut ? (
        <button type="button" className="cb-cat-home-empty" onClick={handleRecall} aria-label="叫小貓回家">
          <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
            <ellipse cx="32" cy="46" rx="25" ry="10" fill="var(--pink)" stroke="var(--line)" strokeWidth="2.5" />
            <path d="M14 46 Q32 54 50 46" fill="none" stroke="var(--pink-deep)" strokeWidth="1.6" strokeLinecap="round" />
            <g fill="var(--ink-soft)">
              <ellipse cx="32" cy="24" rx="5" ry="4" />
              <circle cx="25.5" cy="18" r="2.3" />
              <circle cx="32" cy="15" r="2.4" />
              <circle cx="38.5" cy="18" r="2.3" />
            </g>
          </svg>
          <span className="cb-cat-home-tip">叫回來</span>
        </button>
      ) : (
        children
      )}
      {!anyOut && canRoam ? (
        <button
          type="button"
          className="cb-cat-home-paw"
          onClick={handleRelease}
          aria-disabled={empty || undefined}
          aria-label={empty ? '先在小貓之家選要帶出門的小貓' : '放小貓出來玩'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <ellipse cx="12" cy="15.5" rx="5" ry="4" />
            <circle cx="6.5" cy="10" r="2.1" />
            <circle cx="12" cy="7.5" r="2.2" />
            <circle cx="17.5" cy="10" r="2.1" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
