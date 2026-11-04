import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { SyncChip } from './SyncChip';
import { RoleBadge } from './RoleBadge';

export interface AppBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: { icon: IconName; label: string; onClick: () => void };
  actions?: ReactNode;
  showRole?: boolean;
  showSync?: boolean;
}

export function AppBar({
  title,
  subtitle,
  leading,
  actions,
  showRole = false,
  showSync = true,
}: AppBarProps) {
  return (
    <header className="appbar">
      {leading ? (
        <button type="button" className="icon-btn" aria-label={leading.label} onClick={leading.onClick}>
          <Icon name={leading.icon} />
        </button>
      ) : null}
      <h1>
        {title}
        {subtitle ? <span className="sub">{subtitle}</span> : null}
      </h1>
      {actions}
      {showRole ? <RoleBadge /> : null}
      {showSync ? <SyncChip /> : null}
    </header>
  );
}
