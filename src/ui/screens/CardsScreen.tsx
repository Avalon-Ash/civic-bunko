import { useState } from 'react';
import type { CardKind } from '../../core/types';
import type { World } from '../../core/world';
import { cardById, cardDecks, cardSubjects, cardsOfKind } from '../../selectors/cards';
import '../cards.css';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import { CardListItem } from '../components/cards/CardListItem';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { Segmented, type SegmentedOption } from '../kit/Segmented';
import { useWorld } from '../useWorld';

export interface CardsScreenProps {
  world: World;
}

function CardsPlaceholder() {
  return (
    <div className="cb-stack">
      <h1>圖卡</h1>
      <Card className="cb-cards-placeholder">
        <Cat size={96} mood="sleepy" interactive />
        <h2>準備中</h2>
        <p className="cb-sub">考點圖卡與申論架構正在整理中，先去刷題熱身吧！</p>
      </Card>
    </div>
  );
}

function CardsContent({ world }: { world: World }) {
  useWorld(world);
  const [selectedKind, setSelectedKind] = useState<CardKind>('concept');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  const decks = cardDecks(world);
  const firstDeck = decks[0];
  if (!firstDeck) {
    return <CardsPlaceholder />;
  }

  const activeDeck = decks.find((deck) => deck.kind === selectedKind) ?? firstDeck;
  const activeKind = activeDeck.kind;
  const allCards = cardsOfKind(world, activeKind);
  const subjects = cardSubjects(allCards);
  // 換分類後，原本選的科目在這一類可能沒有卡：當成沒選
  const activeSubject =
    subjectFilter !== null && subjects.some((s) => s.key === subjectFilter) ? subjectFilter : null;
  const cards =
    activeSubject === null ? allCards : allCards.filter((card) => card.subjectKey === activeSubject);
  const openCard = openCardId ? cardById(world, openCardId) : null;

  const deckOptions: SegmentedOption<CardKind>[] = decks.map((deck) => ({
    value: deck.kind,
    label: `${deck.label} ${deck.seen}/${deck.total}`,
  }));

  return (
    <div className="cb-stack">
      <header className="cb-page-head">
        <h1>圖卡</h1>
        {decks.length === 1 && (
          <span className="cb-sub-strong cb-num-tabular">
            {activeDeck.label} {activeDeck.seen}/{activeDeck.total}
          </span>
        )}
      </header>

      {decks.length > 1 && (
        <Segmented
          options={deckOptions}
          value={activeKind}
          onChange={setSelectedKind}
          ariaLabel="圖卡類別"
          className="cb-seg-fill cb-card-seg"
        />
      )}

      {subjects.length > 1 && (
        <div className="cb-pick-grid" role="group" aria-label="依科目篩選圖卡">
          <Chip tone="mint" active={activeSubject === null} onClick={() => setSubjectFilter(null)}>
            全部 {allCards.length}
          </Chip>
          {subjects.map((subject) => (
            <Chip
              key={subject.key}
              tone="mint"
              active={activeSubject === subject.key}
              onClick={() => setSubjectFilter(subject.key)}
            >
              {subject.short} {subject.count}
            </Chip>
          ))}
        </div>
      )}

      <div className="cb-card-grid">
        {cards.map((card) => (
          <CardListItem key={card.id} card={card} onSelect={setOpenCardId} />
        ))}
      </div>

      <CardDetailSheet
        world={world}
        card={openCard}
        onClose={() => setOpenCardId(null)}
      />
    </div>
  );
}

/** 圖卡畫面：依觀念／新法／申論分類瀏覽圖卡並開啟抽屜研讀；無資料時顯示準備中。 */
export function CardsScreen({ world }: CardsScreenProps) {
  return <CardsContent world={world} />;
}
