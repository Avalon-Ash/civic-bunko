// 卡片↔官方題：這張卡對應哪些題（ADR 0022）。畫面一律經 selectors/cardLinks.ts 查，這裡給回合系統用。
import type { QuestionId } from '../core/types';
import type { World } from '../core/world';

/** 取得這張卡對應的官方題 ID：只留題庫裡存在的、去重、照卡片寫的順序。 */
export function cardQuestionIds(world: World, cardId: string): QuestionId[] {
  const card = world.cards.find((c) => c.id === cardId);
  if (!card?.questions || card.questions.length === 0) {
    return [];
  }

  const seen = new Set<QuestionId>();
  const result: QuestionId[] = [];
  for (const id of card.questions) {
    if (!world.questions.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }
  return result;
}
