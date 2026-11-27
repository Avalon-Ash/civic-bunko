// 連連看（docs/plans/level-mode.md §2、ADR 0023）：左邊漫畫格（字與舉牌遮住、標籤留著），右邊打亂的說明。
// 點左再點右（或反過來）；對了兩邊變綠鎖住，錯了兩邊抖一下、不扣分。全對才回報 onComplete。
// 點錯幾次、花多久都不存；全對只記「這張卡配對過」（由呼叫的一方 dispatch）。
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardComic, StudyCard } from '../../../../core/types';
import type { World } from '../../../../core/world';
import { comicMatchSet, isComicMatch } from '../../../../selectors/cardLevel';
import { soundOn } from '../../../../selectors/sound';
import { comicPanelText } from '../../../../systems/comic';
import { Button } from '../../../kit/Button';
import { ComicPanelArt } from '../../../kit/comic/ComicStrip';
import { playSound } from '../../../sound';

/** 配錯時兩邊抖動的時間（ms）；要和 comic.css 的 cb-match-shake 一樣長 */
const WRONG_SHAKE_MS = 420;

export interface ComicMatchProps {
  world: World;
  card: Pick<StudyCard, 'id' | 'hook' | 'faces'> & { comic: CardComic };
  /** 全部配對完成（每玩完一次都會叫） */
  onComplete: () => void;
}

export function ComicMatch({ world, card, onComplete }: ComicMatchProps) {
  const [round, setRound] = useState(0);
  // 每一輪重新洗一次右邊（亂數只在這裡；判對錯不看順序）。只看卡片 ID 與輪次：
  // 呼叫的一方每次重畫都會傳新的 card 物件，跟著它重洗會讓右邊在她手指下換位置
  const set = useMemo(() => comicMatchSet(card, Math.random), [card.id, round]);
  const [pickedLeft, setPickedLeft] = useState<number | null>(null);
  const [pickedRight, setPickedRight] = useState<string | null>(null);
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  const [wrong, setWrong] = useState<{ left: number; right: string } | null>(null);
  const wrongTimer = useRef<number | null>(null);

  useEffect(() => {
    setPickedLeft(null);
    setPickedRight(null);
    setDone(new Set());
    setWrong(null);
  }, [card.id, round]);

  useEffect(
    () => () => {
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    },
    [],
  );

  if (!set) return null;

  const textOf = (panel: number) => {
    const p = card.comic.panels[panel];
    return p ? (comicPanelText(card, p)?.text ?? '') : '';
  };
  /** 這句說明的每一格都配好了，才鎖住（兩格字相同時要兩格都配完） */
  const rightDone = (text: string) => set.left.every((i) => textOf(i) !== text || done.has(i));
  const finished = done.size === set.left.length;

  const sound = (name: 'tap' | 'correct' | 'wrong' | 'reward') => {
    if (soundOn(world)) playSound(name, true);
  };

  const tryPair = (left: number, right: string) => {
    if (isComicMatch(card, left, right)) {
      const next = new Set(done);
      next.add(left);
      setDone(next);
      setPickedLeft(null);
      setPickedRight(null);
      if (next.size === set.left.length) {
        sound('reward');
        onComplete();
      } else {
        sound('correct');
      }
      return;
    }
    sound('wrong');
    setWrong({ left, right });
    setPickedLeft(null);
    setPickedRight(null);
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => setWrong(null), WRONG_SHAKE_MS);
  };

  const pickLeft = (i: number) => {
    if (done.has(i)) return;
    if (pickedRight !== null) tryPair(i, pickedRight);
    else {
      sound('tap');
      setPickedLeft(pickedLeft === i ? null : i);
    }
  };

  const pickRight = (text: string) => {
    if (rightDone(text)) return;
    if (pickedLeft !== null) tryPair(pickedLeft, text);
    else {
      sound('tap');
      setPickedRight(pickedRight === text ? null : text);
    }
  };

  const status = finished
    ? '全部配對完成！'
    : wrong
      ? '差一點！再看看圖上的小貓和道具'
      : pickedLeft !== null || pickedRight !== null
        ? '再點另一邊配成一對'
        : '先點一格圖，再點它說的那一句';

  const rows = Math.max(set.left.length, set.right.length);

  return (
    <section className="cb-match" aria-label="連連看">
      <div className="cb-match-head">
        <span className={`cb-sub ${wrong ? 'cb-match-hint-wrong' : ''}`.trim()} role="status">
          {status}
        </span>
        <span className="cb-match-count">
          {done.size}/{set.left.length}
        </span>
      </div>
      <div className="cb-match-grid" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {set.left.map((i) => {
          const panel = card.comic.panels[i]!;
          const label = comicPanelText(card, panel)?.label;
          const state = done.has(i) ? 'is-done' : wrong?.left === i ? 'is-wrong' : pickedLeft === i ? 'is-picked' : '';
          return (
            <button
              key={`l${i}`}
              type="button"
              className={`cb-match-item cb-match-art ${state}`.trim()}
              style={{ gridColumn: 1 }}
              aria-pressed={pickedLeft === i}
              disabled={done.has(i)}
              aria-label={`第 ${i + 1} 格${label ? `：${label}` : ''}`}
              onClick={() => pickLeft(i)}
            >
              {label ? <span className="cb-comic-label">{label}</span> : null}
              <ComicPanelArt panel={panel} sign={comicPanelText(card, panel)?.sign} hideSign={!done.has(i)} nameTags />
            </button>
          );
        })}
        {set.right.map((text) => {
          const locked = rightDone(text);
          const state = locked ? 'is-done' : wrong?.right === text ? 'is-wrong' : pickedRight === text ? 'is-picked' : '';
          return (
            <button
              key={`r${text}`}
              type="button"
              className={`cb-match-item cb-match-text ${state}`.trim()}
              style={{ gridColumn: 2 }}
              aria-pressed={pickedRight === text}
              disabled={locked}
              onClick={() => pickRight(text)}
            >
              {text}
            </button>
          );
        })}
      </div>
      {finished ? (
        <Button variant="ghost" className="cb-match-again" onClick={() => setRound((r) => r + 1)}>
          再玩一次
        </Button>
      ) : null}
    </section>
  );
}
