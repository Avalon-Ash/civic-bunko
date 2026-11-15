import { useEffect, useRef, useState } from 'react';

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  subtitle?: string;
  onChange: (next: number) => void;
}

/** 題數步進器：左右圓鈕加減，中間大數字隨增減方向上下滾動換字。 */
export function Stepper({
  value,
  min,
  max,
  step,
  unit = '題',
  subtitle,
  onChange,
}: StepperProps) {
  const prevRef = useRef(value);
  const [dir, setDir] = useState<'up' | 'down' | 'none'>('none');

  useEffect(() => {
    if (value > prevRef.current) {
      setDir('up');
    } else if (value < prevRef.current) {
      setDir('down');
    }
    prevRef.current = value;
  }, [value]);

  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <div className="cb-stepper">
      <button
        type="button"
        className="cb-round-btn cb-press"
        onClick={dec}
        disabled={value <= min}
        aria-label={`減少 ${step} ${unit}`}
      >
        −
      </button>
      <div className="cb-stepper-center">
        <div className="cb-stepper-val-wrap">
          <span
            key={value}
            className={`cb-stepper-val ${dir === 'up' ? 'roll-up' : dir === 'down' ? 'roll-down' : ''}`}
          >
            {value}
          </span>
          <span className="cb-stepper-unit">{unit}</span>
        </div>
        {subtitle && <div className="cb-sub">{subtitle}</div>}
      </div>
      <button
        type="button"
        className="cb-round-btn cb-press"
        onClick={inc}
        disabled={value >= max}
        aria-label={`增加 ${step} ${unit}`}
      >
        ＋
      </button>
    </div>
  );
}
