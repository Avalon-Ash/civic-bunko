export interface PawPickerProps {
  presets: readonly number[];
  value: number;
  onChange: (next: number) => void;
}

/** 貓掌題數快選列，窄螢幕可自動換行。 */
export function PawPicker({ presets, value, onChange }: PawPickerProps) {
  return (
    <div className="cb-paws" role="group" aria-label="快速選擇題數">
      {presets.map((count) => {
        const selected = value === count;
        return (
          <button
            key={count}
            type="button"
            className="cb-paw cb-press"
            aria-pressed={selected}
            onClick={() => onChange(count)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <ellipse cx="12" cy="16" rx="6" ry="4.6" />
              <circle cx="5.5" cy="10" r="2.4" />
              <circle cx="12" cy="7" r="2.6" />
              <circle cx="18.5" cy="10" r="2.4" />
            </svg>
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
