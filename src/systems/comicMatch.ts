// 連連看：由漫畫資料機械產生，不新寫任何字（docs/plans/level-mode.md §2、ADR 0023）。
// 左邊是格子（照漫畫的順序），右邊是打亂的格子說明；判對錯比說明的字串，兩格字相同互通。
import type { StudyCard } from '../core/types';
import { comicPanelText } from './comic';
import { shuffle } from './selection';

type ComicCard = Pick<StudyCard, 'hook' | 'faces' | 'comic'>;

export interface ComicMatchSet {
  /** 左邊：格子的序號（漫畫裡的第幾格），照漫畫的順序 */
  left: number[];
  /** 右邊：每一句不同的說明各一次，已打亂 */
  right: string[];
}

/** 一張卡能配對的格子與說明；指不到原文的格子不列，不同的說明不到兩句就是 null */
export function comicMatchSet(card: ComicCard, rng: () => number): ComicMatchSet | null {
  const panels = card.comic?.panels ?? [];
  const left: number[] = [];
  const texts: string[] = [];
  panels.forEach((panel, i) => {
    const text = comicPanelText(card, panel)?.text;
    if (!text) return;
    left.push(i);
    if (!texts.includes(text)) texts.push(text);
  });
  if (texts.length < 2) return null;
  let right = shuffle(texts, rng);
  // 剛好洗回原順序就整排轉一格：右邊一定和左邊錯開
  if (right.every((t, i) => t === texts[i])) right = [...right.slice(1), right[0]!];
  return { left, right };
}

/** 第 panel 格配上 text 對不對 */
export function isComicMatch(card: ComicCard, panel: number, text: string): boolean {
  const target = card.comic?.panels[panel];
  return target !== undefined && comicPanelText(card, target)?.text === text;
}
