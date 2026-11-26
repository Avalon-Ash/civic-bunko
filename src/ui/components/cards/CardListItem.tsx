import type { ReactNode } from 'react';
import { cardHasComic, type CardView } from '../../../selectors/cards';
import { Card } from '../../kit/Card';
import { Chip } from '../../kit/Chip';
import { ComicThumb } from '../../kit/comic/ComicStrip';

export interface CardListItemProps {
  card: CardView;
  onSelect: (id: string) => void;
  /** 是否顯示科目籤（依科目分組時傳 false；平鋪時預設 true） */
  showSubject?: boolean;
  /** 標題旁的額外記號（例如之後的「該複習」記號） */
  badge?: ReactNode;
}

function PawCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="11" cy="15.5" rx="5.2" ry="4.1" className="cb-card-paw-fill" />
      <circle cx="5.4" cy="10.2" r="2.1" className="cb-card-paw-fill" />
      <circle cx="11" cy="7.6" r="2.2" className="cb-card-paw-fill" />
      <circle cx="16.6" cy="10.2" r="2.1" className="cb-card-paw-fill" />
      <path
        d="M14.2 17.5l2.3 2.3 4.3-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 圖卡清單的單張卡片項目：左漫畫小圖（有漫畫時）、中標題與兩行重點、右已看過貓掌勾。 */
export function CardListItem({
  card,
  onSelect,
  showSubject = true,
  badge,
}: CardListItemProps) {
  return (
    <Card
      pressable
      onClick={() => onSelect(card.id)}
      className={`cb-card-item ${card.seen ? 'is-seen' : ''}`.trim()}
    >
      {cardHasComic(card) && card.comic ? <ComicThumb comic={card.comic} /> : null}
      <div className="cb-card-item-main">
        <div className="cb-card-item-title-row">
          {showSubject && card.subjectShort ? (
            <Chip tone="butter" className="cb-card-item-subj">
              {card.subjectShort}
            </Chip>
          ) : null}
          <strong className="cb-card-item-title">{card.title}</strong>
          {badge}
        </div>
        <p className="cb-card-item-hook">{card.hook}</p>
      </div>
      {card.seen ? (
        <span className="cb-card-seen-badge" aria-label="已看過" title="已看過">
          <PawCheckIcon />
        </span>
      ) : null}
    </Card>
  );
}
