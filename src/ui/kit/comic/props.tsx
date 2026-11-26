// 四格漫畫的道具圖（ADR 0020）。一個道具一筆：viewBox 64×64、底邊貼著 y=60（站在地上）。
// 畫法比照衣櫥配件（kit/wardrobe/art.tsx）：線條 var(--cat-line)、填色只用 theme.css 的 --acc-* 與 --surface 等 token，日夜兩套自動切換。
// 名稱在 constants/comic.ts 的 COMIC_PROPS；這裡的 Record 讓每個道具一定有圖（tsc 守門）。
import type { ReactNode } from 'react';
import type { ComicPropId } from '../../../core/types';

const LINE = 'var(--cat-line)';
const stroke = { stroke: LINE, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** 暫時的圖：圓角方塊。agy 出圖後換掉（docs/dispatch/CC1-art-props.md） */
function draft(fill: string): ReactNode {
  return <rect x="10" y="14" width="44" height="46" rx="8" fill={fill} {...stroke} />;
}

export const PROP_ART: Readonly<Record<ComicPropId, ReactNode>> = {
  stamp: draft('var(--acc-coral)'),
  document: draft('var(--acc-cream)'),
  ticket: draft('var(--acc-rose)'),
  envelope: draft('var(--acc-sky)'),
  hourglass: draft('var(--acc-gold)'),
  calendar: draft('var(--acc-cream)'),
  courthouse: draft('var(--acc-silver)'),
  office: draft('var(--acc-silver)'),
  pothole: draft('var(--acc-wood)'),
  lamp: draft('var(--acc-gold)'),
  target: draft('var(--acc-coral)'),
  door: draft('var(--acc-wood)'),
};

export function ComicProp({ id, title }: { id: ComicPropId; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className="cb-comic-prop-svg" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {PROP_ART[id]}
    </svg>
  );
}
