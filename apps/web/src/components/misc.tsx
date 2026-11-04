import type { ReactNode } from 'react';
import {
  avgBill,
  deliveryShare,
  formatDateShort,
  formatMoney,
  formatPercent,
  walkInSales,
  type ListItem,
} from '@aluthgama/shared';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { t } from '../i18n';

export function KpiCard({
  label,
  value,
  detail,
  empty,
  span,
}: {
  label: string;
  value?: ReactNode;
  detail?: ReactNode;
  empty?: ReactNode;
  span?: boolean;
}) {
  return (
    <div className={`kpi${empty ? ' empty' : ''}`} style={span ? { gridColumn: '1 / -1' } : undefined}>
      <span className="k">{label}</span>
      <span className="v">{empty ?? value}</span>
      {detail ? <span className="d">{detail}</span> : null}
    </div>
  );
}

export function EmptyState({
  icon = 'info',
  text,
  action,
}: {
  icon?: IconName;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-row">
          <div className="skeleton" style={{ width: '40%' }} />
          <div className="skeleton" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

/** Plain message, retry, and the correlation ID for support (NFR-OBS-01). */
export function ErrorState({
  message,
  correlationId,
  onRetry,
}: {
  message: string;
  correlationId?: string | undefined;
  onRetry?: () => void;
}) {
  return (
    <div className="banner error" role="alert">
      <Icon name="alert" />
      <div className="stack-sm" style={{ flex: 1 }}>
        <p>{message}</p>
        {correlationId ? (
          <details>
            <summary>{t('error.details')}</summary>
            <p className="num text-sm">{t('error.reference', { id: correlationId })}</p>
          </details>
        ) : null}
        {onRetry ? (
          <div>
            <Button variant="secondary" icon="refresh" onClick={onRetry}>
              {t('error.retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Live summary strip (FR-REP-04): "–" when inputs are missing. */
export function SummaryStrip({
  total,
  bills,
  uber,
  pickme,
}: {
  total: number | null;
  bills: number | null;
  uber: number | null;
  pickme: number | null;
}) {
  const none = t('summary.none');
  const ab = total !== null && bills !== null ? avgBill({ total, bills }) : null;
  const ds =
    total !== null && uber !== null && pickme !== null ? deliveryShare({ total, uber, pickme }) : null;
  const wi = total !== null && uber !== null && pickme !== null ? walkInSales({ total, uber, pickme }) : null;
  return (
    <div className="strip" aria-live="polite">
      <div>
        <span className="k">{t('summary.avgBill')}</span>
        <span className="v">{ab === null ? none : formatMoney(ab)}</span>
      </div>
      <div>
        <span className="k">{t('summary.delivery')}</span>
        <span className="v">{ds === null ? none : formatPercent(ds)}</span>
      </div>
      <div>
        <span className="k">{t('summary.walkIn')}</span>
        <span className="v">{wi === null ? none : formatMoney(wi)}</span>
      </div>
    </div>
  );
}

/** FR-HIS-01 row: date, total, bills · avg, weather and sync state. */
export function ReportRow({ item, pending }: { item: ListItem; pending?: boolean }) {
  const ab = avgBill(item);
  const w = item.weather;
  return (
    <a className="list-row" href={`#/view/${item.businessDate}`}>
      <span className="date">{formatDateShort(item.businessDate)}</span>
      <span className="amt">Rs {formatMoney(item.total)}</span>
      <span className="meta">
        {ab === null
          ? t('list.bills', { bills: item.bills })
          : t('list.billsAvg', { bills: item.bills, avg: formatMoney(ab) })}
      </span>
      <span className="icons">
        {w ? (
          <>
            <Icon name={w.rainTradingMm >= 1 ? 'rain' : w.rainTradingMm > 0 ? 'cloud' : 'sun'} size="sm" />
            <span className="num">{t('list.rain', { mm: w.rainTradingMm.toFixed(1) })}</span>
          </>
        ) : null}
        {pending ? (
          <span className="state wait">
            <Icon name="clock" size="sm" />
            {t('list.waiting')}
          </span>
        ) : (
          <span className="state ok">
            <Icon name="check" size="sm" />
            {t('list.sent')}
          </span>
        )}
      </span>
    </a>
  );
}

export function WhatsAppPreview({ text }: { text: string }) {
  const [first, ...rest] = text.split('\n');
  const bold = first?.replace(/^\*(.*)\*$/, '$1') ?? '';
  const body = `\n${rest.join('\n')}`;
  return (
    <div className="wa" data-testid="whatsapp-preview">
      <b>{bold}</b>
      {body}
    </div>
  );
}
