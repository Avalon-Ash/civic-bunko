// SSOT：音效的聲音設計（Web Audio 即時合成，沒有音檔）。音量都壓得很小：這是讀書用的 App。
import type { MeowSpec, SoundName, ToneSpec } from '../types';

/** 起音與收尾的最短時間（秒）：太短會有爆音 */
export const SOUND_ATTACK = 0.006;
/** 指數漸弱的終點音量（Web Audio 的指數曲線不能到 0） */
export const SOUND_FLOOR = 0.0001;

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

/** 喵：「m-i-a-u」嘴型由閉到開再收 */
export const MEOW: MeowSpec = {
  start: 560,
  peak: 860,
  end: 500,
  rise: 0.13,
  dur: 0.52,
  gain: 0.11,
  formants: [
    { freq: 700, open: 1150, q: 5 },
    { freq: 1900, open: 2700, q: 7 },
  ],
  vibratoHz: 7,
  vibratoDepth: 14,
  jitter: 0.12,
  attack: 0.05,
};
