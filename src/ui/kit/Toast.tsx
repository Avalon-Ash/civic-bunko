import { useEffect } from 'react';

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

/** 頁面頂端滑入的輕量提示橫幅（連對里程碑或系統通知）。 */
export function Toast({ message, onDismiss, durationMs = 2400 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  return (
    <div className={`cb-toast-wrap ${message ? 'is-visible' : ''}`} aria-live="polite">
      {message && (
        <div className="cb-toast" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
