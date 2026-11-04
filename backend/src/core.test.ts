import { describe, expect, it } from 'vitest';
import { ensureConfigDefaults, ensureSecrets, handleGet, handlePost, readConfig, seed } from './core';
import { createMemoryServices } from './memory';
import { call, errorCode, OWNER_PIN, setupServices, signIn } from './testkit';

const report = {
  businessDate: '2026-11-04',
  total: '148,320.00',
  bills: 52,
  uber: 4640,
  pickme: 'Rs 4,400/=',
};
const up = (submissionId: string, r: object = report, baseVersion: number | null = null) => ({
  submissionId,
  baseVersion,
  report: r,
});

describe('FR-BE-06 health', () => {
  it('returns no data and needs no auth', () => {
    const s = setupServices();
    expect(handleGet(s, { action: 'health' })).toEqual({
      ok: true,
      apiVersion: 1,
      serverTime: '2026-11-04T21:42:00+05:30',
    });
    expect(handleGet(s, {})).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('7.2 envelope', () => {
  it('rejects non-JSON, bad envelopes, unknown actions and old API versions', () => {
    const s = setupServices();
    expect(errorCode(handlePost(s, 'not json'))).toBe('VALIDATION_FAILED');
    expect(errorCode(handlePost(s, '{"action":"x"}'))).toBe('VALIDATION_FAILED');
    expect(errorCode(call(s, 'nope', {}))).toBe('NOT_FOUND');
    expect(errorCode(call(s, 'config.get', {}, { apiVersion: 2 }))).toBe('UNSUPPORTED_API_VERSION');
    const r = call(s, 'auth.verify', { pin: OWNER_PIN });
    expect(r).toMatchObject({ serverTime: '2026-11-04T21:42:00+05:30', apiVersion: 1 });
  });

  it('NFR-OBS-01 unexpected errors return a correlation ID that is in the Audit sheet', () => {
    const s = setupServices();
    const t = signIn(s);
    s.store.getReport = () => {
      throw new Error('Sheet unavailable');
    };
    const r = call(s, 'report.upsert', up('sub-err-0001'), { token: t });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatchObject({ code: 'INTERNAL', correlationId: 'sub-err-0001' });
      expect(s.store.audit.at(-1)).toMatchObject({
        event: 'error',
        detail: 'sub-err-0001 Sheet unavailable',
      });
    }
  });

  it('still answers when the audit log itself fails', () => {
    const s = setupServices();
    const t = signIn(s);
    s.store.readConfig = () => {
      throw 'boom';
    };
    s.store.appendAudit = () => {
      throw new Error('no audit');
    };
    const r = call(s, 'config.get', {}, { token: t });
    expect(r.ok === false && r.error.code).toBe('INTERNAL');
    expect(r.ok === false && r.error.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('FR-BE-02 report.upsert', () => {
  it('creates, then FR-REP-08 a repeated submissionId returns the original result and writes nothing', () => {
    const s = setupServices();
    const t = signIn(s);
    const a = call(s, 'report.upsert', up('sub-0000001'), { token: t });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.data.version).toBe(1);
    expect(a.data.report).toMatchObject({
      outletId: 'ALU-01',
      total: 148320,
      pickme: 4400,
      dayOfWeek: 'Wed',
      daysSinceOpening: 2,
      deliverySales: 9040,
      walkInSales: 139280,
      updatedByRole: 'Manager',
      updatedByDevice: 'Outlet phone',
      source: 'app',
    });
    const b = call(s, 'report.upsert', up('sub-0000001', { ...report, total: 1 }), { token: t });
    expect(b.ok && b.data).toEqual(a.data);
    expect(s.store.log.map((l) => l.result)).toEqual(['created', 'duplicate']);
    expect(s.store.reports.size).toBe(1);
  });

  it('FR-REP-10 detects version conflicts and returns the saved record', () => {
    const s = setupServices();
    const t = signIn(s);
    call(s, 'report.upsert', up('sub-0000001'), { token: t });
    const c = call(s, 'report.upsert', up('sub-0000002', { ...report, total: 20000 }, null), { token: t });
    expect(c.ok === false && c.error.code).toBe('CONFLICT');
    expect(c.ok === false && c.error.current?.version).toBe(1);
    const d = call(s, 'report.upsert', up('sub-0000003', { ...report, total: 150000 }, 1), { token: t });
    expect(d.ok && d.data.version).toBe(2);
    expect(d.ok && d.data.report.createdAt).toBe('2026-11-04T21:42:00+05:30');
    expect(s.store.log.map((l) => l.result)).toEqual(['created', 'rejected', 'updated']);
  });

  it('validates on the server (NFR-SEC-02)', () => {
    const s = setupServices();
    const t = signIn(s);
    const r = call(s, 'report.upsert', up('sub-0000001', { ...report, bills: 0 }), { token: t });
    expect(r.ok === false && r.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'bills', rule: 'billsRequired' }],
    });
    expect(errorCode(call(s, 'report.upsert', { submissionId: 'x' }, { token: t }))).toBe(
      'VALIDATION_FAILED',
    );
    expect(s.store.log.at(-1)).toMatchObject({ result: 'rejected', errorCode: 'VALIDATION_FAILED' });
  });

  it('FR-HIS-03 edit window: Manager blocked after 7 days, Owner allowed', () => {
    const s = setupServices('2026-11-13T10:00:00+05:30');
    seed(s);
    const m = signIn(s);
    const r = call(s, 'report.upsert', up('sub-0000001', { ...report, businessDate: '2026-11-03' }, 1), {
      token: m,
    });
    expect(errorCode(r)).toBe('EDIT_WINDOW_CLOSED');
    const o = signIn(s, OWNER_PIN, 'dev-o');
    const r2 = call(s, 'report.upsert', up('sub-0000002', { ...report, businessDate: '2026-11-03' }, 1), {
      token: o,
      deviceId: 'dev-o',
    });
    expect(r2.ok && r2.data.report.updatedByRole).toBe('Owner');
  });

  it('returns BUSY when the lock is not available', () => {
    const s = setupServices();
    const t = signIn(s);
    s.lock.failNext = true;
    expect(errorCode(call(s, 'report.upsert', up('sub-0000001'), { token: t }))).toBe('BUSY');
    expect(s.lock.held).toBe(false);
    expect(errorCode(call(s, 'report.upsert', up('sub-0000001'), { token: t }))).toBeNull();
  });

  it('releases the lock after an error', () => {
    const s = setupServices();
    const t = signIn(s);
    call(s, 'report.upsert', up('sub-0000001', { ...report, total: 'x' }), { token: t });
    expect(s.lock.held).toBe(false);
  });

  it('uses deviceId when the device has no name and handles a report without a date', () => {
    const s = setupServices();
    const t = signIn(s);
    const r = call(s, 'report.upsert', up('sub-0000001'), { token: t, deviceName: '' });
    expect(r.ok && r.data.report.updatedByDevice).toBe('dev-1');
    call(s, 'report.upsert', { submissionId: 'sub-0000002', baseVersion: null, report: null }, { token: t });
    expect(s.store.log.at(-1)).toMatchObject({ businessDate: '', result: 'rejected' });
  });

  it('a duplicate whose report has gone is processed again', () => {
    const s = setupServices();
    const t = signIn(s);
    call(s, 'report.upsert', up('sub-0000001'), { token: t });
    s.store.reports.clear();
    const r = call(s, 'report.upsert', up('sub-0000001'), { token: t });
    expect(r.ok && r.data.version).toBe(1);
  });
});

describe('report.get and report.list', () => {
  it('gets a report with its weather', () => {
    const s = setupServices();
    seed(s);
    s.store.putWeather({
      date: '2026-11-03',
      avgTempTrading: 28.1,
      maxTemp: 30.4,
      minTemp: 24.8,
      maxFeelsLike: 34.2,
      avgHumidityTrading: 82,
      rainTradingMm: 6.8,
      rainHoursTrading: 4,
      rainDayMm: 9.5,
      source: 'forecast',
      fetchedAt: 'x',
    });
    const t = signIn(s);
    const r = call(s, 'report.get', { businessDate: '2026-11-03' }, { token: t });
    expect(r.ok && r.data.report.source).toBe('whatsapp-backfill');
    expect(r.ok && r.data.weather.rainTradingMm).toBe(6.8);
    const none = call(s, 'report.get', { businessDate: '2026-11-04' }, { token: t });
    expect(none.ok && none.data).toEqual({ report: null, weather: null });
    expect(errorCode(call(s, 'report.get', {}, { token: t }))).toBe('VALIDATION_FAILED');

    const list = call(s, 'report.list', {}, { token: t });
    expect(list.ok && list.data.items.map((i: { businessDate: string }) => i.businessDate)).toEqual([
      '2026-11-03',
      '2026-11-02',
    ]);
    expect(list.ok && list.data.items[0].weather.rainTradingMm).toBe(6.8);
    expect(list.ok && list.data.items[1].weather).toBeNull();
    expect(list.ok && list.data.nextCursor).toBeNull();
    expect(errorCode(call(s, 'report.list', { from: 5 }, { token: t }))).toBe('VALIDATION_FAILED');
  });

  it('FR-HIS-01 Manager sees 60 days; Owner sees all, 30 per page', () => {
    const s = setupServices('2027-02-15T10:00:00+05:30');
    s.store.config.EDIT_WINDOW_DAYS = 400;
    const o = signIn(s, OWNER_PIN);
    for (let d = 0; d < 40; d++) {
      const date = new Date(Date.UTC(2026, 10, 2 + d)).toISOString().slice(0, 10);
      const r = call(
        s,
        'report.upsert',
        up(`sub-${String(d).padStart(8, '0')}`, { ...report, businessDate: date }),
        { token: o },
      );
      expect(r.ok).toBe(true);
    }
    const p1 = call(s, 'report.list', {}, { token: o });
    expect(p1.ok && p1.data.items).toHaveLength(30);
    expect(p1.ok && p1.data.nextCursor).toBe('30');
    const p2 = call(s, 'report.list', { cursor: '30' }, { token: o });
    expect(p2.ok && p2.data.items).toHaveLength(10);
    expect(p2.ok && p2.data.items.at(-1).businessDate).toBe('2026-11-02');
    const m = signIn(s, '111111', 'dev-m');
    const ml = call(s, 'report.list', {}, { token: m, deviceId: 'dev-m' });
    // 60 days back from 15 Feb is 17 Dec; reports run to 11 Dec
    expect(ml.ok && ml.data.items).toHaveLength(0);
  });
});

describe('dashboard and config (FR-DSH-01, FR-SET-03)', () => {
  it('dashboard is Owner only', () => {
    const s = setupServices();
    seed(s);
    const m = signIn(s);
    expect(errorCode(call(s, 'dashboard.summary', { month: '2026-11' }, { token: m }))).toBe('FORBIDDEN');
    expect(s.store.audit.at(-1)?.event).toBe('forbidden');
    const o = signIn(s, OWNER_PIN, 'dev-o');
    const d = call(s, 'dashboard.summary', { month: '2026-11' }, { token: o, deviceId: 'dev-o' });
    expect(d.ok && d.data.kpis.totalBills).toBe(128);
    expect(
      errorCode(call(s, 'dashboard.summary', { month: '2026-13' }, { token: o, deviceId: 'dev-o' })),
    ).toBe('VALIDATION_FAILED');
  });

  it('config.update is Owner only, validated and audited', () => {
    const s = setupServices();
    const o = signIn(s, OWNER_PIN);
    const r = call(s, 'config.update', { MONTHLY_TARGET: 4_500_000 }, { token: o });
    expect(r.ok && r.data.MONTHLY_TARGET).toBe(4_500_000);
    expect(s.store.audit.at(-1)?.event).toBe('config_update');
    const cleared = call(s, 'config.update', { MONTHLY_TARGET: null }, { token: o });
    expect(cleared.ok && cleared.data.MONTHLY_TARGET).toBeNull();
    const bad = call(s, 'config.update', { MONTHLY_TARGET: -1, PIN: 1 }, { token: o });
    expect(bad.ok === false && bad.error.details?.map((d) => d.field).sort()).toEqual([
      'MONTHLY_TARGET',
      'payload',
    ]);
    const m = signIn(s, '111111', 'dev-m');
    expect(errorCode(call(s, 'config.update', { MONTHLY_TARGET: 1 }, { token: m, deviceId: 'dev-m' }))).toBe(
      'FORBIDDEN',
    );
    const g = call(s, 'config.get', {}, { token: m, deviceId: 'dev-m' });
    expect(g.ok && g.data.OPENING_DATE).toBe('2026-11-02');
  });

  it('readConfig parses numbers and falls back to defaults', () => {
    const s = createMemoryServices();
    s.store.config = { EDIT_WINDOW_DAYS: '10', OUTLET_NAME: 'X', LATITUDE: '' };
    expect(readConfig(s)).toMatchObject({
      EDIT_WINDOW_DAYS: 10,
      OUTLET_NAME: 'X',
      LATITUDE: 6.4333,
      MONTHLY_TARGET: null,
    });
  });
});

describe('FR-BE-01 setup helpers and 8.6 seed', () => {
  it('are idempotent', () => {
    const s = createMemoryServices();
    ensureSecrets(s);
    const secret = s.props.get('TOKEN_SECRET');
    ensureSecrets(s);
    expect(s.props.get('TOKEN_SECRET')).toBe(secret);
    ensureConfigDefaults(s);
    s.store.config.MONTHLY_TARGET = 1;
    ensureConfigDefaults(s);
    expect(s.store.config.MONTHLY_TARGET).toBe(1);
    s.clock.now = Date.parse('2026-11-04T09:00:00+05:30');
    expect(seed(s)).toEqual(['2026-11-02', '2026-11-03']);
    expect(seed(s)).toEqual([]);
    const r = s.store.getReport('ALU-01', '2026-11-03');
    expect(r).toMatchObject({
      source: 'whatsapp-backfill',
      busyPeriods: ['After 9pm'],
      wxEvening: 'Light rain',
      version: 1,
    });
  });

  it('refuses invalid seed data', () => {
    const s = createMemoryServices();
    s.clock.now = Date.parse('2026-11-04T09:00:00+05:30');
    s.store.config = { OPENING_DATE: '2026-11-03' };
    expect(() => seed(s)).toThrow(/Seed 2026-11-02 invalid/);
  });
});
