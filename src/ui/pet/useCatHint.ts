import { useEffect } from 'react';
import { CAT_HINT } from '../../core/constants/pet';
import type { Choice } from '../../core/types';
import type { World } from '../../core/world';
import { leaderCat } from '../../selectors/house';
import { useCanRoam } from './CatHome';
import { hintDelay, pickHint } from './petLogic';
import { hintPet } from './petStore';

/** 選項外框上的標記：小貓靠它找到要跳上去的那個選項 */
export const CAT_CHOICE_ATTR = 'data-cat-choice';

export interface CatHintInput {
  world: World;
  /** 這一題可以提示（還沒作答、不是模擬考） */
  enabled: boolean;
  /** 題目換了就重新計時 */
  questionId: string;
  /** 題目加選項的字數（決定等多久） */
  chars: number;
  /** 畫面上選項的順序、正確答案 */
  order: readonly Choice[];
  answer: readonly Choice[];
}

/**
 * 想太久的提示：這一題停太久沒作答，小貓跳到某個選項上猜一個（CAT_HINT；不保證對，作答後才知道牠猜得對不對）。
 * 一題只提示一次；選項不在畫面上或被抽屜蓋住、找不到小貓的家、開著「減少動態」時不提示。
 */
export function useCatHint({ world, enabled, questionId, chars, order, answer }: CatHintInput): void {
  const canRoam = useCanRoam();
  const orderKey = order.join('');
  const answerKey = answer.join('');
  useEffect(() => {
    if (!enabled || !canRoam) return undefined;
    const id = window.setTimeout(() => {
      const guess = pickHint(order, answer, Math.random, CAT_HINT.chance);
      if (!guess) return;
      const el = document.querySelector(`[${CAT_CHOICE_ATTR}="${guess.choice}"]`);
      // 家：這一頁的（進度條上那隻）優先，沒有才用分頁列的
      const home = document.querySelector('[data-cat-home]:not([data-cat-home="tab"])') ?? document.querySelector('[data-cat-home]');
      if (!el || !home) return;
      const r = el.getBoundingClientRect();
      if (r.top < CAT_HINT.minTop || r.top > window.innerHeight) return;
      // 選項上面蓋著別的東西（抽屜、對話框）時不提示：她現在不是在看題目
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || !el.contains(top)) return;
      const h = home.getBoundingClientRect();
      hintPet(leaderCat(world), el, guess.right, { left: h.left, top: h.top, width: h.width, height: h.height });
    }, hintDelay(chars, Math.random, CAT_HINT));
    return () => window.clearTimeout(id);
    // order、answer 用字串當依賴：內容一樣就不重新計時
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, enabled, canRoam, questionId, chars, orderKey, answerKey]);
}
