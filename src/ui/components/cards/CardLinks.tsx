// 解析區帶出這題連到的圖卡按鈕（docs/plans/comic-cards.md §3-4、ADR 0022）。
import { useEffect, useState, type TouchEvent } from 'react';
import type { QuestionId } from '../../../core/types';
import type { World } from '../../../core/world';
import { cardsForQuestion } from '../../../selectors/cardLinks';
import { ComicThumb } from '../../kit/comic/ComicStrip';
import { CardDetailSheet } from './CardDetailSheet';

export interface CardLinksProps {
  world: World;
  questionId: QuestionId;
}

function stopTouchPropagation(e: TouchEvent<HTMLDivElement>): void {
  e.stopPropagation();
}

/** 列出這題對應的圖卡小鈕，點了在抽屜裡打開那張卡，關掉回到原題；沒連到圖卡就不畫。 */
export function CardLinks({ world, questionId }: CardLinksProps) {
  const cards = cardsForQuestion(world, questionId);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  useEffect(() => {
    setOpenCardId(null);
  }, [questionId]);

  if (cards.length === 0) {
    return null;
  }

  const openCard = openCardId ? (cards.find((c) => c.id === openCardId) ?? null) : null;

  return (
    <>
      <div className="cb-card-links">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="cb-card-link-btn cb-press"
            onClick={() => setOpenCardId(card.id)}
          >
            {card.comic && <ComicThumb comic={card.comic} />}
            <span className="cb-card-link-label">圖卡：{card.title}</span>
          </button>
        ))}
      </div>
      <div
        className="cb-card-link-portal"
        onTouchStart={stopTouchPropagation}
        onTouchEnd={stopTouchPropagation}
      >
        <CardDetailSheet
          world={world}
          card={openCard}
          onClose={() => setOpenCardId(null)}
        />
      </div>
    </>
  );
}
