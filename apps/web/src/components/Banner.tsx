import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'warning' | 'error' | 'success';
const ICONS: Record<Tone, IconName> = { info: 'info', warning: 'alert', error: 'alert', success: 'check' };

export function Banner({
  tone,
  title,
  children,
  icon,
  className,
}: {
  tone: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={`banner ${tone} ${className ?? ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon ?? ICONS[tone]} />
      <div className="stack-sm" style={{ gap: 4, flex: 1, minWidth: 0 }}>
        {title ? <p className="title">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
