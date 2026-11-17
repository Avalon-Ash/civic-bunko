// 音效播放器（Web Audio 即時合成）。聲音設計在 core/constants/sound.ts；這裡只負責把它播出來。
import { MEOW, SOUND_ATTACK, SOUND_FLOOR, TONES } from '../core/constants/sound';
import type { SoundName, ToneSpec } from '../core/types';

type AudioCtor = typeof AudioContext;
interface WindowWithWebkitAudio {
  webkitAudioContext?: AudioCtor;
}
interface NavigatorWithAudioSession {
  /** iOS 17+／Safari：ambient＝跟著靜音鍵，不打斷她在聽的音樂 */
  audioSession?: { type: string };
}

const SOUND_NAMES: ReadonlySet<string> = new Set<SoundName>(['tap', 'correct', 'wrong', 'reward', 'meow']);

export function isSoundName(value: string): value is SoundName {
  return SOUND_NAMES.has(value);
}

let ctx: AudioContext | null = null;

/** 只能在使用者手勢裡第一次建立（瀏覽器規定）；之後重用同一個。 */
function audio(create: boolean): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx && create) {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as Window & WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctor) return null;
    const nav = navigator as Navigator & NavigatorWithAudioSession;
    if (nav.audioSession) nav.audioSession.type = 'ambient';
    ctx = new Ctor();
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function envelope(ac: BaseAudioContext, t: number, dur: number, gain: number, attack: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(SOUND_FLOOR, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(SOUND_FLOOR, t + dur);
  return g;
}

function playTone(ac: BaseAudioContext, spec: ToneSpec, t0: number): void {
  const t = t0 + spec.at;
  const osc = ac.createOscillator();
  osc.type = spec.wave;
  osc.frequency.setValueAtTime(spec.from, t);
  if (spec.to !== undefined) osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.dur);
  const g = envelope(ac, t, spec.dur, spec.gain, SOUND_ATTACK);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + spec.dur + SOUND_ATTACK);
}

/** 一秒的白噪音（氣音用），建一次重用 */
let noiseBuffer: AudioBuffer | null = null;
function noise(ac: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ac.sampleRate) return noiseBuffer;
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** 在 [-1, 1] 之間隨機 */
const spread = (): number => Math.random() * 2 - 1;

function playMeow(ac: BaseAudioContext, t: number): void {
  const m = MEOW;
  const isMew = Math.random() < m.mewChance;
  const shape = isMew ? m.mew : m.meow;
  const k = (1 + spread() * m.jitter) * (isMew ? m.mewPitch : 1);
  const dur = (m.dur.min + Math.random() * (m.dur.max - m.dur.min)) * (isMew ? m.mewDur : 1);
  const end = t + dur;
  const gain = m.gain * (isMew ? m.mewGain : 1);

  // 聲帶：鋸齒波，音高拱形＋顫音，再低通讓它不刺
  const src = ac.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(m.pitch.start * k, t);
  src.frequency.linearRampToValueAtTime(m.pitch.peak * k, t + dur * m.pitch.peakAt);
  src.frequency.exponentialRampToValueAtTime(m.pitch.end * k, end);
  const lfo = ac.createOscillator();
  lfo.frequency.setValueAtTime(m.vibrato.hz, t);
  const lfoGain = ac.createGain();
  lfoGain.gain.setValueAtTime(m.vibrato.depth, t);
  lfo.connect(lfoGain).connect(src.frequency);
  const tilt = ac.createBiquadFilter();
  tilt.type = 'lowpass';
  tilt.frequency.setValueAtTime(m.tilt, t);
  src.connect(tilt);

  // 氣音：白噪音，跟著主聲一起走共振峰
  const air = ac.createBufferSource();
  air.buffer = noise(ac);
  const airGain = ac.createGain();
  airGain.gain.setValueAtTime(m.breath, t);
  air.connect(airGain);

  // 嘴型：三個共振峰沿著 [m]→[i]→[a]→[u] 移動；音量跟著嘴巴開合
  const mouth = ac.createGain();
  mouth.gain.setValueAtTime(SOUND_FLOOR, t);
  for (const v of shape) mouth.gain.linearRampToValueAtTime(Math.max(SOUND_FLOOR, v.amp * gain), t + dur * v.at + SOUND_ATTACK);
  mouth.gain.exponentialRampToValueAtTime(SOUND_FLOOR, end);

  for (let i = 0; i < 3; i += 1) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(m.formantQ[i] ?? 1, t);
    const first = shape[0];
    if (first) bp.frequency.setValueAtTime(first.formants[i] ?? 1000, t);
    for (const v of shape) bp.frequency.linearRampToValueAtTime(v.formants[i] ?? 1000, t + dur * v.at);
    const level = ac.createGain();
    level.gain.setValueAtTime(m.formantGain[i] ?? 0, t);
    tilt.connect(bp);
    airGain.connect(bp);
    bp.connect(level).connect(mouth);
  }
  mouth.connect(ac.destination);

  src.start(t);
  lfo.start(t);
  air.start(t);
  const stopAt = end + SOUND_ATTACK;
  src.stop(stopAt);
  lfo.stop(stopAt);
  air.stop(stopAt);
}

/** 在指定的音訊環境裡排一個音效（離線算圖、測量音量也用這個）。 */
export function scheduleSound(ac: BaseAudioContext, name: SoundName, t: number): void {
  if (name === 'meow') {
    playMeow(ac, t);
    return;
  }
  for (const spec of TONES[name]) playTone(ac, spec, t);
}

/**
 * 播放一個音效。
 * fromGesture＝這次是使用者手勢觸發（可以建立音訊）；不是手勢時，聲音還沒解鎖就安靜略過。
 */
export function playSound(name: SoundName, fromGesture: boolean): void {
  const ac = audio(fromGesture);
  if (!ac) return;
  scheduleSound(ac, name, ac.currentTime);
}
