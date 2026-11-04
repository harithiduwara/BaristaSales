// S-07 History (FR-HIS-01, FR-HIS-04).
import { useEffect, useState } from 'react';
import { CONDITIONS, MANAGER_HISTORY_DAYS, addDays, daysInMonth, formatMonth, monthOf, shiftMonth, todayColombo, type ListItem } from '@aluthgama/shared';
import { AppBar } from '../components/AppBar';
import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, ReportRow, Skeleton } from '../components/misc';
import { listReports } from '../lib/reports';
import { outboxState } from '../lib/outbox';
import { session } from '../lib/session';
import { config, useStore } from '../state/app';
import { t } from '../i18n';
import { ApiCallError } from '../lib/api';

const FILTERS = ['Poya day', 'Public holiday', 'School holiday', 'Power cut', 'Local event / festival'] as const satisfies readonly (typeof CONDITIONS)[number][];

export function History() {
  const role = useStore(session).role;
  const cfg = useStore(config);
  const outbox = useStore(outboxState);
  const today = todayColombo(Date.now());
  const isOwner = role === 'Owner';
  const [month, setMonth] = useState(monthOf(today));
  const [filter, setFilter] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reload, setReload] = useState(0);

  const range = isOwner
    ? { from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` }
    : { from: addDays(today, -MANAGER_HISTORY_DAYS), to: today };

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(null);
    listReports(range.from, range.to)
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setCursor(r.nextCursor);
        setFromCache(r.fromCache);
      })
      .catch((e: unknown) => alive && setError(e instanceof ApiCallError ? e : new ApiCallError('NETWORK', String(e))));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range is derived from month/role
  }, [month, isOwner, reload]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const r = await listReports(range.from, range.to, cursor);
      setItems((prev) => [...(prev ?? []), ...r.items]);
      setCursor(r.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const pending = new Set(outbox.items.map((i) => i.businessDate));
  const shown = (items ?? []).filter((i) => !filter || i.conditions?.includes(filter as never));
  const minMonth = monthOf(cfg.OPENING_DATE);

  return (
    <div className="screen">
      <AppBar
        title={t('history.title')}
        showRole
        actions={
          <button type="button" className="icon-btn" aria-label={t('history.refresh')} onClick={() => setReload((n) => n + 1)}>
            <Icon name="refresh" />
          </button>
        }
      />
      <main className="body">
        {isOwner ? (
          <div className="stack-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="icon-btn" style={{ margin: 0 }} aria-label={t('history.prevMonth')} disabled={month <= minMonth} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
                <Icon name="back" />
              </button>
              <h2 className="h3" aria-live="polite">
                {formatMonth(month)}
              </h2>
              <button type="button" className="icon-btn" style={{ margin: 0 }} aria-label={t('history.nextMonth')} disabled={month >= monthOf(today)} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
                <Icon name="chevron" />
              </button>
            </div>
            <div className="chips" role="group" aria-label={t('history.filter')} style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
              <button type="button" className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
                {t('history.allDays')}
              </button>
              {FILTERS.map((f) => (
                <button key={f} type="button" className="chip" style={{ flex: 'none' }} aria-pressed={filter === f} onClick={() => setFilter(filter === f ? null : f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="hint">{t('history.managerRange')}</p>
        )}
        {fromCache ? (
          <p className="banner info text-sm" role="status">
            {t('history.cached')}
          </p>
        ) : null}
        {error ? (
          <ErrorState message={t(error.isNetwork ? 'error.NETWORK_GENERIC' : 'error.INTERNAL')} correlationId={error.error?.correlationId} onRetry={() => setReload((n) => n + 1)} />
        ) : items === null ? (
          <Skeleton />
        ) : shown.length === 0 ? (
          <EmptyState text={t('history.empty')} />
        ) : (
          <>
            <p className="hint">{shown.length === 1 ? t('history.countOne') : t('history.count', { count: shown.length })}</p>
            <div className="list" data-testid="history-list">
              {shown.map((i) => (
                <ReportRow key={i.businessDate} item={i} pending={pending.has(i.businessDate)} />
              ))}
            </div>
            {cursor ? (
              <Button variant="secondary" busy={loadingMore} onClick={() => void more()}>
                {t('history.loadMore')}
              </Button>
            ) : null}
          </>
        )}
      </main>
      <BottomNav current="/history" />
    </div>
  );
}
