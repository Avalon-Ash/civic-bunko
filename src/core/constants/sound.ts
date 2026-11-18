// SSOT：音效的聲音設計（Web Audio 即時合成，沒有音檔）。音量都壓得很小：這是讀書用的 App。
import type { MeowClip, SoundName, ToneSpec } from '../types';

/** 起音與收尾的最短時間（秒）：太短會有爆音 */
export const SOUND_ATTACK = 0.006;
/** 指數漸弱的終點音量（Web Audio 的指數曲線不能到 0） */
export const SOUND_FLOOR = 0.0001;

/**
 * 音訊還沒醒（被系統暫停）時要播的聲音，最多晚這麼久還播；更晚就丟掉。
 * 回到前景後第一下才把音訊叫醒，這時不該把離開前沒播的聲音一次全放出來。
 */
export const SOUND_LATE_MS = 400;
/** 等候清單最多留幾個聲音（連點時不會越積越多） */
export const SOUND_WAITING_MAX = 4;
/**
 * 判斷音訊卡死：兩次檢查之間牆上時間過了這麼久，音訊自己的時間卻沒有前進（狀態還顯示正常）。
 * iOS 從背景回來偶爾會這樣，只能關掉重建。
 */
export const SOUND_STUCK_MS = 1_000;

/** 音階（赫茲） */
const NOTE = { E4: 329.63, B3: 246.94, G5: 783.99, A5: 880, B5: 987.77, D6: 1174.66, E6: 1318.51, G6: 1567.98 } as const;

export const TONES: Readonly<Record<Exclude<SoundName, 'meow'>, readonly ToneSpec[]>> = {
  /** 按鈕：輕輕的「啵」 */
  tap: [{ wave: 'sine', from: 520, to: 760, at: 0, dur: 0.06, gain: 0.05 }],
  /** 答對：上行兩音 */
  correct: [
    { wave: 'triangle', from: NOTE.A5, at: 0, dur: 0.11, gain: 0.07 },
    { wave: 'triangle', from: NOTE.E6, at: 0.09, dur: 0.18, gain: 0.07 },
  ],
  /** 答錯：往下滑的低音，不刺耳 */
  wrong: [{ wave: 'triangle', from: NOTE.E4, to: NOTE.B3, at: 0, dur: 0.22, gain: 0.07 }],
  /** 拿到獎勵：四音琶音 */
  reward: [
    { wave: 'triangle', from: NOTE.G5, at: 0, dur: 0.14, gain: 0.06 },
    { wave: 'triangle', from: NOTE.B5, at: 0.07, dur: 0.14, gain: 0.06 },
    { wave: 'triangle', from: NOTE.D6, at: 0.14, dur: 0.14, gain: 0.06 },
    { wave: 'triangle', from: NOTE.G6, at: 0.21, dur: 0.22, gain: 0.06 },
  ],
};

/** 貓叫錄音的目標音量（RMS）：比按鍵聲（約 0.02）稍大 */
const MEOW_TARGET_RMS = 0.028;
/** 錄音裁切：聲音開始前留一點、結尾淡出的長度（秒） */
export const MEOW_PREROLL = 0.02;
export const MEOW_FADE = 0.06;

/**
 * 點小貓時輪流播的貓叫錄音。來源：Mixkit（Sound Effects Free License：可商用、不用標示，不得單獨再散布音檔）。
 * onset／end／rms 是主代理 2026-11-18 在瀏覽器解碼量的（聲音超過峰值 5% 的範圍與其 RMS）。
 */
const MEOW_MEASURED = [
  { file: 'meow-93.mp3', title: 'Sweet kitty meow', onset: 0.103, end: 0.772, rms: 0.099 },
  { file: 'meow-91.mp3', title: 'Cartoon little cat meow', onset: 0.054, end: 1.132, rms: 0.0951 },
  { file: 'meow-86.mp3', title: 'Little cat attention meow', onset: 0.086, end: 0.609, rms: 0.1088 },
] as const;

export const MEOW_CLIPS: readonly MeowClip[] = MEOW_MEASURED.map((m) => ({
  file: m.file,
  offset: Math.max(0, m.onset - MEOW_PREROLL),
  duration: m.end - m.onset + MEOW_PREROLL + MEOW_FADE,
  gain: MEOW_TARGET_RMS / m.rms,
}));
