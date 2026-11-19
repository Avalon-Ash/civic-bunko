import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dispatch } from '../../core/commands';
import { PET_SCORCH } from '../../core/constants/pet';
import { SCORCH } from '../../core/constants/wardrobe';
import type { ScorchPlace } from '../../core/types';
import type { World } from '../../core/world';
import { fishBalance, parseScorchSpot, scorchedSpots } from '../../selectors/wardrobe';
import { useWorld } from '../useWorld';

/** 卡片上的標記：值＝這張卡片的 ID（存檔裡 wardrobe.scorch 記的是「卡片 ID@位置」，卡片 ID 定了不改） */
export const CAT_BURN_ATTR = 'data-cat-burn';

const MARK = PET_SCORCH.mark;
/** 沒有捲動時多久重新對一次焦痕的位置（毫秒） */
const SCORCH_RECHECK_MS = 800;

/** 焦痕的左緣離卡片左緣多遠：左、中、右三個位置 */
export function scorchOffset(width: number, place: ScorchPlace): number {
  if (place === 'l') return MARK.inset;
  if (place === 'm') return (width - MARK.w) / 2;
  return width - MARK.w - MARK.inset;
}

/** 焦痕要畫在哪（畫面座標）；卡片不在畫面上、或被底部的分頁列蓋住時回 null */
export function scorchPlace(el: Element, place: ScorchPlace): { x: number; y: number } | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0) return null;
  const y = r.top - MARK.rise;
  const tabs = document.querySelector('.cb-tabs')?.getBoundingClientRect();
  if (tabs && tabs.top > window.innerHeight / 2 && y + MARK.h > tabs.top) return null;
  return { x: r.left + scorchOffset(r.width, place), y };
}

/**
 * 燒焦的痕跡：小怪獸全套加噴火的小貓會把卡片上緣的左、中、右燒焦（只是外觀，不擋卡片本身）。
 * 點焦痕會出現「修好」的按鈕，花 SCORCH.repairFish 條小魚乾修好；不修也沒有任何影響。
 * 畫在最上層、跟著卡片的位置走（卡片有的是整張可以按的按鈕，裡面不能再放按鈕）。
 */
export function ScorchLayer({ world }: { world: World }) {
  useWorld(world);
  const spots = scorchedSpots(world);
  const key = spots.join('|');
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [open, setOpen] = useState<string | null>(null);

  /** 把每個焦痕放到它那張卡片的右上角（卡片不在這一頁就藏起來） */
  const place = () => {
    for (const [id, node] of nodes.current) {
      const { card, place: where } = parseScorchSpot(id);
      const el = document.querySelector(`[${CAT_BURN_ATTR}="${card}"]`);
      const at = el ? scorchPlace(el, where) : null;
      node.style.display = at ? '' : 'none';
      if (at) node.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
    }
  };

  // 每次畫面重畫（換分頁、狀態變了）都重放一次
  useLayoutEffect(place);

  // 捲動、視窗大小變了就重放；版面自己變動（內容載入、卡片收合）沒有事件，所以另外每隔一小段時間對一次
  useEffect(() => {
    if (key === '') return undefined;
    document.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    const timer = window.setInterval(place, SCORCH_RECHECK_MS);
    return () => {
      document.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.clearInterval(timer);
    };
    // place 只讀 ref 和 DOM，不必當依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (spots.length === 0) return null;
  const afford = fishBalance(world).raw >= SCORCH.repairFish;

  return (
    <div className="cb-scorch-layer">
      {spots.map((id) => (
        <div
          key={id}
          className="cb-scorch"
          style={{ display: 'none' }}
          ref={(node) => {
            if (node) nodes.current.set(id, node);
            else nodes.current.delete(id);
          }}
        >
          <button
            type="button"
            className="cb-scorch-mark"
            aria-label="這裡被小貓燒焦了，點一下看怎麼修"
            aria-expanded={open === id}
            onClick={() => setOpen(open === id ? null : id)}
          >
            <svg width={MARK.w} height={MARK.h} viewBox="0 0 58 40" aria-hidden="true">
              <path
                d="M6 24 Q2 15 11 12 Q13 4 23 8 Q30 1 38 8 Q49 5 50 15 Q58 20 51 28 Q52 37 41 35 Q33 41 25 35 Q13 39 12 30 Q5 30 6 24 Z"
                fill="var(--acc-shade)"
                fillOpacity="0.82"
                stroke="var(--ink-soft)"
                strokeOpacity="0.5"
                strokeWidth="1.4"
                strokeDasharray="3 4"
              />
              <path
                d="M16 23 Q14 17 21 16 Q25 11 31 15 Q39 13 40 20 Q45 24 39 28 Q33 32 26 29 Q18 31 16 23 Z"
                fill="var(--acc-shade)"
              />
              <circle cx="22" cy="22" r="1.6" fill="var(--acc-coral)" />
              <circle cx="33" cy="25" r="1.2" fill="var(--acc-gold)" />
              <circle cx="29" cy="19" r="0.9" fill="var(--acc-coral)" />
              <g className="cb-scorch-smoke" fill="none" stroke="var(--ink-soft)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M20 9 Q17 6 20 3" />
                <path d="M34 8 Q37 5 34 1.5" />
              </g>
            </svg>
          </button>
          {open === id ? (
            <button
              type="button"
              className="cb-scorch-fix"
              disabled={!afford}
              onClick={() => {
                dispatch(world, { type: 'repairScorch', spot: id });
                setOpen(null);
              }}
            >
              {afford ? `修好（${SCORCH.repairFish} 條小魚乾）` : '小魚乾不夠修'}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
