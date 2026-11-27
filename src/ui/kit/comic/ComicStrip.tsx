// 四格漫畫：五種版型共用一個元件，差別只在格子怎麼排（樣式 styles/comic.css）。ADR 0020。
// 格子裡的字一律經 comicPanelText 從卡片原文解析；解析不到的格子不畫字。
import type { CSSProperties } from 'react';
import { COMIC_CASTS, COMIC_PROPS, COMIC_STORY_BEATS } from '../../../core/constants/comic';
import type { CardComic, ComicPanel, StudyCard } from '../../../core/types';
import { comicPanelText, resolveComicText } from '../../../systems/comic';
import { CatBody } from '../CatBody';
import { ComicProp } from './props';
import { COMIC_SCENE_LAYOUT, type ComicSlot } from './scenes';

type ComicCard = Pick<StudyCard, 'hook' | 'faces'> & { comic: CardComic };

/** 演員、道具放到格子裡的位置（百分比） */
function slotStyle(slot: ComicSlot): CSSProperties {
  return { left: `${slot.x}%`, bottom: `${100 - slot.y}%`, width: `${slot.w}%` };
}

/** 一格的畫面（不含字）：演員、道具、舉牌。列表小圖也用它（小圖不掛名牌：72px 放不下字） */
export function ComicPanelArt({
  panel,
  sign,
  hideSign = false,
  nameTags = false,
}: {
  panel: ComicPanel;
  sign?: string | null;
  hideSign?: boolean;
  /** 貓腳下立角色名牌（同一格同一個角色只掛第一隻） */
  nameTags?: boolean;
}) {
  const layout = COMIC_SCENE_LAYOUT[panel.scene];
  const tagged = nameTags ? panel.actors.map((actor, i) => panel.actors.findIndex((a) => a.cast === actor.cast) === i) : [];
  return (
    <div className="cb-comic-art">
      {panel.props.map((id, i) => {
        const slot = layout.props[i];
        return slot ? (
          <span key={`p${i}`} className="cb-comic-prop" style={slotStyle(slot)}>
            <ComicProp id={id} title={COMIC_PROPS[id]} />
          </span>
        ) : null;
      })}
      {panel.actors.map((actor, i) => {
        const slot = layout.actors[i];
        return slot ? (
          <span key={`a${i}`} className="cb-comic-actor" style={slotStyle(slot)}>
            <CatBody
              pose={actor.pose}
              outfit={COMIC_CASTS[actor.cast].outfit}
              mood={actor.mood}
              facing={actor.facing}
              quiet
            />
            {tagged[i] ? <span className="cb-comic-tag">{COMIC_CASTS[actor.cast].tag}</span> : null}
          </span>
        ) : null;
      })}
      {sign ? (
        <span className={`cb-comic-sign ${hideSign ? 'is-hidden' : ''}`.trim()}>{hideSign ? '？' : sign}</span>
      ) : null}
    </div>
  );
}

export interface ComicStripProps {
  card: ComicCard;
  /** 遮起來想：字與舉牌蓋住，點格子揭曉 */
  hidden?: boolean;
  revealed?: ReadonlySet<number>;
  onReveal?: (index: number) => void;
}

/** 版型裡第 i 格放在哪一格（versus：前一半在左欄、後一半在右欄，同一列互為對照） */
function panelPlace(comic: CardComic, i: number): CSSProperties | undefined {
  if (comic.layout !== 'versus') return undefined;
  const half = Math.ceil(comic.panels.length / 2);
  const left = i < half;
  return { gridColumn: left ? 1 : 2, gridRow: (left ? i : i - half) + 2 };
}

/**
 * 排排站一列放幾格：剛好 2 或 4 格排成兩欄（2×2 不落單）；其他格數一格一列（圖左字右）。
 * 手機上三欄每格只剩約 110px，貓太小、舉牌被截斷（2026-11-27 在 390 寬抽屜量過）。
 */
function lineupColumns(count: number): number {
  return count === 2 || count === 4 ? 2 : 1;
}

export function ComicStrip({ card, hidden = false, revealed, onReveal }: ComicStripProps) {
  const { comic } = card;
  const columns = comic.columns?.map((ref) => resolveComicText(card, ref));
  const cols = comic.layout === 'lineup' ? lineupColumns(comic.panels.length) : null;
  const gridStyle = cols ? ({ '--cb-comic-cols': cols } as CSSProperties) : undefined;
  return (
    <div className={`cb-comic cb-comic-${comic.layout} ${cols === 1 ? 'cb-comic-rows' : ''}`.trim()} style={gridStyle}>
      {columns
        ? columns.map((title, i) => (
            <div key={`c${i}`} className="cb-comic-column" style={{ gridColumn: i + 1, gridRow: 1 }}>
              {title}
            </div>
          ))
        : null}
      {comic.panels.map((panel, i) => {
        const view = comicPanelText(card, panel);
        const covered = hidden && !revealed?.has(i);
        const beat = comic.layout === 'story' ? COMIC_STORY_BEATS[i] : comic.layout === 'timeline' ? String(i + 1) : null;
        const body = (
          <>
            {view?.label ? <span className="cb-comic-label">{view.label}</span> : null}
            <ComicPanelArt panel={panel} sign={view?.sign} hideSign={covered} nameTags />
            <span className="cb-comic-caption">
              {beat ? <b className="cb-comic-beat">{beat}</b> : null}
              <span className={`cb-comic-text ${covered ? 'is-hidden' : ''}`.trim()}>
                {covered ? '點一下看答案' : (view?.text ?? '')}
              </span>
            </span>
          </>
        );
        const style = { ...panelPlace(comic, i), '--cb-comic-i': i } as CSSProperties;
        return hidden ? (
          <button
            key={i}
            type="button"
            className="cb-comic-panel cb-comic-panel-btn"
            style={style}
            aria-pressed={!covered}
            onClick={() => onReveal?.(i)}
          >
            {body}
          </button>
        ) : (
          <figure key={i} className="cb-comic-panel" style={style}>
            {body}
          </figure>
        );
      })}
    </div>
  );
}

/** 圖卡列表的小圖：第一格的畫面，不含字（給 UX3 用） */
export function ComicThumb({ comic }: { comic: CardComic }) {
  const first = comic.panels[0];
  if (!first) return null;
  return (
    <span className="cb-comic-thumb" aria-hidden="true">
      <ComicPanelArt panel={first} hideSign />
    </span>
  );
}
