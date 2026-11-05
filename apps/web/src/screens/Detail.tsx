// S-08 report detail (FR-HIS-02, FR-HIS-03).
import { useEffect, useState } from 'react';
import {
  REPORT_FIELDS,
  canEditDate,
  formatDateShort,
  formatMoney,
  formatPercent,
  todayColombo,
  whatsappSummary,
  type ReportRecord,
  type Weather,
} from '@aluthgama/shared';
import { AppBar } from '../components/AppBar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { EmptyState, ErrorState, Skeleton } from '../components/misc';
import { InsightCard } from '../components/InsightCard';
import { showToast } from '../components/Toast';
import { shareText } from '../lib/platform';
import { getReport } from '../lib/reports';
import { session } from '../lib/session';
import { navigate } from '../router';
import { config, editIntent, useStore } from '../state/app';
import { t, type MessageKey } from '../i18n';
import { STEP_LONG } from '../components/Stepper';
import { FIELD_STEP } from '@aluthgama/shared';

const MONEY = new Set([
  'total',
  'dineIn',
  'takeaway',
  'uber',
  'pickme',
  'cash',
  'card',
  'qr',
  'discounts',
  'comps',
  'voids',
]);

function fmt(f: string, v: unknown): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return MONEY.has(f) ? `Rs ${formatMoney(v)}` : String(v);
  return String(v);
}

export function Detail({ date }: { date: string }) {
  const role = useStore(session).role ?? 'Manager';
  const cfg = useStore(config);
  const [state, setState] = useState<{ report: ReportRecord | null; weather: Weather | null } | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setState(null);
    setError(false);
    getReport(date)
      .then(setState)
      .catch(() => setError(true));
  }, [date, reload]);

  const back = {
    icon: 'back' as const,
    label: t('common.back'),
    onClick: () => (history.length > 1 ? history.back() : navigate('/history')),
  };
  const title = t('detail.title', { date: formatDateShort(date) });
  if (error)
    return (
      <div className="screen">
        <AppBar title={title} leading={back} />
        <main className="body">
          <ErrorState message={t('error.NETWORK_GENERIC')} onRetry={() => setReload((n) => n + 1)} />
        </main>
      </div>
    );
  if (!state)
    return (
      <div className="screen">
        <AppBar title={title} leading={back} />
        <main className="body">
          <Skeleton rows={4} />
        </main>
      </div>
    );
  const r = state.report;
  if (!r)
    return (
      <div className="screen">
        <AppBar title={title} leading={back} />
        <main className="body">
          <EmptyState text={t('detail.notFound', { date: formatDateShort(date) })} />
        </main>
      </div>
    );

  const rec = r as unknown as Record<string, unknown>;
  const submittedAt = `${formatDateShort(r.updatedAt.slice(0, 10))} ${r.updatedAt.slice(11, 16)}`;
  const editable = canEditDate(role, r.businessDate, todayColombo(Date.now()), cfg.EDIT_WINDOW_DAYS);
  const w = state.weather;
  const groups = [1, 2, 3, 4].map((step) => ({
    step,
    fields: REPORT_FIELDS.filter(
      (f) =>
        f !== 'businessDate' &&
        FIELD_STEP[f] === step &&
        rec[f] !== undefined &&
        rec[f] !== null &&
        rec[f] !== '',
    ),
  }));

  return (
    <div className="screen">
      <AppBar title={title} leading={back} />
      {/* Focusable so keyboard users can scroll a report with no links in it (WCAG 2.1.1). */}
      <main className="body" tabIndex={0}>
        {groups.map((g) =>
          g.fields.length ? (
            <section key={g.step} className="card stack-sm" aria-labelledby={`dg-${g.step}`}>
              <h2 className="h3" id={`dg-${g.step}`}>
                {t(STEP_LONG[g.step - 1] as MessageKey)}
              </h2>
              <dl className="dl">
                {g.fields.map((f) => (
                  <div key={f} style={{ display: 'contents' }}>
                    <dt>{t(`field.${f}` as MessageKey)}</dt>
                    <dd
                      className={typeof rec[f] === 'number' ? undefined : 'txt'}
                      data-testid={`detail-${f}`}
                    >
                      {fmt(f, rec[f])}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null,
        )}
        <section className="card stack-sm" aria-labelledby="dm-h">
          <h2 className="h3" id="dm-h">
            {t('detail.metrics')}
          </h2>
          <dl className="dl">
            <dt>{t('summary.avgBill')}</dt>
            <dd>{r.avgBill === null ? '–' : formatMoney(r.avgBill)}</dd>
            <dt>{t('summary.delivery')}</dt>
            <dd>{r.deliveryShare === null ? '–' : formatPercent(r.deliveryShare)}</dd>
            <dt>{t('summary.walkIn')}</dt>
            <dd>{formatMoney(r.walkInSales)}</dd>
          </dl>
        </section>
        <section className="card stack-sm" aria-labelledby="dw-h">
          <h2 className="h3" id="dw-h">
            {t('detail.weather')}
          </h2>
          {w ? (
            <dl className="dl">
              <dt>{t('detail.avgTemp')}</dt>
              <dd>{w.avgTempTrading.toFixed(1)} °C</dd>
              <dt>{t('detail.maxMin')}</dt>
              <dd>
                {w.maxTemp.toFixed(1)} / {w.minTemp.toFixed(1)} °C
              </dd>
              <dt>{t('detail.feelsLike')}</dt>
              <dd>{w.maxFeelsLike.toFixed(1)} °C</dd>
              <dt>{t('detail.humidity')}</dt>
              <dd>{w.avgHumidityTrading}%</dd>
              <dt>{t('detail.rainTrading')}</dt>
              <dd>{w.rainTradingMm.toFixed(1)} mm</dd>
              <dt>{t('detail.rainHours')}</dt>
              <dd>{w.rainHoursTrading}</dd>
              <dt>{t('detail.rainDay')}</dt>
              <dd>{w.rainDayMm.toFixed(1)} mm</dd>
            </dl>
          ) : (
            <p className="muted text-sm">{t('detail.weatherPending')}</p>
          )}
        </section>
        <InsightCard date={r.businessDate} version={r.version} auto={false} />
        <section className="card stack-sm" aria-labelledby="da-h">
          <h2 className="h3" id="da-h">
            {t('detail.audit')}
          </h2>
          <dl className="kv">
            <dt>{t('detail.version')}</dt>
            <dd className="num" data-testid="detail-version">
              {r.version}
            </dd>
            <dt>{t('detail.lastSubmitted')}</dt>
            <dd>{submittedAt}</dd>
            <dt>{t('detail.device')}</dt>
            <dd>{r.updatedByDevice}</dd>
            <dt>{t('detail.source')}</dt>
            <dd>{t(`detail.source.${r.source}` as MessageKey)}</dd>
          </dl>
        </section>
        {!editable ? (
          <Banner tone="info" icon="lock">
            <p>{t('detail.editLocked')}</p>
          </Banner>
        ) : null}
      </main>
      <div className="actionbar">
        <Button
          variant="secondary"
          icon="share"
          onClick={() =>
            void shareText(whatsappSummary(r)).then((x) =>
              showToast(x === 'copied' ? t('success.copied') : t('success.shareOpened')),
            )
          }
        >
          {t('detail.share')}
        </Button>
        {editable ? (
          <Button
            icon="edit"
            onClick={() => {
              editIntent.set(r.businessDate);
              navigate(`/report/${r.businessDate}/1`);
            }}
          >
            {t('detail.edit')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
