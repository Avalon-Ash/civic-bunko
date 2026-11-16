import type { CardView } from '../../../selectors/cards';
import { Card } from '../../kit/Card';
import { Chip } from '../../kit/Chip';

export interface CardListItemProps {
  card: CardView;
  onSelect: (id: string) => void;
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

/** 圖卡清單的單張卡片項目：顯示科目短名、標題、一句話重點，已看過右上顯示貓掌勾。 */
export function CardListItem({ card, onSelect }: CardListItemProps) {
  const showTopRow = card.subjectShort !== null || card.seen;

  return (
    <Card
      pressable
      onClick={() => onSelect(card.id)}
      className={`cb-card-item ${card.seen ? 'is-seen' : ''}`.trim()}
    >
      {showTopRow && (
        <div className="cb-card-item-head">
          {card.subjectShort ? (
            <Chip tone="butter" className="cb-card-item-subj">
              {card.subjectShort}
            </Chip>
          ) : (
            <span />
          )}
          {card.seen && (
            <span className="cb-card-seen-badge" aria-label="已看過" title="已看過">
              <PawCheckIcon />
            </span>
          )}
        </div>
      )}
      <strong className="cb-card-item-title">{card.title}</strong>
      <p className="cb-card-item-hook">{card.hook}</p>
    </Card>
  );
}
