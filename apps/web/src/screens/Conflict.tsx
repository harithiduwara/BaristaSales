// S-09 conflict (FR-REP-10): yours vs saved, Keep saved / Replace with mine.
import { useState } from 'react';
import { REPORT_FIELDS, formatMoney, type Report } from '@aluthgama/shared';
import { AppBar } from '../components/AppBar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { ErrorState } from '../components/misc';
import { db, draftKey } from '../lib/db';
import { removeFromOutbox, submitReport } from '../lib/outbox';
import { cacheItems } from '../lib/reports';
import { navigate } from '../router';
import { conflictState, lastSubmission, useStore } from '../state/app';
import { t, tDynamic, type MessageKey } from '../i18n';

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '–';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : formatMoney(v);
  return String(v);
};

export function Conflict({ date }: { date: string }) {
  const c = useStore(conflictState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!c || c.mine.businessDate !== date) {
    return (
      <div className="screen">
        <AppBar title={t('conflict.title')} leading={{ icon: 'back', label: t('common.back'), onClick: () => navigate('/') }} />
      </div>
    );
  }
  const mine = c.mine as unknown as Record<string, unknown>;
  const saved = c.current as unknown as Record<string, unknown>;
  const rows = REPORT_FIELDS.filter((f) => show(mine[f]) !== show(saved[f]));

  const keepSaved = async () => {
    await (await db()).delete('drafts', draftKey(date));
    await cacheItems([{ ...c.current, weather: null }]);
    conflictState.set(null);
    navigate(`/view/${date}`, { replace: true });
  };
  const replace = async () => {
    setBusy(true);
    setError(null);
    const { submissionId, outcome } = await submitReport(c.mine as Report, c.current.version);
    setBusy(false);
    if (outcome.kind === 'rejected') {
      await removeFromOutbox(submissionId);
      if (outcome.error.code === 'CONFLICT' && outcome.error.error?.current) {
        conflictState.set({ mine: c.mine, current: outcome.error.error.current });
        return;
      }
      setError(tDynamic(`error.${outcome.error.code}`, 'error.INTERNAL'));
      return;
    }
    lastSubmission.set({ date, report: c.mine, queued: outcome.kind === 'queued' });
    conflictState.set(null);
    navigate(`/saved/${date}`, { replace: true });
  };

  return (
    <div className="screen">
      <AppBar title={t('conflict.title')} leading={{ icon: 'back', label: t('common.back'), onClick: () => navigate(`/report/${date}/5`) }} />
      <main className="body">
        <Banner tone="warning">
          <p>{t('conflict.body')}</p>
          <p className="text-sm">{t('conflict.savedBy', { time: c.current.updatedAt.slice(11, 16), device: c.current.updatedByDevice })}</p>
        </Banner>
        {error ? <ErrorState message={error} /> : null}
        <div className="table-wrap card flat" style={{ padding: 0 }}>
          <table className="table diff-table">
            <thead>
              <tr>
                <th scope="col">{t('conflict.field')}</th>
                <th scope="col">{t('conflict.yours')}</th>
                <th scope="col">{t('conflict.saved')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f} className="changed">
                  <th scope="row" style={{ fontWeight: 500, color: 'var(--text)', fontSize: 'var(--fs-14)' }}>
                    {t(`field.${f}` as MessageKey)}
                  </th>
                  <td data-testid={`mine-${f}`}>{show(mine[f])}</td>
                  <td data-testid={`saved-${f}`}>{show(saved[f])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <div className="actionbar">
        <Button variant="secondary" disabled={busy} onClick={() => void keepSaved()}>
          {t('conflict.keepSaved')}
        </Button>
        <Button busy={busy} onClick={() => void replace()}>
          {t('conflict.replace')}
        </Button>
      </div>
    </div>
  );
}
