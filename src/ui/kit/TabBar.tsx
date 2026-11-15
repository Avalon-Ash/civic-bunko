export type TabId = 'today' | 'cards' | 'quiz' | 'stamps';

interface TabDef {
  id: TabId;
  label: string;
  icon: 'today' | 'cards' | 'quiz' | 'stamps';
}

const TABS: readonly TabDef[] = [
  { id: 'today', label: '今日', icon: 'today' },
  { id: 'cards', label: '圖卡', icon: 'cards' },
  { id: 'quiz', label: '刷題', icon: 'quiz' },
  { id: 'stamps', label: '集章', icon: 'stamps' },
];

export interface TabBarProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
}

function TabIcon({ name }: { name: TabDef['icon'] }) {
  switch (name) {
    case 'today':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'cards':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="6" width="13" height="14" rx="3" />
          <path d="M8 3h9a3 3 0 0 1 3 3v10" />
        </svg>
      );
    case 'quiz':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20l1-5L16 5l4 4L10 19z" />
        </svg>
      );
    case 'stamps':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      );
  }
}

/** 自適應導覽列：窄螢幕位於底部，寬螢幕（≥700px）轉為左側直欄。 */
export function TabBar({ active, onSelect }: TabBarProps) {
  return (
    <nav className="cb-tabs" aria-label="主要分頁">
      {TABS.map((tab) => {
        const isCurrent = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            className="cb-tab-btn"
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            <TabIcon name={tab.icon} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
