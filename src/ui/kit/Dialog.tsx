import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** 自製置中確認對話框：支援 Esc 與點擊遮罩關閉，遵循日夜主題與安全區域。 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
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

  if (!open) {
    return null;
  }

  // 掛到 document.body，理由同 Sheet。
  return createPortal(
    <div className="cb-dialog-root">
      <div className="cb-veil cb-dialog-veil" onClick={onClose} />
      <section
        className="cb-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="cb-dialog-title">{title}</h2>
        <div className="cb-dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
