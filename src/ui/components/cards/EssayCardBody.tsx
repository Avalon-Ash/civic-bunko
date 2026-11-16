import { useEffect, useState } from 'react';
import type { CardView } from '../../../selectors/cards';
import { Burst } from '../../kit/Burst';
import { Button } from '../../kit/Button';
import { Switch } from '../../kit/Switch';

export interface EssayCardBodyProps {
  card: CardView;
  onComplete: () => void;
  completing: boolean;
  burstTick: number | null;
  onBurstDone: () => void;
}

/** 申論架構卡內容：可收合官方題目原文、編號架構方塊與「遮起來背」記憶模式。 */
export function EssayCardBody({
  card,
  onComplete,
  completing,
  burstTick,
  onBurstDone,
}: EssayCardBodyProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [hideMode, setHideMode] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setPromptExpanded(false);
    setHideMode(false);
    setRevealed(new Set());
  }, [card.id]);

  const handleToggleHideMode = (next: boolean) => {
    setHideMode(next);
    setRevealed(new Set());
  };

  const toggleFaceReveal = (index: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="cb-card-essay-body">
      {(card.paperLabel || card.essayText) && (
        <div className="cb-card-essay-source">
          {card.paperLabel && (
            <div className="cb-card-essay-paper">{card.paperLabel}</div>
          )}
          {card.essayText && (
            <button
              type="button"
              className="cb-card-essay-prompt"
              aria-expanded={promptExpanded}
              onClick={() => setPromptExpanded((open) => !open)}
            >
              <span
                className={`cb-card-essay-prompt-text ${promptExpanded ? 'is-expanded' : ''}`.trim()}
              >
                {card.essayText}
              </span>
              <span className="cb-card-essay-prompt-hint">
                {promptExpanded ? '收合題目' : '展開題目'}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="cb-card-essay-toolbar">
        <strong className="cb-card-essay-section-title">答題架構</strong>
        <div className="cb-card-hide-toggle">
          <span className="cb-sub-strong">遮起來背</span>
          <Switch
            checked={hideMode}
            onChange={handleToggleHideMode}
            ariaLabel="遮起來背"
          />
        </div>
      </div>

      <div className="cb-card-essay-blocks">
        {card.faces.map((face, idx) => {
          const isRevealed = !hideMode || revealed.has(idx);
          const number = idx + 1;

          if (hideMode) {
            return (
              <button
                key={idx}
                type="button"
                className={`cb-card-essay-block cb-press is-maskable ${isRevealed ? 'is-revealed' : 'is-masked'}`.trim()}
                aria-expanded={isRevealed}
                onClick={() => toggleFaceReveal(idx)}
              >
                <div className="cb-card-essay-block-head">
                  <span className="cb-card-essay-num">{number}</span>
                  <strong className="cb-card-essay-heading">{face.heading}</strong>
                  <span className="cb-sub">{isRevealed ? '遮起來' : '點我翻開'}</span>
                </div>
                {isRevealed && (
                  <ul className="cb-card-face-lines cb-card-essay-lines">
                    {face.lines.map((line, lineIdx) => (
                      <li key={lineIdx}>{line}</li>
                    ))}
                  </ul>
                )}
              </button>
            );
          }

          return (
            <div key={idx} className="cb-card-essay-block">
              <div className="cb-card-essay-block-head">
                <span className="cb-card-essay-num">{number}</span>
                <strong className="cb-card-essay-heading">{face.heading}</strong>
              </div>
              <ul className="cb-card-face-lines cb-card-essay-lines">
                {face.lines.map((line, lineIdx) => (
                  <li key={lineIdx}>{line}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="cb-card-finish-wrap">
        <Button variant="primary" onClick={onComplete} disabled={completing}>
          背好了
        </Button>
        {burstTick !== null && <Burst key={burstTick} onDone={onBurstDone} />}
      </div>
    </div>
  );
}
