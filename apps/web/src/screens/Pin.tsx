// S-02 PIN sign-in (FR-AUTH-02, FR-AUTH-03).
import { useEffect, useState } from 'react';
import { PIN_LENGTH } from '@aluthgama/shared';
import { ApiCallError, callApi } from '../lib/api';
import { signIn, session } from '../lib/session';
import { processOutbox } from '../lib/outbox';
import { refreshConfig, online, useStore } from '../state/app';
import { PinPad } from '../components/PinPad';
import { Banner } from '../components/Banner';
import { APP_VERSION } from '../lib/env';
import { t } from '../i18n';

export function Pin() {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'wrong' | 'locked' | 'network' | 'other' | null>(null);
  const [otherMsg, setOtherMsg] = useState('');
  const isOnline = useStore(online);
  const deviceName = useStore(session).deviceName;

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || busy) return;
    setBusy(true);
    callApi('auth.verify', { pin, deviceName: deviceName ?? '' })
      .then(async (d) => {
        await signIn(d.token, d.role, d.expiresAt);
        void refreshConfig();
        void processOutbox({ force: true });
      })
      .catch((e: unknown) => {
        const err = e instanceof ApiCallError ? e : new ApiCallError('NETWORK', String(e));
        if (err.code === 'LOCKED_OUT') setError('locked');
        else if (err.code === 'UNAUTHORIZED') setError('wrong');
        else if (err.isNetwork) setError('network');
        else {
          setError('other');
          setOtherMsg(t(`error.${err.code}` as 'error.INTERNAL'));
        }
        setPin('');
      })
      .finally(() => setBusy(false));
  }, [pin, busy, deviceName]);

  const locked = error === 'locked';
  useEffect(() => {
    if (!locked) return;
    const id = setTimeout(() => setError(null), 15 * 60_000);
    return () => clearTimeout(id);
  }, [locked]);
  return (
    <main className="screen">
      <div className="body body-narrow" style={{ justifyContent: 'space-between', paddingTop: 48 }}>
        <div className="center" style={{ gap: 8 }}>
          <span className="badge" style={{ minHeight: 28 }}>
            {t('app.title')}
          </span>
          <h1 className="h2" style={{ marginTop: 16 }}>
            {t('pin.title')}
          </h1>
          {deviceName ? (
            <p className="muted text-sm" data-testid="device-name">
              {deviceName}
            </p>
          ) : null}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div aria-live="assertive" style={{ minHeight: 24 }}>
            {locked ? (
              <Banner tone="error" icon="lock" title={t('pin.lockedTitle')}>
                <p>{t('pin.lockedBody')}</p>
              </Banner>
            ) : error === 'wrong' ? (
              <p className="error-text" style={{ justifyContent: 'center' }} role="alert">
                {t('pin.wrong')}
              </p>
            ) : error === 'network' || !isOnline ? (
              <Banner tone="warning" icon="offline">
                <p>{t('pin.offline')}</p>
              </Banner>
            ) : error === 'other' ? (
              <Banner tone="error">
                <p>{otherMsg}</p>
              </Banner>
            ) : busy ? (
              <p className="hint" style={{ textAlign: 'center' }}>
                {t('pin.checking')}
              </p>
            ) : null}
          </div>
          <PinPad
            value={pin}
            disabled={busy || locked}
            onChange={(v) => {
              if (error && error !== 'locked') setError(null);
              setPin(v);
            }}
          />
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>
          {t('app.version', { version: APP_VERSION })}
        </p>
      </div>
    </main>
  );
}
