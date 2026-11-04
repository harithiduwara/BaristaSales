// S-03 Home: greeting, today's report card, Owner MTD strip, last 7 days (FR-REP-09 sync chip in the AppBar).
import { useEffect, useState } from 'react';
import {
  colomboParts,
  defaultBusinessDate,
  formatDateLong,
  formatDateShort,
  formatInt,
  formatMoney,
  formatMonth,
  monthOf,
  todayColombo,
  type DashboardSummary,
  type ListItem,
} from '@aluthgama/shared';
import { AppBar } from '../components/AppBar';
import { BottomNav } from '../components/BottomNav';
import { KpiCard, ReportRow } from '../components/misc';
import { db, draftKey, type Draft } from '../lib/db';
import { getDashboard, last7, listReports } from '../lib/reports';
import { outboxState } from '../lib/outbox';
import { session } from '../lib/session';
import { config, useStore } from '../state/app';
import { colomboTime } from '@aluthgama/shared';
import { t, type MessageKey } from '../i18n';
import { addDays } from '@aluthgama/shared';

type CardState = 'notStarted' | 'draft' | 'saved' | 'waiting' | 'failed';

export function Home() {
  const cfg = useStore(config);
  const { role } = useStore(session);
  const outbox = useStore(outboxState);
  const now = Date.now();
  const today = todayColombo(now);
  const date = defaultBusinessDate(now, cfg.DATE_CUTOFF_HOUR, cfg.OPENING_DATE);
  const hour = colomboParts(now).hour;
  const greeting: MessageKey = hour < 12 ? 'home.morning' : hour < 17 ? 'home.afternoon' : 'home.evening';

  const [recent, setRecent] = useState<ListItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mtd, setMtd] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = await (await db()).get('drafts', draftKey(date));
      if (alive) setDraft(d ?? null);
      setRecent(await last7(today));
      try {
        const r = await listReports(addDays(today, -7), today);
        if (alive) setRecent(r.items);
      } catch {
        // cached list already shown
      }
      if (role === 'Owner') {
        const s = await getDashboard(monthOf(today));
        if (alive && s) setMtd(s.data);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date, today, role, outbox.items.length]);

  const pendingDates = new Set(outbox.items.map((i) => i.businessDate));
  const item = outbox.items.find((i) => i.businessDate === date);
  const saved = recent.find((r) => r.businessDate === date);
  const state: CardState = item ? (item.status === 'failed' ? 'failed' : 'waiting') : draft ? 'draft' : saved ? 'saved' : 'notStarted';
  const hint =
    state === 'draft'
      ? t('home.hint.draft', { time: colomboTime(draft?.updatedAt ?? now) })
      : state === 'saved'
        ? t('home.hint.saved', { time: saved ? saved.updatedAt.slice(11, 16) : '' })
        : state === 'waiting' || state === 'failed'
          ? t('home.hint.waiting')
          : t('home.hint.notStarted');
  const cta =
    state === 'draft'
      ? { href: `#/report/${date}/1`, label: t('home.continue') }
      : state === 'saved'
        ? { href: `#/report/${date}/1`, label: t('home.edit') }
        : state === 'notStarted'
          ? { href: `#/report/${date}/1`, label: t('home.start') }
          : { href: '#/settings', label: t('home.view') };

  return (
    <div className="screen">
      <AppBar title={t('app.shortTitle')} subtitle={formatDateLong(today)} showRole />
      <main className="body">
        <h2 className="h2">{t(greeting)}</h2>
        <section className="card stack" aria-labelledby="today-h" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="h3" id="today-h">
              {t('home.today')}
            </h3>
            <span className="state" style={{ color: 'var(--text-muted)' }} data-testid="today-state">
              {t(`home.state.${state}`)}
            </span>
          </div>
          <p className="muted text-sm">
            {t('home.businessDate', { date: formatDateShort(date) })} {hint}
          </p>
          <a className="btn btn-primary btn-block" href={cta.href}>
            {cta.label}
          </a>
          <a className="link text-sm" href="#/report/new/1" style={{ alignSelf: 'center' }}>
            {t('home.otherDate')}
          </a>
        </section>

        {role === 'Owner' && mtd ? (
          <section className="stack-sm" aria-labelledby="mtd-h">
            <h3 className="section-title" id="mtd-h">
              {t('home.mtd', { month: formatMonth(mtd.month).split(' ')[0] ?? '' })}
            </h3>
            <div className="grid-2" style={{ gridTemplateColumns: '1.3fr 1fr 0.8fr', gap: 8 }}>
              <KpiCard label={t('home.mtdSales')} value={formatMoney(mtd.kpis.mtdSales)} />
              <KpiCard label={t('home.mtdAvgBill')} value={mtd.kpis.avgBill === null ? t('summary.none') : formatMoney(mtd.kpis.avgBill)} />
              <KpiCard label={t('home.mtdBills')} value={formatInt(mtd.kpis.totalBills)} />
            </div>
          </section>
        ) : null}

        <section className="stack-sm" aria-labelledby="last7-h">
          <h3 className="section-title" id="last7-h">
            {t('home.last7')}
          </h3>
          {recent.length === 0 ? (
            <p className="muted text-sm">{t('home.noReports')}</p>
          ) : (
            <div className="list">
              {recent.map((r) => (
                <ReportRow key={r.businessDate} item={r} pending={pendingDates.has(r.businessDate)} />
              ))}
            </div>
          )}
        </section>
      </main>
      <BottomNav current="/" />
    </div>
  );
}
