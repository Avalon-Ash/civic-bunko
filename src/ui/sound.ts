// 音效播放器（Web Audio 即時合成）。聲音設計在 core/constants/sound.ts；這裡只負責把它播出來。
import { MEOW_CLIPS, MEOW_FADE, SOUND_ATTACK, SOUND_FLOOR, TONES } from '../core/constants/sound';
import type { SoundName, ToneSpec } from '../core/types';
import { createSoundPlayer } from './soundPlayer';

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

/** 建立音訊環境（只會在使用者手勢裡被呼叫）；瀏覽器不支援回 null */
function createContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as Window & WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  const nav = navigator as Navigator & NavigatorWithAudioSession;
  if (nav.audioSession) nav.audioSession.type = 'ambient';
  const ac = new Ctor();
  // 換新的音訊環境時，貓叫錄音重新解碼：舊環境上沒解完的工作可能永遠不會結束，不能沿用
  clipBuffers.clear();
  preloadClips(ac);
  return ac;
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

/** 貓叫錄音的網址（打包時進 assets/，離線快取會收） */
const CLIP_URLS = import.meta.glob<string>('./sounds/*.mp3', { query: '?url', import: 'default', eager: true });
const clipBuffers = new Map<string, Promise<AudioBuffer | null>>();
let lastClip = -1;

/** 解碼一段錄音（同一段只解一次；離線又沒快取時回 null） */
function loadClip(ac: BaseAudioContext, file: string): Promise<AudioBuffer | null> {
  const cached = clipBuffers.get(file);
  if (cached) return cached;
  const url = CLIP_URLS[`./sounds/${file}`];
  const job = url
    ? fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ac.decodeAudioData(data))
        .catch(() => {
          clipBuffers.delete(file);
          return null;
        })
    : Promise.resolve(null);
  clipBuffers.set(file, job);
  return job;
}

/** 先把貓叫錄音解碼好，第一次點小貓才不會慢半拍 */
function preloadClips(ac: BaseAudioContext): void {
  for (const clip of MEOW_CLIPS) void loadClip(ac, clip.file);
}

/** 輪流挑一段（不連續兩次同一段），解碼好就播 */
function playMeow(ac: BaseAudioContext, t: number): void {
  if (MEOW_CLIPS.length === 0) return;
  let idx = Math.floor(Math.random() * MEOW_CLIPS.length);
  if (MEOW_CLIPS.length > 1 && idx === lastClip) idx = (idx + 1) % MEOW_CLIPS.length;
  lastClip = idx;
  const clip = MEOW_CLIPS[idx];
  if (!clip) return;
  void loadClip(ac, clip.file).then((buf) => {
    if (!buf) return;
    const start = Math.max(t, ac.currentTime);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    const end = start + clip.duration;
    g.gain.setValueAtTime(clip.gain, start);
    g.gain.setValueAtTime(clip.gain, end - MEOW_FADE);
    g.gain.linearRampToValueAtTime(SOUND_FLOOR, end);
    src.connect(g).connect(ac.destination);
    src.start(start, clip.offset, clip.duration);
  });
}

/** 在指定的音訊環境裡排一個音效（離線算圖、測量音量也用這個）。 */
export function scheduleSound(ac: BaseAudioContext, name: SoundName, t: number): void {
  if (name === 'meow') {
    playMeow(ac, t);
    return;
  }
  for (const spec of TONES[name]) playTone(ac, spec, t);
}

/** 叫醒、恢復、重建的規則在 soundPlayer.ts；這裡接上真正的 Web Audio */
const player = createSoundPlayer<AudioContext>({
  createContext,
  schedule: scheduleSound,
  now: () => Date.now(),
});

/**
 * 播放一個音效。
 * fromGesture＝這次是使用者手勢觸發（可以建立音訊）；不是手勢時，聲音還沒解鎖就安靜略過。
 */
export function playSound(name: SoundName, fromGesture: boolean): void {
  player.play(name, fromGesture);
}

/**
 * 在使用者手勢裡把音訊叫醒（不出聲）。切到背景、鎖螢幕、來電之後音訊會被系統暫停，
 * 要在瀏覽器認的手勢（放開手指、點擊、按鍵）裡叫才會回來；每次手勢都可以叫。
 */
export function unlockSound(): void {
  player.unlock();
}
