import { useSyncExternalStore } from 'react';
import { session } from '../lib/session';
import { t } from '../i18n';

export function RoleBadge() {
  const role = useSyncExternalStore(session.subscribe, () => session.get().role);
  return role ? <span className="badge">{t(`role.${role}`)}</span> : null;
}
