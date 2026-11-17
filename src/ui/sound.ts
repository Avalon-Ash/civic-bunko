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

function envelope(ac: AudioContext, t: number, dur: number, gain: number, attack: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(SOUND_FLOOR, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(SOUND_FLOOR, t + dur);
  return g;
}

function playTone(ac: AudioContext, spec: ToneSpec, t0: number): void {
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

function playMeow(ac: AudioContext, t: number): void {
  const m = MEOW;
  const k = 1 + (Math.random() * 2 - 1) * m.jitter;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(m.start * k, t);
  osc.frequency.linearRampToValueAtTime(m.peak * k, t + m.rise);
  osc.frequency.exponentialRampToValueAtTime(m.end * k, t + m.dur);

  const lfo = ac.createOscillator();
  lfo.frequency.setValueAtTime(m.vibratoHz, t);
  const lfoGain = ac.createGain();
  lfoGain.gain.setValueAtTime(m.vibratoDepth, t);
  lfo.connect(lfoGain).connect(osc.frequency);

  const out = envelope(ac, t, m.dur, m.gain, m.attack);
  for (const f of m.formants) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(f.q, t);
    bp.frequency.setValueAtTime(f.freq, t);
    bp.frequency.linearRampToValueAtTime(f.open, t + m.rise);
    bp.frequency.linearRampToValueAtTime(f.freq, t + m.dur);
    osc.connect(bp).connect(out);
  }
  out.connect(ac.destination);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + m.dur + SOUND_ATTACK);
  lfo.stop(t + m.dur + SOUND_ATTACK);
}

/**
 * 播放一個音效。
 * fromGesture＝這次是使用者手勢觸發（可以建立音訊）；不是手勢時，聲音還沒解鎖就安靜略過。
 */
export function playSound(name: SoundName, fromGesture: boolean): void {
  const ac = audio(fromGesture);
  if (!ac) return;
  const t = ac.currentTime;
  if (name === 'meow') {
    playMeow(ac, t);
    return;
  }
  for (const spec of TONES[name]) playTone(ac, spec, t);
}
