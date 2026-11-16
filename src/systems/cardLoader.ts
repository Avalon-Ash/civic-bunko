import type { CardFile, PaperFile, StudyCard } from '../core/types';
import type { World } from '../core/world';

/** 把卡片檔載入 world.cards；申論卡的題目原文從官方層填入，找不到對應申論題的卡片不載入。 */
export function loadCards(world: World, cardFiles: readonly CardFile[], paperFiles: readonly PaperFile[]): void {
  const essayText = new Map<string, string>();
  for (const file of paperFiles) {
    for (const essay of file.essays) {
      essayText.set(`${file.paper.id}#${essay.no}`, essay.text);
    }
  }

  const cards: StudyCard[] = [];
  const seen = new Set<string>();
  for (const file of cardFiles) {
    for (const card of file.cards) {
      if (seen.has(card.id)) continue;
      if (card.essay) {
        const text = essayText.get(`${card.essay.paperId}#${card.essay.no}`);
        if (text === undefined) continue;
        cards.push({ ...card, essayText: text });
      } else {
        cards.push(card);
      }
      seen.add(card.id);
    }
  }

  world.cards = cards;
  world.bus.emit({ type: 'cardsLoaded', count: cards.length });
}
