// 音效播放器的「叫醒與恢復」：什麼時候建立音訊環境、被系統靜默後怎麼叫回來、叫不回來時怎麼換一個新的。
// 這裡不碰 Web Audio 的建立細節與聲音內容（在 sound.ts），所以可以用假的音訊環境測試。
//
// 會讓聲音「回不來」的三種狀況，這裡各有對策：
// 1. 被系統暫停：切到背景、鎖螢幕、來電之後，狀態會變成 suspended，iOS 還有規格外的 interrupted。
//    → 只要不是 running 就呼叫 resume()；而且要在瀏覽器認的使用者手勢裡（iOS 認「放開」不認「按下」），
//      所以另外提供 unlock() 給 pointerup／touchend／click／keydown 呼叫。
// 2. 看起來正常其實卡死：iOS 有時回到前景後狀態是 running，但時間不再前進，排進去的聲音永遠不響。
//    → 兩次檢查之間牆上時間過了很久、音訊時間卻沒動，就關掉舊的、在手勢裡建一個新的。
// 3. 還沒醒就排聲音：暫停中的音訊時間是凍結的，這時排的聲音會全部擠在同一刻，醒來時一次爆出來。
//    → 沒醒之前先記在等候清單，醒了只播還夠新的，太舊的丟掉。
import { SOUND_LATE_MS, SOUND_STUCK_MS, SOUND_WAITING_MAX } from '../core/constants/sound';
import type { SoundName } from '../core/types';

/** 播放器用得到的音訊環境（AudioContext 的一小部分，測試用假的也只要做這些） */
export interface SoundContext {
  /** running、suspended、closed，iOS 還有 interrupted */
  readonly state: string;
  readonly currentTime: number;
  resume(): Promise<void>;
  close(): Promise<void>;
  onstatechange: ((this: never, ev: never) => unknown) | null;
}

export interface SoundPlayerDeps<C extends SoundContext> {
  /** 建立音訊環境；瀏覽器不支援時回 null。只會在使用者手勢裡被呼叫 */
  createContext: () => C | null;
  /** 在音訊時間 t 排一個音效 */
  schedule: (ac: C, name: SoundName, t: number) => void;
  /** 牆上時間（毫秒） */
  now: () => number;
}

export interface SoundPlayer {
  /**
   * 播一個音效。fromGesture＝這次是使用者手勢觸發（可以建立、重建音訊環境）；
   * 不是手勢時，音訊還沒建立就安靜略過。
   */
  play(name: SoundName, fromGesture: boolean): void;
  /** 在使用者手勢裡把音訊叫醒（不出聲）。每次手勢都可以叫，已經醒著就什麼都不做 */
  unlock(): void;
}

/** 上一次確認「正在跑」時的音訊時間與牆上時間 */
interface Seen {
  time: number;
  at: number;
}

export type SoundHealth = 'ok' | 'resume' | 'recreate';

/**
 * 音訊環境現在的狀況：ok＝可以直接排聲音；resume＝被暫停了，要叫醒；recreate＝關掉了或卡死了，要換新的。
 * 卡死＝狀態是 running，但從上次確認到現在牆上時間過了 SOUND_STUCK_MS 以上，音訊時間卻一點都沒前進。
 */
export function soundHealth(state: string, currentTime: number, seen: Seen | null, nowMs: number): SoundHealth {
  if (state === 'closed') return 'recreate';
  if (state !== 'running') return 'resume';
  if (seen !== null && nowMs - seen.at >= SOUND_STUCK_MS && currentTime <= seen.time) return 'recreate';
  return 'ok';
}

export function createSoundPlayer<C extends SoundContext>(deps: SoundPlayerDeps<C>): SoundPlayer {
  let ctx: C | null = null;
  let seen: Seen | null = null;
  /** 音訊還沒醒時要播的聲音，和它們是什麼時候要播的 */
  let waiting: Array<{ name: SoundName; at: number }> = [];

  /** 音訊醒了：等候清單裡還夠新的播出來，太舊的丟掉 */
  const flush = (ac: C): void => {
    if (ac !== ctx || ac.state !== 'running') return;
    seen = { time: ac.currentTime, at: deps.now() };
    const fresh = waiting.filter((item) => deps.now() - item.at <= SOUND_LATE_MS);
    waiting = [];
    for (const item of fresh) deps.schedule(ac, item.name, ac.currentTime);
  };

  const create = (): C | null => {
    const ac = deps.createContext();
    if (!ac) return null;
    ac.onstatechange = () => flush(ac);
    seen = null;
    return ac;
  };

  /** 確認音訊環境可用，需要時叫醒或換新；回傳目前的環境（可能還沒醒） */
  const ensure = (fromGesture: boolean): C | null => {
    if (!ctx) {
      if (!fromGesture) return null;
      ctx = create();
      if (!ctx) return null;
    }
    let health = soundHealth(ctx.state, ctx.currentTime, seen, deps.now());
    if (health === 'recreate') {
      // 新的音訊環境要在手勢裡建才會出聲；不是手勢就先不動，等下一次手勢
      if (!fromGesture) return null;
      const old = ctx;
      old.onstatechange = null;
      void old.close().catch(() => undefined);
      ctx = create();
      if (!ctx) return null;
      health = soundHealth(ctx.state, ctx.currentTime, seen, deps.now());
    }
    const ac = ctx;
    if (health === 'resume') {
      void ac.resume().then(
        () => flush(ac),
        () => undefined,
      );
    } else if (health === 'ok') {
      seen = { time: ac.currentTime, at: deps.now() };
    }
    return ac;
  };

  return {
    play(name, fromGesture) {
      const ac = ensure(fromGesture);
      if (!ac) return;
      if (ac.state === 'running') {
        deps.schedule(ac, name, ac.currentTime);
        return;
      }
      waiting.push({ name, at: deps.now() });
      if (waiting.length > SOUND_WAITING_MAX) waiting = waiting.slice(-SOUND_WAITING_MAX);
    },
    unlock() {
      ensure(true);
    },
  };
}
