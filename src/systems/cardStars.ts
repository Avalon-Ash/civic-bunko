// 圖卡闖關的三顆星（ADR 0023）：只在這裡導出，畫面經 selectors/cardStars 讀。
// 看過＝cardsSeen；配對＝cardsMatched（沒有可配對的漫畫就沒有這顆）；實戰＝連到的官方題每題都答對過（沒掛題就沒有這顆）。
import type { StudyCard } from '../core/types';
import type { World } from '../core/world';
import { cardQuestionIds } from './cardLinks';
import { comicMatchSet } from './comicMatch';

export interface CardStars {
  seen: boolean;
  /** null＝這張卡沒有配對這一步 */
  matched: boolean | null;
  /** null＝這張卡沒有實戰這一步 */
  cleared: boolean | null;
  /** 拿到幾顆 */
  earned: number;
  /** 這張卡有幾顆（＝有幾個步驟） */
  total: number;
}

/** 這張卡有沒有配對這一步（不看亂數：只看配得出題） */
export function cardHasMatch(card: Pick<StudyCard, 'hook' | 'faces' | 'comic'>): boolean {
  return comicMatchSet(card, () => 0) !== null;
}

export function cardStars(world: World, card: Pick<StudyCard, 'id' | 'hook' | 'faces' | 'comic'>): CardStars {
  const seen = (world.settings.cardsSeen ?? []).includes(card.id);
  const matched = cardHasMatch(card) ? (world.settings.cardsMatched ?? []).includes(card.id) : null;
  const questions = cardQuestionIds(world, card.id);
  const cleared = questions.length > 0 ? questions.every((id) => (world.progress.get(id)?.correct ?? 0) >= 1) : null;
  const steps = [seen, matched, cleared].filter((s): s is boolean => s !== null);
  return { seen, matched, cleared, earned: steps.filter(Boolean).length, total: steps.length };
}
