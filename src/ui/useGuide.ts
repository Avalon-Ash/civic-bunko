// 引導：畫面只經 go() 換頁與落點（docs/plans/ux-cleanup.md §2.2、ADR 0019）。
// 目的地的正本在 constants/guide.ts 與 QUESTS.go；這裡只管「怎麼去」：換分頁、捲到落點、閃一下、交出預選。
import { createContext, useContext, useEffect, useRef } from 'react';
import type { GuideAnchor, GuidePreset, GuideTarget, TabId } from '../core/types';

/** 落點的 DOM 屬性名；畫面一律用 guideAnchor() 標，不直接寫屬性 */
const ANCHOR_ATTR = 'data-guide';
/** 落點一閃的 class（樣式在 styles/kit.css，動畫結束就拿掉） */
const FLASH_CLASS = 'is-guided';
/** 換頁後落點元素可能晚一兩格才畫出來（例如等題庫載入）；最多等這麼多格就放棄、只換分頁 */
const LAND_MAX_FRAMES = 30;
/** 落點比視窗這個比例還高（例如展開的成就清單）就對齊頂端，不置中：置中會把它的標題捲出畫面 */
const LAND_TALL_RATIO = 0.5;

/** 在元素上標落點：`<div {...guideAnchor('quiz-start')}>`。同一個 id 只標一個元素（guide.test.ts 守門）。 */
export function guideAnchor(id: GuideAnchor): { [ANCHOR_ATTR]: GuideAnchor } {
  return { [ANCHOR_ATTR]: id };
}

export interface GoState {
  /** 有回合正在進行（刷題分頁顯示的是題目，設定頁不存在） */
  hasActiveRound: boolean;
  /** 刷題分頁停在結果頁 */
  showResult: boolean;
}
export interface GoPlan {
  tab: TabId;
  /** 要落點與預選的目的地；null＝只換分頁 */
  land: GuideTarget | null;
  /** 先收掉結果頁 */
  closeResult: boolean;
}

/**
 * 決定 go(target) 實際怎麼走：有回合正在進行時，去刷題分頁只回到那一題（不落點、不預選、不清回合）；
 * 停在結果頁時先收掉結果頁再落點（回合已經結束，沒有東西會丟）。
 */
export function planGo(target: GuideTarget, state: GoState): GoPlan {
  if (target.tab === 'quiz' && state.hasActiveRound) return { tab: 'quiz', land: null, closeResult: false };
  return { tab: target.tab, land: target, closeResult: target.tab === 'quiz' && state.showResult };
}

/** 一次引導；seq 每次遞增，同一個分頁再引導一次也會重新落點 */
export interface GuideRequest {
  target: GuideTarget;
  seq: number;
}

interface GuideApi {
  go: (target: GuideTarget) => void;
  request: GuideRequest | null;
  /** 這次引導帶的預選是 preset 而且還沒被拿走：拿走並回 true（每次引導只交出一次） */
  takePreset: (preset: GuidePreset) => boolean;
}

const GuideContext = createContext<GuideApi>({
  go: () => {},
  request: null,
  takePreset: () => false,
});

export const GuideProvider = GuideContext.Provider;

/** 取得 go()：任何「叫她去做某件事」的按鈕都用它，不自己換分頁 */
export function useGo(): (target: GuideTarget) => void {
  return useContext(GuideContext).go;
}

/** 目的地畫面接預選：這次引導帶著 preset 時呼叫 apply 一次 */
export function useGuidePreset(preset: GuidePreset, apply: () => void): void {
  const { request, takePreset } = useContext(GuideContext);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (request && takePreset(preset)) applyRef.current();
  }, [request, preset, takePreset]);
}

/** App 用：每次引導把落點捲進畫面中間、閃一下；找不到落點就只換分頁，不報錯 */
export function useGuideLanding(request: GuideRequest | null): void {
  useEffect(() => {
    const anchor = request?.target.anchor;
    if (!anchor) return;
    let frame = 0;
    let tries = 0;
    let landed: HTMLElement | null = null;
    const clear = () => landed?.classList.remove(FLASH_CLASS);
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[${ANCHOR_ATTR}="${anchor}"]`);
      if (!el) {
        tries += 1;
        if (tries < LAND_MAX_FRAMES) frame = requestAnimationFrame(find);
        return;
      }
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const tall = el.getBoundingClientRect().height > window.innerHeight * LAND_TALL_RATIO;
      el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' });
      el.classList.remove(FLASH_CLASS);
      void el.offsetWidth; // 重新觸發動畫
      el.classList.add(FLASH_CLASS);
      el.addEventListener('animationend', clear, { once: true });
      landed = el;
    };
    frame = requestAnimationFrame(find);
    return () => {
      cancelAnimationFrame(frame);
      landed?.removeEventListener('animationend', clear);
      clear();
    };
  }, [request]);
}
