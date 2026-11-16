import { useEffect, useRef, useState } from 'react';
import type { CardFace } from '../../../core/types';
import { Burst } from '../../kit/Burst';
import { Button } from '../../kit/Button';

export interface CardFaceViewerProps {
  cardId: string;
  faces: readonly CardFace[];
  onComplete: () => void;
  completing: boolean;
  burstTick: number | null;
  onBurstDone: () => void;
}

const SWIPE_THRESHOLD_PX = 48;

/** 觀念卡／新法卡的單面翻頁檢視器：支援左右滑動、圓點切換與看完貓掌特效。 */
export function CardFaceViewer({
  cardId,
  faces,
  onComplete,
  completing,
  burstTick,
  onBurstDone,
}: CardFaceViewerProps) {
  const [faceIndex, setFaceIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<'next' | 'prev' | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setFaceIndex(0);
    setSlideDir(null);
    touchStartRef.current = null;
  }, [cardId]);

  const totalFaces = faces.length;
  const safeIndex = totalFaces > 0 ? Math.min(faceIndex, totalFaces - 1) : 0;
  const currentFace = faces[safeIndex];
  const isLastFace = totalFaces === 0 || safeIndex >= totalFaces - 1;

  const goToFace = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= totalFaces || nextIndex === safeIndex) {
      return;
    }
    setSlideDir(nextIndex > safeIndex ? 'next' : 'prev');
    setFaceIndex(nextIndex);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      // 水平換面時阻止事件冒泡，避免 Sheet 將微幅垂直偏移誤判為下拉關閉。
      e.stopPropagation();
      if (dx < 0 && safeIndex < totalFaces - 1) {
        goToFace(safeIndex + 1);
      } else if (dx > 0 && safeIndex > 0) {
        goToFace(safeIndex - 1);
      }
    }
  };

  const slideClass =
    slideDir === 'next' ? 'is-slide-next' : slideDir === 'prev' ? 'is-slide-prev' : '';

  return (
    <div className="cb-card-face-viewer">
      {currentFace && (
        <div
          className="cb-card-face-stage"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <article key={`${cardId}-${safeIndex}`} className={`cb-card-face ${slideClass}`.trim()}>
            <div className="cb-card-face-head">
              <h3 className="cb-card-face-heading">{currentFace.heading}</h3>
              <span className="cb-card-face-count cb-num-tabular">
                {safeIndex + 1} / {totalFaces}
              </span>
            </div>
            <ul className="cb-card-face-lines">
              {currentFace.lines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </article>
        </div>
      )}

      {totalFaces > 1 && (
        <div className="cb-card-dots" role="group" aria-label="切換圖卡頁面">
          {faces.map((face, idx) => (
            <button
              key={idx}
              type="button"
              className={`cb-card-dot-hit ${idx === safeIndex ? 'is-active' : ''}`.trim()}
              aria-label={`第 ${idx + 1} 面：${face.heading}`}
              aria-pressed={idx === safeIndex}
              onClick={() => goToFace(idx)}
            >
              <span className="cb-card-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <div className="cb-acts">
        {safeIndex > 0 && (
          <Button
            variant="ghost"
            onClick={() => goToFace(safeIndex - 1)}
            disabled={completing}
          >
            上一面
          </Button>
        )}
        {isLastFace ? (
          <div className="cb-card-finish-wrap cb-grow">
            <Button variant="primary" onClick={onComplete} disabled={completing}>
              看完了
            </Button>
            {burstTick !== null && <Burst key={burstTick} onDone={onBurstDone} />}
          </div>
        ) : (
          <Button variant="butter" onClick={() => goToFace(safeIndex + 1)}>
            下一面
          </Button>
        )}
      </div>
    </div>
  );
}
