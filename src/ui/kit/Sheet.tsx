import { useEffect, useRef, type ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** 底部抽屜：彈簧滑入、點遮罩或下拉把手即可關閉。 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartY.current = touch.clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const touch = e.changedTouches[0];
    if (!touch || touchStartY.current === null) return;
    const dy = touch.clientY - touchStartY.current;
    touchStartY.current = null;
    const scrollTop = sheetRef.current?.scrollTop ?? 0;
    if (dy > 60 && scrollTop <= 0) {
      onClose();
    }
  };

  return (
    <div className={`cb-sheet-root ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="cb-veil" onClick={onClose} />
      <section
        ref={sheetRef}
        className="cb-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="cb-sheet-head">
          <button
            type="button"
            className="cb-grab-hit"
            onClick={onClose}
            aria-label={`關閉${title}`}
          >
            <span className="cb-grab" aria-hidden="true" />
          </button>
        </div>
        <div className="cb-sheet-body">{children}</div>
      </section>
    </div>
  );
}
