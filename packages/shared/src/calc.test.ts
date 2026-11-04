import { describe, expect, it } from 'vitest';
import {
  avgBill,
  computeMetrics,
  dashboardSummary,
  deliveryShare,
  movingAverage,
  projectedMonthEnd,
  reconciliationDiff,
  reportWarnings,
  requiredDaily,
  trailingAverage,
  weekdayAverages,
  type DashboardReport,
} from './calc';
import { DEFAULT_CONFIG } from './constants';

const nov3 = { total: 129849.85, bills: 46, uber: 0, pickme: 1900 };

describe('1.3 metrics', () => {
  it('UAT-02 average bill', () => expect(avgBill(nov3)).toBeCloseTo(2822.8228, 4));
  it('no average bill without bills', () => expect(avgBill({ total: 0, bills: 0 })).toBeNull());
  it('delivery share and walk-in', () => {
    expect(computeMetrics(nov3)).toEqual({
      avgBill: 129849.85 / 46,
      deliverySales: 1900,
      deliveryShare: 1900 / 129849.85,
      walkInSales: 127949.85,
    });
    expect(deliveryShare({ total: 0, uber: 0, pickme: 0 })).toBeNull();
  });
});

describe('movingAverage(7)', () => {
  it('averages the reports in the trailing 7 calendar days', () => {
    const pts = [
      { date: '2026-11-01', total: 70 },
      { date: '2026-11-02', total: 140 },
      { date: '2026-11-07', total: 210 },
      { date: '2026-11-08', total: 0 },
    ];
    expect(movingAverage(pts)).toEqual([70, 105, 140, 350 / 3]);
  });
});

describe('trailingAverage (FR-REP-05, OQ-10)', () => {
  const pts = [
    { date: '2026-11-02', total: 100 },
    { date: '2026-11-03', total: 200 },
    { date: '2026-11-05', total: 300 },
  ];
  it('needs 3 prior reports', () => {
    expect(trailingAverage(pts, '2026-11-05')).toBeNull();
    expect(trailingAverage(pts, '2026-11-06')).toBe(200);
  });
  it('only looks back 7 days', () => expect(trailingAverage(pts, '2026-11-10')).toBeNull());
});

describe('reconciliationDiff', () => {
  it('balanced under Rs 1', () => expect(reconciliationDiff([100, 0.5], 100).direction).toBe('balanced'));
  it('UAT-03 reports direction and amount', () => {
    expect(reconciliationDiff([61200, 72620, 14000], 148320)).toEqual({ diff: -500, direction: 'under' });
    expect(reconciliationDiff([100, undefined, 50], 120)).toEqual({ diff: 30, direction: 'over' });
  });
});

describe('FR-REP-05 warnings', () => {
  const r = { businessDate: '2026-11-04', total: 148320, bills: 52, uber: 4640, pickme: 4400 };
  it('none for a clean report with no splits', () => expect(reportWarnings(r, [])).toEqual([]));
  it('channel and payment splits', () => {
    expect(
      reportWarnings({ ...r, dineIn: 96500, takeaway: 42280, cash: 61200, card: 72620, qr: 14000 }, []),
    ).toEqual([
      { code: 'channelSplit', diff: -500, direction: 'under' },
      { code: 'paymentSplit', diff: -500, direction: 'under' },
    ]);
    expect(reportWarnings({ ...r, takeaway: 139280 }, [])).toEqual([]);
    expect(reportWarnings({ ...r, card: 148320 }, [])).toEqual([]);
  });
  it('unusual average bill', () => {
    expect(reportWarnings({ ...r, bills: 400 }, [])).toEqual([{ code: 'avgBillUnusual', avgBill: 370.8 }]);
    expect(reportWarnings({ ...r, bills: 7 }, [])[0]?.code).toBe('avgBillUnusual');
  });
  it('far from the recent average, ignoring the same date', () => {
    const hist = [
      { date: '2026-11-01', total: 40000 },
      { date: '2026-11-02', total: 40000 },
      { date: '2026-11-03', total: 40000 },
      { date: '2026-11-04', total: 1 },
    ];
    expect(reportWarnings(r, hist)).toEqual([{ code: 'farFromAverage', average: 40000 }]);
    expect(reportWarnings({ ...r, total: 9000, bills: 4, uber: 0, pickme: 0 }, hist)).toEqual([
      { code: 'farFromAverage', average: 40000 },
    ]);
    expect(reportWarnings({ ...r, total: 50000, bills: 20, uber: 0, pickme: 0 }, hist)).toEqual([]);
    const zero = hist.map((h) => ({ ...h, total: 0 }));
    expect(reportWarnings(r, zero)).toEqual([]);
  });
});

describe('FR-DSH-01 targets and projection', () => {
  it('projects month end', () => {
    expect(projectedMonthEnd(361724.75, 2, 29)).toBeCloseTo(5245008.875, 6);
    expect(projectedMonthEnd(0, 0, 29)).toBeNull();
  });
  it('required daily average', () => {
    expect(requiredDaily(null, 100, 5)).toEqual({ kind: 'noTarget' });
    expect(requiredDaily(100, 100, 5)).toEqual({ kind: 'reached' });
    expect(requiredDaily(1000, 100, 0)).toEqual({ kind: 'missed', shortfall: 900 });
    expect(requiredDaily(1000, 100, 3)).toEqual({ kind: 'perDay', amount: 300 });
  });
});

describe('FR-DSH-03 weekday averages', () => {
  it('only weekdays with reports, Monday first', () => {
    expect(
      weekdayAverages([
        { date: '2026-11-08', total: 300, bills: 0 },
        { date: '2026-11-02', total: 100, bills: 10 },
        { date: '2026-11-09', total: 300, bills: 30 },
      ]),
    ).toEqual([
      { weekday: 'Mon', reports: 2, avgSales: 200, avgBills: 20, avgBill: 10 },
      { weekday: 'Sun', reports: 1, avgSales: 300, avgBills: 0, avgBill: null },
    ]);
  });
});

describe('E2E-09 dashboardSummary', () => {
  const reports: DashboardReport[] = [
    { date: '2026-11-03', total: 129849.85, bills: 46, uber: 0, pickme: 1900 },
    { date: '2026-11-02', total: 231874.9, bills: 82, uber: 0, pickme: 0 },
    {
      date: '2026-11-04',
      total: 148320,
      bills: 52,
      uber: 4640,
      pickme: 4400,
      dineIn: 96500,
      takeaway: 42780,
    },
    { date: '2026-12-01', total: 1, bills: 1, uber: 0, pickme: 0 },
  ];
  const weather = new Map([['2026-11-03', { rainTradingMm: 6.8, avgTempTrading: 28.1 }]]);

  it('November from the opening date, no target', () => {
    const d = dashboardSummary('2026-11', reports, weather, DEFAULT_CONFIG);
    expect(d.periodStart).toBe('2026-11-02');
    expect(d.periodEnd).toBe('2026-11-30');
    expect(d.daysInPeriod).toBe(29);
    expect(d.daysElapsed).toBe(3);
    expect(d.latestReportDate).toBe('2026-11-04');
    expect(d.kpis.mtdSales).toBeCloseTo(510044.75, 6);
    expect(d.kpis.projectedMonthEnd).toBeCloseTo(4930432.5833, 3);
    expect(d.kpis.requiredDaily).toEqual({ kind: 'noTarget' });
    expect(d.kpis.achievement).toBeNull();
    expect(d.kpis.targetDailyAvg).toBeNull();
    expect(d.kpis.totalBills).toBe(180);
    expect(d.kpis.avgBill).toBeCloseTo(2833.5819, 4);
    expect(d.kpis.deliveryShare).toBeCloseTo(10940 / 510044.75, 10);
    expect(d.kpis.benchmarkDailyAvg).toBeCloseTo(190666.6667, 3);
    expect(d.series.map((s) => s.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(d.series[1]).toMatchObject({
      rainMm: 6.8,
      avgTemp: 28.1,
      dineIn: null,
      ma7: (231874.9 + 129849.85) / 2,
    });
    expect(d.series[2]).toMatchObject({ rainMm: null, dineIn: 96500, takeaway: 42780 });
    expect(d.weekdays.map((w) => w.weekday)).toEqual(['Mon', 'Tue', 'Wed']);
  });

  it('with a target', () => {
    const d = dashboardSummary('2026-11', reports, weather, { ...DEFAULT_CONFIG, MONTHLY_TARGET: 4_500_000 });
    expect(d.kpis.achievement).toBeCloseTo(510044.75 / 4_500_000, 10);
    expect(d.kpis.requiredDaily).toEqual({ kind: 'perDay', amount: (4_500_000 - 510044.75) / 26 });
    expect(d.kpis.targetDailyAvg).toBeCloseTo(4_500_000 / 29, 6);
  });

  it('a month with no reports', () => {
    const d = dashboardSummary('2026-10', reports, weather, { ...DEFAULT_CONFIG, MONTHLY_TARGET: 100 });
    expect(d.daysInPeriod).toBe(0);
    expect(d.daysElapsed).toBe(0);
    expect(d.kpis).toMatchObject({
      mtdSales: 0,
      avgBill: null,
      deliveryShare: null,
      projectedMonthEnd: null,
      targetDailyAvg: null,
    });
    expect(d.series).toEqual([]);
  });

  it('a full month after opening', () => {
    const d = dashboardSummary('2026-12', reports, weather, DEFAULT_CONFIG);
    expect(d.periodStart).toBe('2026-12-01');
    expect(d.daysInPeriod).toBe(31);
  });
});
