// S-01 first run (FR-AUTH-01, OQ-15): device name and a server check, then the PIN screen.
import { useEffect, useState } from 'react';
import { checkHealth } from '../lib/api';
import { saveDevice } from '../lib/session';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { FieldError } from '../components/fields';
import { t } from '../i18n';

export function Setup() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [health, setHealth] = useState<'checking' | 'ok' | 'fail'>('checking');
  const [saving, setSaving] = useState(false);

  const check = () => {
    setHealth('checking');
    void checkHealth().then((ok) => setHealth(ok ? 'ok' : 'fail'));
  };
  useEffect(check, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setError(t('setup.deviceNameRequired'));
      document.getElementById('device-name')?.focus();
      return;
    }
    setSaving(true);
    await saveDevice(n.slice(0, 60));
  };

  return (
    <main className="screen">
      <form
        className="body body-narrow"
        style={{ paddingTop: 48 }}
        onSubmit={(e) => void submit(e)}
        noValidate
      >
        <div className="stack-sm">
          <span className="badge" style={{ alignSelf: 'flex-start' }}>
            {t('app.title')}
          </span>
          <h1 className="h2" style={{ marginTop: 16 }}>
            {t('setup.title')}
          </h1>
          <p className="muted">{t('setup.intro')}</p>
        </div>
        <div className="field">
          <label htmlFor="device-name">{t('setup.deviceName')}</label>
          <div className={`input${error ? ' is-error' : ''}`}>
            <input
              id="device-name"
              value={name}
              maxLength={60}
              autoComplete="off"
              style={{ fontFamily: 'var(--font-sans)' }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'device-name-err device-name-hint' : 'device-name-hint'}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
            />
          </div>
          <span className="hint" id="device-name-hint">
            {t('setup.deviceNameHint')}
          </span>
          <FieldError id="device-name-err" error={error} />
        </div>
        {health === 'checking' ? (
          <Banner tone="info">
            <p>{t('setup.checking')}</p>
          </Banner>
        ) : health === 'ok' ? (
          <Banner tone="success">
            <p>{t('setup.serverOk')}</p>
          </Banner>
        ) : (
          <Banner tone="warning">
            <p>{t('setup.serverFail')}</p>
            <div>
              <Button variant="secondary" icon="refresh" onClick={check}>
                {t('setup.checkAgain')}
              </Button>
            </div>
          </Banner>
        )}
        <Button type="submit" block busy={saving}>
          {t('setup.continue')}
        </Button>
      </form>
    </main>
  );
}
