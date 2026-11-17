import { useEffect } from 'react';
import type { World } from '../core/world';
import { soundOn } from '../selectors/sound';
import { isSoundName, playSound } from './sound';

/** 會響按鍵聲的元素 */
const TAPPABLE = 'button, [role="button"], a[href], summary';

/**
 * 全 App 只在這裡決定什麼時候出聲：
 * - 按下按鈕：響最近的 data-sound 指定的聲音（none＝不響），沒指定就是 tap；
 * - 作答：答對、答錯；
 * - 拿到成就或完成今日任務：reward。
 * 音效關掉時全部不響。
 */
export function useSoundEffects(world: World): void {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!soundOn(world)) return;
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest(TAPPABLE);
      if (!el) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      if (el.getAttribute('aria-disabled') === 'true') return;
      const name = e.target.closest('[data-sound]')?.getAttribute('data-sound') ?? 'tap';
      if (isSoundName(name)) playSound(name, true);
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: true });

    const offAnswered = world.bus.on('answered', (event) => {
      if (soundOn(world)) playSound(event.correct ? 'correct' : 'wrong', false);
    });
    const offRewards = world.bus.on('rewardsEarned', () => {
      if (soundOn(world)) playSound('reward', false);
    });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      offAnswered();
      offRewards();
    };
  }, [world]);
}
