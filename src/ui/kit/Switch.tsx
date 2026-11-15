export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  className?: string;
}

/** 膠囊撥動開關，提供至少 --tap-min 的可觸控區域。 */
export function Switch({ checked, onChange, ariaLabel, className = '' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`cb-switch-hit ${className}`.trim()}
      onClick={() => onChange(!checked)}
    >
      <span className={`cb-switch ${checked ? 'is-checked' : ''}`} aria-hidden="true">
        <span className="cb-switch-thumb" />
      </span>
    </button>
  );
}
