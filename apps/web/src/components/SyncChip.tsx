import { useSyncExternalStore } from 'react';
import { outboxState } from '../lib/outbox';
import { navigate } from '../router';
import { t } from '../i18n';

/** FR-REP-09: always-visible sync status. Opens Settings, where unsent reports are listed. */
export function SyncChip() {
  const s = useSyncExternalStore(outboxState.subscribe, outboxState.get);
  const tone = s.failed > 0 ? 'err' : s.waiting > 0 ? 'wait' : 'ok';
  const text = s.failed > 0 ? t('sync.failed') : s.waiting > 0 ? t('sync.waiting', { count: s.waiting }) : t('sync.allSent');
  return (
    <button
      type="button"
      className={`sync ${tone}`}
      aria-label={t('sync.label', { status: text })}
      aria-live="polite"
      onClick={() => navigate('/settings')}
    >
      <span className="dot" aria-hidden="true" />
      {text}
    </button>
  );
}
