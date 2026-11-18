import { useEffect } from 'react';
import type { World } from '../core/world';
import { soundOn } from '../selectors/sound';
import { isSoundName, playSound, unlockSound } from './sound';

/**
 * 瀏覽器認得的「使用者手勢」事件：在這些事件裡才能建立或叫醒音訊。
 * iOS 的 Safari 不認「按下」（pointerdown、touchstart），認「放開」與點擊，所以按鍵聲雖然在按下時就排，
 * 叫醒音訊要靠這幾個事件。
 */
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

/** 會響按鍵聲的元素 */
const TAPPABLE = 'button, [role="button"], a[href], summary';

/**
 * 全 App 只在這裡決定什麼時候出聲：
 * - 按下按鈕：響最近的 data-sound 指定的聲音（none＝不響），沒指定就是 tap；
 * - 作答：答對、答錯；
 * - 拿到成就或完成今日任務：reward。
 * 音效關掉時全部不響。
 * 另外在每次使用者手勢把音訊叫醒：切到背景、鎖螢幕、來電之後聲音會被系統暫停，下一次碰畫面就恢復。
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

    const onGesture = () => {
      if (soundOn(world)) unlockSound();
    };
    for (const type of UNLOCK_EVENTS) document.addEventListener(type, onGesture, { capture: true, passive: true });

    const offAnswered = world.bus.on('answered', (event) => {
      if (soundOn(world)) playSound(event.correct ? 'correct' : 'wrong', false);
    });
    const offRewards = world.bus.on('rewardsEarned', () => {
      if (soundOn(world)) playSound('reward', false);
    });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      for (const type of UNLOCK_EVENTS) document.removeEventListener(type, onGesture, { capture: true });
      offAnswered();
      offRewards();
    };
  }, [world]);
}
