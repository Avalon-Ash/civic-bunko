import { useState } from 'react';
import { GUIDE } from '../../core/constants/guide';
import type { CardKind } from '../../core/types';
import type { World } from '../../core/world';
import {
  cardById,
  cardDecks,
  cardHasComic,
  cardSubjects,
  cardsOfKind,
  type CardView,
} from '../../selectors/cards';
import '../cards.css';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import { CardLevelScreen, LevelStars } from '../components/cards/CardLevelScreen';
import { CardListItem } from '../components/cards/CardListItem';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { Collapse } from '../kit/Collapse';
import { Segmented, type SegmentedOption } from '../kit/Segmented';
import { cardDueCount, cardStars } from '../../selectors/cardLevel';
import { guideAnchor, useGo } from '../useGuide';
import { useLevel } from '../useLevel';
import { useWorld } from '../useWorld';

export interface CardsScreenProps {
  world: World;
}

type CardFilter =
  | { mode: 'all' }
  | { mode: 'comic' }
  | { mode: 'subject'; key: string };

interface CardGroup {
  key: string;
  label: string;
  cards: CardView[];
}

const OTHER_GROUP_KEY = '__other__';

function groupCardsBySubject(cards: readonly CardView[]): CardGroup[] {
  const groups: CardGroup[] = [];
  const byKey = new Map<string, CardGroup>();
  const other: CardView[] = [];

  for (const card of cards) {
    if (!card.subjectKey || !card.subjectShort) {
      other.push(card);
      continue;
    }
    const existing = byKey.get(card.subjectKey);
    if (existing) {
      existing.cards.push(card);
    } else {
      const entry: CardGroup = { key: card.subjectKey, label: card.subjectShort, cards: [card] };
      byKey.set(card.subjectKey, entry);
      groups.push(entry);
    }
  }

  if (other.length > 0) {
    groups.push({ key: OTHER_GROUP_KEY, label: '其他', cards: other });
  }

  return groups;
}

/** 這張卡打開是關卡（有漫畫的卡，申論卡也算），不是抽屜 */
function isLevelCard(card: CardView): boolean {
  return cardHasComic(card);
}

function CardGrid({
  world,
  cards,
  firstUnseenId,
  showSubject,
  onSelect,
}: {
  world: World;
  cards: readonly CardView[];
  firstUnseenId: string | null;
  showSubject: boolean;
  onSelect: (id: string) => void;
}) {
  const now = new Date();
  return (
    <div className="cb-card-grid">
      {cards.map((card) => (
        <div
          key={card.id}
          className="cb-card-slot"
          {...(card.id === firstUnseenId ? guideAnchor('cards-unseen') : {})}
        >
          <CardListItem
            card={card}
            onSelect={onSelect}
            showSubject={showSubject}
            badge={<CardBadge world={world} card={card} now={now} />}
          />
        </div>
      ))}
    </div>
  );
}

/** 標題旁的記號：關卡的星星；連到的考古題今天有到期的，再加「該複習」 */
function CardBadge({ world, card, now }: { world: World; card: CardView; now: Date }) {
  const due = cardDueCount(world, card, now);
  if (!isLevelCard(card) && due === 0) return null;
  return (
    <span className="cb-card-badge">
      {due > 0 ? (
        <Chip tone="orange" className="cb-card-due" aria-label={`該複習 ${due} 題`}>
          該複習
        </Chip>
      ) : null}
      {isLevelCard(card) ? <LevelStars stars={cardStars(world, card)} /> : null}
    </span>
  );
}

function CardsPlaceholder() {
  const go = useGo();
  return (
    <div className="cb-stack">
      <h1>圖卡</h1>
      <Card className="cb-cards-placeholder">
        <Cat size={96} mood="sleepy" interactive />
        <h2>準備中</h2>
        <p className="cb-sub">考點圖卡與申論架構正在整理中，先去刷題熱身吧！</p>
        <Button onClick={() => go(GUIDE.cardsEmpty)}>去刷題</Button>
      </Card>
    </div>
  );
}

function CardsContent({ world }: { world: World }) {
  useWorld(world);
  const [selectedKind, setSelectedKind] = useState<CardKind>('concept');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>({ mode: 'all' });
  const levelApi = useLevel();

  const decks = cardDecks(world);
  const firstDeck = decks[0];
  if (!firstDeck) {
    return <CardsPlaceholder />;
  }

  const levelCard = levelApi.level ? cardById(world, levelApi.level.cardId) : null;
  if (levelCard) {
    return <CardLevelScreen key={levelCard.id} world={world} card={levelCard} />;
  }
  const selectCard = (id: string) => {
    const card = cardById(world, id);
    if (card && isLevelCard(card)) levelApi.open(id);
    else setOpenCardId(id);
  };

  const activeDeck = decks.find((deck) => deck.kind === selectedKind) ?? firstDeck;
  const activeKind = activeDeck.kind;
  const allCards = cardsOfKind(world, activeKind);
  const subjects = cardSubjects(allCards);
  const comicCards = allCards.filter(cardHasComic);
  const comicCount = comicCards.length;

  // 換分類後，原本選的科目或漫畫在這一類可能沒有卡：當成全部
  const activeFilter: CardFilter =
    filter.mode === 'comic' && comicCount === 0
      ? { mode: 'all' }
      : filter.mode === 'subject' && !subjects.some((s) => s.key === filter.key)
        ? { mode: 'all' }
        : filter;

  const isGrouped = activeFilter.mode === 'all';
  const groups = isGrouped ? groupCardsBySubject(allCards) : [];
  const flatCards =
    activeFilter.mode === 'comic'
      ? comicCards
      : activeFilter.mode === 'subject'
        ? allCards.filter((card) => card.subjectKey === activeFilter.key)
        : [];

  // 「第一張沒看過」只判斷一次：分組預設展開與落點共用它
  const orderedCards = isGrouped ? groups.flatMap((group) => group.cards) : flatCards;
  const firstUnseenId = orderedCards.find((card) => !card.seen)?.id ?? null;
  const defaultOpenGroupKey =
    (firstUnseenId !== null
      ? groups.find((group) => group.cards.some((card) => card.id === firstUnseenId))?.key
      : undefined) ?? groups[0]?.key;

  const openCard = openCardId ? cardById(world, openCardId) : null;
  const showFilterBar = subjects.length > 1 || comicCount > 0;

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

      {showFilterBar && (
        <div className="cb-pick-grid" role="group" aria-label="依科目篩選圖卡">
          <Chip
            tone="mint"
            active={activeFilter.mode === 'all'}
            onClick={() => setFilter({ mode: 'all' })}
          >
            全部 {allCards.length}
          </Chip>
          {comicCount > 0 && (
            <Chip
              tone="mint"
              active={activeFilter.mode === 'comic'}
              onClick={() => setFilter({ mode: 'comic' })}
            >
              漫畫 {comicCount}
            </Chip>
          )}
          {subjects.length > 1 &&
            subjects.map((subject) => (
              <Chip
                key={subject.key}
                tone="mint"
                active={activeFilter.mode === 'subject' && activeFilter.key === subject.key}
                onClick={() => setFilter({ mode: 'subject', key: subject.key })}
              >
                {subject.short} {subject.count}
              </Chip>
            ))}
        </div>
      )}

      {isGrouped ? (
        <div className="cb-card-groups">
          {groups.map((group) => {
            const seenCount = group.cards.filter((card) => card.seen).length;
            return (
              <Collapse
                key={`${activeKind}:${group.key}`}
                title={group.label}
                summary={`看過 ${seenCount}/${group.cards.length}`}
                defaultOpen={group.key === defaultOpenGroupKey}
              >
                <CardGrid
                  world={world}
                  cards={group.cards}
                  firstUnseenId={firstUnseenId}
                  showSubject={false}
                  onSelect={selectCard}
                />
              </Collapse>
            );
          })}
        </div>
      ) : (
        <CardGrid
          world={world}
          cards={flatCards}
          firstUnseenId={firstUnseenId}
          showSubject
          onSelect={selectCard}
        />
      )}

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
