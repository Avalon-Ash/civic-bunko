import { useId, useState, type HTMLAttributes, type ReactNode } from 'react';

export interface CollapseProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** 標題列的字 */
  title: ReactNode;
  /** 收起時標題列右邊的一行摘要（例如目前的選擇、同步狀態） */
  summary?: ReactNode;
  /** 受控：由外面決定開關（例如被引導來時自動展開）；不給就自己記 */
  open?: boolean;
  /** 不受控時一開始開不開；預設收起 */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/**
 * 原地收合的一塊：標題列是一顆按鈕（aria-expanded），內容收起時用 hidden 拿掉。
 * 開關只在元件狀態裡，換頁就回到預設（不進存檔；docs/plans/ux-cleanup.md §1.3）。
 */
export function Collapse({
  title,
  summary,
  open,
  defaultOpen = false,
  onOpenChange,
  className = '',
  children,
  ...rest
}: CollapseProps) {
  const bodyId = useId();
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = open ?? innerOpen;
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  return (
    <section className={`cb-collapse ${isOpen ? 'is-open' : ''} ${className}`.trim()} {...rest}>
      <button
        type="button"
        className="cb-collapse-head"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span className="cb-collapse-title">{title}</span>
        {summary && !isOpen ? <span className="cb-collapse-summary">{summary}</span> : null}
        <svg className="cb-collapse-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id={bodyId} className="cb-collapse-body" hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
