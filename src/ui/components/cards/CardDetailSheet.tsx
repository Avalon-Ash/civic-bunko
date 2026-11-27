import { useCallback, useEffect, useState } from 'react';
import { dispatch } from '../../../core/commands';
import type { LawRef } from '../../../core/types';
import type { World } from '../../../core/world';
import { formatLawRef } from '../../../data/laws';
import type { CardView } from '../../../selectors/cards';
import { Chip } from '../../kit/Chip';
import { Sheet } from '../../kit/Sheet';
import { Visual } from '../../kit/Visual';
import { LawArticleView } from '../LawArticleView';
import { CardFaceViewer } from './CardFaceViewer';
import { EssayCardBody } from './EssayCardBody';
import { ComicSection } from './comic/ComicSection';
import { CardLawChips } from './CardLawChips';
import { CardRoundButton } from './CardRoundButton';

export interface CardDetailSheetProps {
  world: World;
  card: CardView | null;
  onClose: () => void;
}

/** 圖卡詳情底部抽屜：顯示標題、一句話重點、小圖、翻面／申論架構與法條原文查詢。 */
export function CardDetailSheet({ world, card, onClose }: CardDetailSheetProps) {
  const [renderedCard, setRenderedCard] = useState<CardView | null>(card);
  const [activeLawRef, setActiveLawRef] = useState<LawRef | null>(null);
  const [completing, setCompleting] = useState(false);
  const [burstTick, setBurstTick] = useState<number | null>(null);

  useEffect(() => {
    if (card) {
      setRenderedCard(card);
    }
  }, [card]);

  useEffect(() => {
    setActiveLawRef(null);
    setCompleting(false);
    setBurstTick(null);
  }, [card?.id]);

  const handleClose = useCallback(() => {
    setActiveLawRef(null);
    setCompleting(false);
    setBurstTick(null);
    onClose();
  }, [onClose]);

  const handleComplete = useCallback(() => {
    if (!renderedCard || completing) return;
    setCompleting(true);
    dispatch(world, { type: 'markCardSeen', id: renderedCard.id });
    setBurstTick((prev) => (prev ?? 0) + 1);
  }, [world, renderedCard, completing]);

  const handleBurstDone = useCallback(() => {
    setBurstTick(null);
    setCompleting(false);
    handleClose();
  }, [handleClose]);

  const activeCard = card ?? renderedCard;

  return (
    <Sheet
      open={card !== null}
      onClose={handleClose}
      title={activeLawRef ? formatLawRef(activeLawRef) : (activeCard?.title ?? '圖卡')}
    >
      {activeCard && (
        <div className="cb-card-sheet-body">
          {activeLawRef ? (
            <LawArticleView
              lawRef={activeLawRef}
              onBack={() => setActiveLawRef(null)}
              backLabel="← 返回圖卡"
            />
          ) : (
            <>
              <header className="cb-card-sheet-head">
                {(activeCard.subjectShort || activeCard.seen) && (
                  <div className="cb-card-sheet-meta">
                    {activeCard.subjectShort ? (
                      <Chip tone="butter">{activeCard.subjectShort}</Chip>
                    ) : (
                      <span />
                    )}
                    {activeCard.seen && <span className="cb-card-seen-tag">已看過</span>}
                  </div>
                )}
                <h2 className="cb-card-sheet-title">{activeCard.title}</h2>
                <p className="cb-card-sheet-hook">{activeCard.hook}</p>
              </header>

              {activeCard.comic && activeCard.kind !== 'essay' ? (
                <ComicSection card={{ ...activeCard, comic: activeCard.comic }} />
              ) : null}

              <CardRoundButton world={world} cardId={activeCard.id} className="cb-card-round-btn" />

              {activeCard.visual && <Visual visual={activeCard.visual} />}

              {activeCard.kind === 'essay' ? (
                <>
                  <CardLawChips lawRefs={activeCard.lawRefs} onOpen={setActiveLawRef} />
                  <EssayCardBody
                    card={activeCard}
                    onComplete={handleComplete}
                    completing={completing}
                    burstTick={burstTick}
                    onBurstDone={handleBurstDone}
                  />
                </>
              ) : (
                <>
                  <CardFaceViewer
                    cardId={activeCard.id}
                    faces={activeCard.faces}
                    onComplete={handleComplete}
                    completing={completing}
                    burstTick={burstTick}
                    onBurstDone={handleBurstDone}
                  />
                  <CardLawChips lawRefs={activeCard.lawRefs} onOpen={setActiveLawRef} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
