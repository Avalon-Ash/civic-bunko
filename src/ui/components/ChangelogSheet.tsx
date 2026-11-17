import type { ChangelogEntry } from '../../core/types';
import { Button } from '../kit/Button';
import { Sheet } from '../kit/Sheet';

export interface ChangelogSheetProps {
  open: boolean;
  /** 要列出的紀錄（新到舊） */
  entries: readonly ChangelogEntry[];
  title: string;
  onClose: () => void;
}

/** 更新紀錄抽屜：更新後自動跳出「更新了什麼」，也能從今日頁打開看全部。 */
export function ChangelogSheet({ open, entries, title, onClose }: ChangelogSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="cb-changelog">
        <h2 className="cb-m0">{title}</h2>
        {entries.map((entry) => (
          <section key={entry.id} className="cb-changelog-entry">
            <h3 className="cb-changelog-title">
              {entry.title}
              <span className="cb-sub">{entry.date.replaceAll('-', '/')}</span>
            </h3>
            <ul className="cb-changelog-list">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <Button onClick={onClose}>知道了</Button>
      </div>
    </Sheet>
  );
}
