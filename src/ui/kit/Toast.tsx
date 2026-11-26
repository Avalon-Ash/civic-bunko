import { useEffect } from 'react';

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  /** 給了就整條提示可以點（例如點了去換裝）；點了也會收起來 */
  onClick?: () => void;
}

/** 頁面頂端滑入的輕量提示橫幅（連對里程碑或系統通知）。 */
export function Toast({ message, onDismiss, durationMs = 2400, onClick }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  return (
    <div className={`cb-toast-wrap ${message ? 'is-visible' : ''}`} aria-live="polite">
      {message &&
        (onClick ? (
          <button
            type="button"
            className="cb-toast cb-toast-btn"
            onClick={() => {
              onClick();
              onDismiss();
            }}
          >
            {message}
          </button>
        ) : (
          <div className="cb-toast" role="status">
            {message}
          </div>
        ))}
    </div>
  );
}
