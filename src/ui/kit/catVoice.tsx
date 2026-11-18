// 小貓「說話」的接縫：畫面上的小貓只認得 CatVoice 這個函式，誰來回答由外面注入（ui/pet/CatVoiceProvider）。
// 泡泡也在這裡：頭像（Cat）和跑出來玩的小貓（PetLayer）共用同一個。
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CAT_BUBBLE_MS } from '../../core/constants/cat';
import type { CatVoice } from '../../core/types';

/** 沒有注入時不說話（看圖頁、測試、單獨渲染的小貓） */
const SILENT: CatVoice = () => null;

export const CatVoiceContext = createContext<CatVoice>(SILENT);

export function useCatVoice(): CatVoice {
  return useContext(CatVoiceContext);
}

/** 泡泡離螢幕邊緣至少留多少（px） */
const BUBBLE_MARGIN = 8;

/**
 * 小貓頭上的對話泡泡。回傳泡泡的節點（放進定位用的容器裡，容器要 position: relative 或 absolute）和 say。
 * 泡泡以容器為中心；靠近螢幕邊緣時往內推，頂到上緣時改放在容器下方；CAT_BUBBLE_MS 後自己消失。
 */
export function useCatBubble(): { bubble: ReactNode; say: (text: string) => void } {
  /** seq 讓同一句連說兩次也重新計時、重新定位 */
  const [shown, setShown] = useState<{ text: string; seq: number } | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    el.style.setProperty('--cb-bubble-shift', '0px');
    el.classList.remove('is-below');
    const rect = el.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    let shift = 0;
    if (rect.left < BUBBLE_MARGIN) shift = BUBBLE_MARGIN - rect.left;
    else if (rect.right > viewport - BUBBLE_MARGIN) shift = viewport - BUBBLE_MARGIN - rect.right;
    el.style.setProperty('--cb-bubble-shift', `${Math.round(shift)}px`);
    if (rect.top < BUBBLE_MARGIN) el.classList.add('is-below');
  }, [shown]);

  useEffect(() => {
    if (!shown) return undefined;
    const id = window.setTimeout(() => setShown(null), CAT_BUBBLE_MS);
    return () => window.clearTimeout(id);
  }, [shown]);

  const say = useCallback((text: string) => {
    setShown((prev) => ({ text, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const bubble = shown ? (
    <span key={shown.seq} ref={ref} className="cb-cat-bubble" role="status" aria-live="polite">
      {shown.text}
    </span>
  ) : null;

  return { bubble, say };
}
