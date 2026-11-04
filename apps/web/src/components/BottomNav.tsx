import { useSyncExternalStore } from 'react';
import { session } from '../lib/session';
import { Icon, type IconName } from './Icon';
import { t, type MessageKey } from '../i18n';

const ITEMS: { path: string; label: MessageKey; icon: IconName }[] = [
  { path: '/', label: 'nav.home', icon: 'home' },
  { path: '/history', label: 'nav.history', icon: 'list' },
  { path: '/settings', label: 'nav.settings', icon: 'settings' },
];

/** Home, History, Settings. Dashboard (Owner only) is added in Phase 3. */
export function BottomNav({ current }: { current: string }) {
  useSyncExternalStore(session.subscribe, () => session.get().role);
  return (
    <nav className="nav" aria-label={t('nav.main')} style={{ ['--n' as string]: ITEMS.length }}>
      {ITEMS.map((i) => (
        <a key={i.path} href={`#${i.path}`} aria-current={current === i.path ? 'page' : undefined}>
          <span className="pill">
            <Icon name={i.icon} />
          </span>
          {t(i.label)}
        </a>
      ))}
    </nav>
  );
}
