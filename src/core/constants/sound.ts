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

/**
 * 喵：依 Schötz、Eklund、van de Weijer（2017）對貓叫的描述——成貓的喵是 [miau]，小貓的咪是高音的 [mɪu]；
 * 音高呈拱形，最高點在嘴巴張最大時。共振峰取人類母音的位置再往上移（貓的聲道比較短）。
 */
export const MEOW: MeowSpec = {
  pitch: { start: 620, peak: 900, end: 520, peakAt: 0.4 },
  dur: { min: 0.5, max: 0.75 },
  jitter: 0.1,
  vibrato: { hz: 6.5, depth: 10 },
  /** 量過：喵的平均 RMS 約 0.028，比按鍵聲（約 0.02）稍大 */
  gain: 0.13,
  tilt: 3200,
  breath: 0.12,
  formantQ: [6, 9, 11],
  formantGain: [1, 0.55, 0.25],
  meow: [
    { at: 0, formants: [380, 1700, 2900], amp: 0.2 },
    { at: 0.16, formants: [520, 2600, 3600], amp: 0.75 },
    { at: 0.42, formants: [1050, 1750, 3300], amp: 1 },
    { at: 0.82, formants: [560, 1050, 2900], amp: 0.45 },
  ],
  mew: [
    { at: 0, formants: [400, 1900, 3000], amp: 0.25 },
    { at: 0.25, formants: [560, 2800, 3800], amp: 1 },
    { at: 0.8, formants: [600, 1300, 3100], amp: 0.5 },
  ],
  mewChance: 0.35,
  mewPitch: 1.25,
  mewDur: 0.7,
  /** 量過：不補時咪的 RMS 只有喵的 0.34 倍 */
  mewGain: 2.9,
};
