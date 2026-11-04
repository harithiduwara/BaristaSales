// Pure calculations (8.4). Definitions from 1.3 and FR-DSH-01. Inputs are never rounded here.
import type { Config } from './constants';
import { addDays, dayNumber, daysBetween, daysInMonth, weekday, type Weekday } from './dates';

export interface SalesFigures {
  total: number;
  bills: number;
  uber: number;
  pickme: number;
}

/** Total ÷ bills, or null when there are no bills. */
export const avgBill = (r: Pick<SalesFigures, 'total' | 'bills'>): number | null =>
  r.bills > 0 ? r.total / r.bills : null;

export const deliverySales = (r: Pick<SalesFigures, 'uber' | 'pickme'>): number => r.uber + r.pickme;

/** (Uber + PickMe) ÷ total, or null when total is 0. */
export const deliveryShare = (r: Pick<SalesFigures, 'total' | 'uber' | 'pickme'>): number | null =>
  r.total > 0 ? deliverySales(r) / r.total : null;

export const walkInSales = (r: Pick<SalesFigures, 'total' | 'uber' | 'pickme'>): number =>
  r.total - deliverySales(r);

export interface Computed {
  avgBill: number | null;
  deliverySales: number;
  deliveryShare: number | null;
  walkInSales: number;
}

export const computeMetrics = (r: SalesFigures): Computed => ({
  avgBill: avgBill(r),
  deliverySales: deliverySales(r),
  deliveryShare: deliveryShare(r),
  walkInSales: walkInSales(r),
});

export interface DailyPoint {
  date: string;
  total: number;
}

/**
 * Trailing moving average over a calendar window (default 7 days, the point's own day included).
 * Days without a report are skipped, not counted as zero.
 */
export function movingAverage(points: readonly DailyPoint[], window = 7): number[] {
  return points.map((p) => {
    const start = dayNumber(p.date) - window + 1;
    const inWindow = points.filter((q) => dayNumber(q.date) >= start && q.date <= p.date);
    return inWindow.reduce((s, q) => s + q.total, 0) / inWindow.length;
  });
}

/**
 * Average total of reports in the 7 calendar days before `date` (FR-REP-05, OQ-10).
 * Null when fewer than `minReports` reports exist in that window.
 */
export function trailingAverage(points: readonly DailyPoint[], date: string, minReports = 3): number | null {
  const from = addDays(date, -7);
  const prior = points.filter((p) => p.date >= from && p.date < date);
  return prior.length >= minReports ? prior.reduce((s, p) => s + p.total, 0) / prior.length : null;
}

/** MTD ÷ days elapsed × days in period (FR-DSH-01). Null before any report. */
export function projectedMonthEnd(mtd: number, daysElapsed: number, daysInPeriod: number): number | null {
  return daysElapsed > 0 ? (mtd / daysElapsed) * daysInPeriod : null;
}

export type RequiredDaily =
  | { kind: 'noTarget' }
  | { kind: 'reached' }
  | { kind: 'missed'; shortfall: number }
  | { kind: 'perDay'; amount: number };

/** (target − MTD) ÷ days remaining (FR-DSH-01). On the last day with the target not reached: missed (OQ-11). */
export function requiredDaily(target: number | null, mtd: number, daysRemaining: number): RequiredDaily {
  if (target === null) return { kind: 'noTarget' };
  const remaining = target - mtd;
  if (remaining <= 0) return { kind: 'reached' };
  if (daysRemaining <= 0) return { kind: 'missed', shortfall: remaining };
  return { kind: 'perDay', amount: remaining / daysRemaining };
}

export interface WeekdayRow {
  weekday: Weekday;
  reports: number;
  avgSales: number;
  avgBills: number;
  avgBill: number | null;
}

const WEEK_ORDER: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Average sales, bills and bill value per weekday, only for weekdays with at least one report (FR-DSH-03). */
export function weekdayAverages(reports: readonly (DailyPoint & { bills: number })[]): WeekdayRow[] {
  const acc = new Map<Weekday, { n: number; sales: number; bills: number }>();
  for (const r of reports) {
    const d = weekday(r.date);
    const a = acc.get(d) ?? { n: 0, sales: 0, bills: 0 };
    acc.set(d, { n: a.n + 1, sales: a.sales + r.total, bills: a.bills + r.bills });
  }
  return WEEK_ORDER.flatMap((d) => {
    const a = acc.get(d);
    return a
      ? [
          {
            weekday: d,
            reports: a.n,
            avgSales: a.sales / a.n,
            avgBills: a.bills / a.n,
            avgBill: a.bills > 0 ? a.sales / a.bills : null,
          },
        ]
      : [];
  });
}

export interface ReconciliationDiff {
  /** parts − total. Positive: the parts add up to more than the total. */
  diff: number;
  direction: 'over' | 'under' | 'balanced';
}

/** Compares a split with the total; differences under Rs 1 count as balanced (FR-REP-05). */
export function reconciliationDiff(
  parts: readonly (number | undefined)[],
  total: number,
): ReconciliationDiff {
  const sum = parts.reduce<number>((s, p) => s + (p ?? 0), 0);
  const diff = Math.round((sum - total) * 100) / 100;
  if (Math.abs(diff) < 1) return { diff, direction: 'balanced' };
  return { diff, direction: diff > 0 ? 'over' : 'under' };
}

export type Warning =
  | { code: 'channelSplit'; diff: number; direction: 'over' | 'under' }
  | { code: 'paymentSplit'; diff: number; direction: 'over' | 'under' }
  | { code: 'avgBillUnusual'; avgBill: number }
  | { code: 'farFromAverage'; average: number };

export interface WarningInput {
  businessDate: string;
  total: number;
  bills: number;
  uber: number;
  pickme: number;
  dineIn?: number | undefined;
  takeaway?: number | undefined;
  cash?: number | undefined;
  card?: number | undefined;
  qr?: number | undefined;
}

/** Non-blocking warnings shown before submitting (FR-REP-05). `history` holds other saved reports. */
export function reportWarnings(r: WarningInput, history: readonly DailyPoint[]): Warning[] {
  const out: Warning[] = [];
  if (r.dineIn !== undefined || r.takeaway !== undefined) {
    const d = reconciliationDiff([r.dineIn, r.takeaway, r.uber, r.pickme], r.total);
    if (d.direction !== 'balanced') out.push({ code: 'channelSplit', diff: d.diff, direction: d.direction });
  }
  if (r.cash !== undefined || r.card !== undefined || r.qr !== undefined) {
    const d = reconciliationDiff([r.cash, r.card, r.qr], r.total);
    if (d.direction !== 'balanced') out.push({ code: 'paymentSplit', diff: d.diff, direction: d.direction });
  }
  const ab = avgBill(r);
  if (ab !== null && (ab < 500 || ab > 20_000)) out.push({ code: 'avgBillUnusual', avgBill: ab });
  const avg = trailingAverage(
    history.filter((h) => h.date !== r.businessDate),
    r.businessDate,
  );
  if (avg !== null && avg > 0 && (r.total > 3 * avg || r.total < 0.25 * avg))
    out.push({ code: 'farFromAverage', average: avg });
  return out;
}

// ---------- Dashboard (FR-DSH-01 … 06) ----------

export interface DashboardReport extends DailyPoint {
  bills: number;
  uber: number;
  pickme: number;
  dineIn?: number | undefined;
  takeaway?: number | undefined;
}

export interface DashboardWeather {
  rainTradingMm: number;
  avgTempTrading: number;
}

export interface SeriesPoint {
  date: string;
  total: number;
  bills: number;
  avgBill: number | null;
  ma7: number;
  dineIn: number | null;
  takeaway: number | null;
  uber: number;
  pickme: number;
  rainMm: number | null;
  avgTemp: number | null;
}

export interface DashboardSummary {
  month: string;
  periodStart: string;
  periodEnd: string;
  daysInPeriod: number;
  daysElapsed: number;
  latestReportDate: string | null;
  kpis: {
    mtdSales: number;
    monthlyTarget: number | null;
    achievement: number | null;
    projectedMonthEnd: number | null;
    requiredDaily: RequiredDaily;
    avgBill: number | null;
    totalBills: number;
    deliveryShare: number | null;
    targetDailyAvg: number | null;
    benchmarkDailyAvg: number;
  };
  series: SeriesPoint[];
  weekdays: WeekdayRow[];
}

export function dashboardSummary(
  month: string,
  reports: readonly DashboardReport[],
  weather: ReadonlyMap<string, DashboardWeather>,
  config: Pick<Config, 'OPENING_DATE' | 'MONTHLY_TARGET' | 'BENCHMARK_MONTHLY_AVG'>,
): DashboardSummary {
  const dim = daysInMonth(month);
  const first = `${month}-01`;
  const periodEnd = `${month}-${String(dim).padStart(2, '0')}`;
  const periodStart = first < config.OPENING_DATE ? config.OPENING_DATE : first;
  const daysInPeriod = periodStart > periodEnd ? 0 : daysBetween(periodStart, periodEnd) + 1;
  const rows = reports
    .filter((r) => r.date >= periodStart && r.date <= periodEnd)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const mtd = rows.reduce((s, r) => s + r.total, 0);
  const bills = rows.reduce((s, r) => s + r.bills, 0);
  const delivery = rows.reduce((s, r) => s + r.uber + r.pickme, 0);
  const latest = rows.at(-1)?.date ?? null;
  const daysElapsed = latest ? daysBetween(periodStart, latest) + 1 : 0;
  const daysRemaining = latest ? daysBetween(latest, periodEnd) : daysInPeriod;
  const target = config.MONTHLY_TARGET;
  const ma = movingAverage(
    reports
      .filter((r) => r.date <= periodEnd)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date)),
  );
  const maByDate = new Map(
    reports
      .filter((r) => r.date <= periodEnd)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r, i) => [r.date, ma[i] as number]),
  );
  return {
    month,
    periodStart,
    periodEnd,
    daysInPeriod,
    daysElapsed,
    latestReportDate: latest,
    kpis: {
      mtdSales: mtd,
      monthlyTarget: target,
      achievement: target ? mtd / target : null,
      projectedMonthEnd: projectedMonthEnd(mtd, daysElapsed, daysInPeriod),
      requiredDaily: requiredDaily(target, mtd, daysRemaining),
      avgBill: bills > 0 ? mtd / bills : null,
      totalBills: bills,
      deliveryShare: mtd > 0 ? delivery / mtd : null,
      targetDailyAvg: target && daysInPeriod > 0 ? target / daysInPeriod : null,
      benchmarkDailyAvg: config.BENCHMARK_MONTHLY_AVG / dim,
    },
    series: rows.map((r) => {
      const w = weather.get(r.date);
      return {
        date: r.date,
        total: r.total,
        bills: r.bills,
        avgBill: avgBill(r),
        ma7: maByDate.get(r.date) as number,
        dineIn: r.dineIn ?? null,
        takeaway: r.takeaway ?? null,
        uber: r.uber,
        pickme: r.pickme,
        rainMm: w?.rainTradingMm ?? null,
        avgTemp: w?.avgTempTrading ?? null,
      };
    }),
    weekdays: weekdayAverages(rows),
  };
}
