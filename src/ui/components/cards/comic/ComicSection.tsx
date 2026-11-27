// 卡片抽屜最上面的漫畫＋「遮起來想」（docs/plans/comic-cards.md §3-2、§3-3）。
// 遮字的開關與揭曉了哪幾格只在元件狀態裡，不存檔（§2.5、§10-5）。
import { useEffect, useState } from 'react';
import type { CardComic, StudyCard } from '../../../../core/types';
import { ComicCastList } from '../../../kit/comic/ComicCastList';
import { ComicStrip } from '../../../kit/comic/ComicStrip';
import { Switch } from '../../../kit/Switch';

export interface ComicSectionProps {
  card: Pick<StudyCard, 'id' | 'hook' | 'faces'> & { comic: CardComic };
}

export function ComicSection({ card }: ComicSectionProps) {
  const [hidden, setHidden] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setHidden(false);
    setRevealed(new Set());
  }, [card.id]);

  const toggleHidden = (next: boolean) => {
    setHidden(next);
    setRevealed(new Set());
  };

  const reveal = (index: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section className="cb-comic-section" aria-label="四格漫畫">
      <div className="cb-comic-tools">
        <span className="cb-sub">
          {hidden ? `看圖想想看，點一下揭曉（${revealed.size}/${card.comic.panels.length}）` : '先看圖，再往下看完整重點'}
        </span>
        <label className="cb-row cb-comic-hide">
          <span className="cb-sub-strong">遮起來想</span>
          <Switch checked={hidden} onChange={toggleHidden} ariaLabel="遮起來想" />
        </label>
      </div>
      <ComicCastList comic={card.comic} />
      <ComicStrip card={card} hidden={hidden} revealed={revealed} onReveal={reveal} />
    </section>
  );
}
