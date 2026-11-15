import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export type CardTone =
  | 'surface'
  | 'pink'
  | 'mint'
  | 'butter'
  | 'green'
  | 'red'
  | 'blue'
  | 'orange';

interface BaseCardProps {
  tone?: CardTone;
  pressable?: boolean;
  className?: string;
  children: ReactNode;
}

type DivCardProps = BaseCardProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof BaseCardProps> & {
    onClick?: undefined;
  };

type ButtonCardProps = BaseCardProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseCardProps> & {
    onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  };

export type CardProps = DivCardProps | ButtonCardProps;

/** 貼紙風格卡片容器；傳入 onClick 時自動以可按下的原生 button 呈現。 */
export function Card(props: CardProps) {
  const { tone = 'surface', pressable, className = '', children, ...rest } = props;
  const isButton = typeof props.onClick === 'function';
  const classes = [
    'cb-card',
    tone !== 'surface' ? `cb-tone-${tone}` : '',
    pressable || isButton ? 'cb-press' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (isButton) {
    const buttonRest = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseCardProps>;
    return (
      <button type="button" className={`${classes} cb-card-btn`} {...buttonRest}>
        {children}
      </button>
    );
  }

  const divRest = rest as Omit<HTMLAttributes<HTMLDivElement>, keyof BaseCardProps>;
  return (
    <div className={classes} {...divRest}>
      {children}
    </div>
  );
}
