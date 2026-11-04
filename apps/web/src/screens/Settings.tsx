// S-11 Settings (FR-SET-01 … 04, FR-AUTH-04).
import { useEffect, useState } from 'react';
import { formatDateShort, formatMoney, parseMoney } from '@aluthgama/shared';
import { AppBar } from '../components/AppBar';
import { BottomNav } from '../components/BottomNav';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/Dialog';
import { MoneyField } from '../components/fields';
import { showToast } from '../components/Toast';
import { ApiCallError, callApi } from '../lib/api';
import { recentSync, type OutboxItem, type SyncEvent } from '../lib/db';
import { API_URL, APP_VERSION } from '../lib/env';
import { outboxState, removeFromOutbox, retryItem } from '../lib/outbox';
import { session, signOut } from '../lib/session';
import { navigate } from '../router';
import { config, saveTheme, setConfigLocal, theme, useStore, type Theme } from '../state/app';
import { t, tDynamic } from '../i18n';
import { colomboTime } from '@aluthgama/shared';

export function Settings() {
  const s = useStore(session);
  const cfg = useStore(config);
  const outbox = useStore(outboxState);
  const currentTheme = useStore(theme);
  const [log, setLog] = useState<SyncEvent[]>([]);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [discard, setDiscard] = useState<OutboxItem | null>(null);
  const [target, setTarget] = useState(cfg.MONTHLY_TARGET === null ? '' : formatMoney(cfg.MONTHLY_TARGET));
  const [bench, setBench] = useState(formatMoney(cfg.BENCHMARK_MONTHLY_AVG));
  const [targetErr, setTargetErr] = useState<{ target?: string; bench?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void recentSync().then(setLog);
  }, [outbox]);

  const unsent = outbox.items.length;
  const saveTargets = async () => {
    const tv = target.trim() === '' ? null : parseMoney(target);
    const bv = parseMoney(bench);
    const errs: typeof targetErr = {};
    if (tv !== null && !Number.isFinite(tv)) errs.target = t('rule.money');
    if (bv === null || !Number.isFinite(bv)) errs.bench = t('rule.money');
    setTargetErr(errs);
    if (errs.target || errs.bench) return;
    setSaving(true);
    try {
      const c = await callApi('config.update', { MONTHLY_TARGET: tv, BENCHMARK_MONTHLY_AVG: bv as number });
      await setConfigLocal(c);
      showToast(t('settings.targetsSaved'));
    } catch (e) {
      const err = e instanceof ApiCallError ? e : null;
      showToast(err?.isNetwork ? t('error.NETWORK_GENERIC') : tDynamic(`error.${err?.code ?? 'INTERNAL'}`, 'error.INTERNAL'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <AppBar title={t('settings.title')} showRole />
      <main className="body">
        <section className="card stack-sm" aria-labelledby="st-dev">
          <h2 className="h3" id="st-dev">
            {t('settings.device')}
          </h2>
          <dl className="kv">
            <dt>{t('settings.deviceName')}</dt>
            <dd>{s.deviceName}</dd>
            <dt>{t('settings.role')}</dt>
            <dd>{s.role ? t(`role.${s.role}`) : ''}</dd>
            <dt>{t('settings.version')}</dt>
            <dd className="num" data-testid="app-version">
              {APP_VERSION}
            </dd>
            <dt>{t('settings.apiUrl')}</dt>
            <dd className="num" style={{ fontSize: 12 }}>
              {API_URL}
            </dd>
          </dl>
          <p className="hint">{t('settings.pinNote')}</p>
          <Button variant="secondary" onClick={() => setSignOutOpen(true)}>
            {t('settings.signOut')}
          </Button>
        </section>

        <section className="card stack-sm" aria-labelledby="st-unsent">
          <h2 className="h3" id="st-unsent">
            {t('settings.unsent')}
          </h2>
          {unsent === 0 ? (
            <p className="muted text-sm">{t('settings.unsentNone')}</p>
          ) : (
            <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {outbox.items.map((i) => (
                <li key={i.submissionId} className="stack-sm" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>{formatDateShort(i.businessDate)}</b>
                    <span className={`state ${i.status === 'failed' ? '' : 'wait'}`}>{t(`outbox.status.${i.status}`)}</span>
                  </div>
                  {i.lastError ? (
                    <p className="text-sm muted">
                      {tDynamic(`error.${i.lastError.code}`, 'error.INTERNAL')} {t('outbox.attempts', { count: i.attempts })}
                    </p>
                  ) : null}
                  <div className="btn-row">
                    <Button variant="secondary" icon="refresh" onClick={() => void retryItem(i.submissionId)}>
                      {t('settings.retryNow')}
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/report/${i.businessDate}/5`)}>
                      {t('settings.openReport')}
                    </Button>
                    <Button variant="ghost" onClick={() => setDiscard(i)}>
                      {t('settings.discard')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {s.role === 'Owner' ? (
          <section className="card stack-sm" aria-labelledby="st-targets">
            <h2 className="h3" id="st-targets">
              {t('settings.targets')}
            </h2>
            <MoneyField id="monthlyTarget" label={t('settings.monthlyTarget')} hint={t('settings.monthlyTargetHint')} value={target} error={targetErr.target} onChange={setTarget} />
            <MoneyField id="benchmark" label={t('settings.benchmark')} value={bench} error={targetErr.bench} onChange={setBench} />
            <Button busy={saving} onClick={() => void saveTargets()}>
              {t('settings.saveTargets')}
            </Button>
          </section>
        ) : null}

        <section className="card stack-sm" aria-labelledby="st-theme">
          <h2 className="h3" id="st-theme">
            {t('settings.theme')}
          </h2>
          <div className="segmented" role="group" aria-labelledby="st-theme">
            {(['system', 'light', 'dark'] as Theme[]).map((m) => (
              <button key={m} type="button" aria-pressed={currentTheme === m} onClick={() => void saveTheme(m)}>
                {t(`settings.theme.${m}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="card stack-sm" aria-labelledby="st-log">
          <h2 className="h3" id="st-log">
            {t('settings.syncLog')}
          </h2>
          {log.length === 0 ? (
            <p className="muted text-sm">{t('settings.syncLogEmpty')}</p>
          ) : (
            <div className="table-wrap">
              <table className="table" data-testid="sync-log">
                <tbody>
                  {log.map((e) => (
                    <tr key={e.id}>
                      <td className="num">{colomboTime(e.at)}</td>
                      <td>{e.businessDate ? formatDateShort(e.businessDate) : e.action}</td>
                      <td>{e.result}</td>
                      <td className="num">{e.errorCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <BottomNav current="/settings" />
      <ConfirmDialog
        open={signOutOpen}
        title={t('settings.signOutTitle')}
        confirmLabel={t('settings.signOut')}
        cancelLabel={t('settings.cancel')}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          void signOut();
        }}
      >
        {unsent > 0 ? (
          <Banner tone="warning">
            <p>{t(unsent === 1 ? 'settings.signOutUnsent' : 'settings.signOutUnsentPlural', { count: unsent })}</p>
          </Banner>
        ) : (
          t('settings.signOutBody')
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={discard !== null}
        title={t('settings.discardTitle')}
        confirmLabel={t('settings.discard')}
        cancelLabel={t('settings.cancel')}
        danger
        onCancel={() => setDiscard(null)}
        onConfirm={() => {
          if (discard) void removeFromOutbox(discard.submissionId);
          setDiscard(null);
        }}
      >
        {discard ? t('settings.discardBody', { date: formatDateShort(discard.businessDate) }) : null}
      </ConfirmDialog>
    </div>
  );
}
