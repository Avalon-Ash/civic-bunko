import { useState } from 'react';
import type { CardKind } from '../../core/types';
import type { World } from '../../core/world';
import { cardById, cardDecks, cardsOfKind } from '../../selectors/cards';
import '../cards.css';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import { CardListItem } from '../components/cards/CardListItem';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Segmented, type SegmentedOption } from '../kit/Segmented';
import { useWorld } from '../useWorld';

export interface CardsScreenProps {
  /** 待主代理於 App.tsx 傳入 world={world}；未傳入時安全顯示佔位畫面。 */
  world?: World;
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

  const decks = cardDecks(world);
  const firstDeck = decks[0];
  if (!firstDeck) {
    return <CardsPlaceholder />;
  }

  const activeDeck = decks.find((deck) => deck.kind === selectedKind) ?? firstDeck;
  const activeKind = activeDeck.kind;
  const cards = cardsOfKind(world, activeKind);
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
  if (!world) {
    return <CardsPlaceholder />;
  }
  return <CardsContent world={world} />;
}
