import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export type ChipTone = 'butter' | 'plain' | 'orange' | 'mint' | 'pink' | 'blue' | 'green' | 'red';

interface BaseChipProps {
  tone?: ChipTone;
  active?: boolean;
  className?: string;
  children: ReactNode;
}

type SpanChipProps = BaseChipProps &
  Omit<HTMLAttributes<HTMLSpanElement>, keyof BaseChipProps> & {
    onClick?: undefined;
  };

type ButtonChipProps = BaseChipProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseChipProps> & {
    onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  };

export type ChipProps = SpanChipProps | ButtonChipProps;

/** 標籤與可點選小膠囊；可點擊時確保達到最小觸控高度。 */
export function Chip(props: ChipProps) {
  const { tone = 'butter', active, className = '', children, ...rest } = props;
  const isButton = typeof props.onClick === 'function';
  const classes = [
    'cb-chip',
    `cb-chip-${tone}`,
    isButton ? 'cb-chip-btn cb-press' : '',
    active ? 'is-active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (isButton) {
    const buttonRest = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseChipProps>;
    return (
      <button
        type="button"
        className={classes}
        aria-pressed={active}
        {...buttonRest}
      >
        {children}
      </button>
    );
  }

  const spanRest = rest as Omit<HTMLAttributes<HTMLSpanElement>, keyof BaseChipProps>;
  return (
    <span className={classes} {...spanRest}>
      {children}
    </span>
  );
}
