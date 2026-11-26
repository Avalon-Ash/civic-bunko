// 卡片↔官方題的連結查詢（唯一查詢入口；docs/plans/comic-cards.md §2.4、ADR 0022）。
import type { QuestionId } from '../core/types';
import type { World } from '../core/world';
import { cardById, type CardView } from './cards';

export { cardQuestionIds } from '../systems/cardLinks';

/** 取得這題連到的圖卡（照 world.cards 順序）；題目不在題庫裡或沒連到時回傳空陣列。 */
export function cardsForQuestion(world: World, questionId: QuestionId): CardView[] {
  if (!world.questions.has(questionId)) {
    return [];
  }

  const result: CardView[] = [];
  for (const card of world.cards) {
    if (!card.questions?.includes(questionId)) {
      continue;
    }
    const view = cardById(world, card.id);
    if (view) {
      result.push(view);
    }
  }
  return result;
}
