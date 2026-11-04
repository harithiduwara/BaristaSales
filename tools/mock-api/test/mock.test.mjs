// Self-test: the mock honours the Section 7 contract the E2E suite relies on.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../server.mjs';

let srv, base;
before(async () => { const s = await start(0); srv = s.server; base = `http://localhost:${s.port}`; });
after(() => srv.close());
beforeEach(async () => { await ctl('reset'); await ctl('clock', { now: '2026-11-04T21:42:00+05:30' }); });

const ctl = (name, body = {}) => fetch(`${base}/__mock/${name}`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
async function call(action, payload, { token, deviceId = 'dev-1', apiVersion = 1 } = {}) {
  const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ apiVersion, action, token, deviceId, appVersion: '0.0.0-test', payload }) });
  assert.equal(r.status, 200, 'redirect followed, final status 200');
  return r.json();
}
const signIn = async (pin = '111111', deviceId = 'dev-1') => (await call('auth.verify', { pin, deviceName: 'Test' }, { deviceId })).data.token;
const base3Nov = { businessDate: '2026-11-04', total: '129,849.85', bills: 46, uber: 0, pickme: 'Rs 1900/=' };

test('FR-BE-06 health needs no auth and returns no data', async () => {
  const j = await (await fetch(`${base}?action=health`)).json();
  assert.deepEqual(Object.keys(j).sort(), ['apiVersion', 'ok', 'serverTime']);
});

test('C-02 preflight is not answered', async () => {
  const r = await fetch(base, { method: 'OPTIONS' });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('FR-AUTH-02 PINs map to roles', async () => {
  assert.equal((await call('auth.verify', { pin: '111111' })).data.role, 'Manager');
  assert.equal((await call('auth.verify', { pin: '999999' })).data.role, 'Owner');
  assert.equal((await call('auth.verify', { pin: '123456' })).error.code, 'UNAUTHORIZED');
});

test('FR-AUTH-03 five failures lock out, even a correct PIN', async () => {
  for (let i = 0; i < 5; i++) await call('auth.verify', { pin: '000000' });
  assert.equal((await call('auth.verify', { pin: '111111' })).error.code, 'LOCKED_OUT');
  assert.equal((await call('auth.verify', { pin: '111111' }, { deviceId: 'other' })).ok, true, 'per device');
});

test('FR-AUTH-02 token required, bound to device, expires', async () => {
  assert.equal((await call('config.get', {})).error.code, 'UNAUTHORIZED');
  const t = await signIn();
  assert.equal((await call('config.get', {}, { token: t, deviceId: 'dev-2' })).error.code, 'UNAUTHORIZED');
  await ctl('clock', { now: '2026-12-05T21:42:00+05:30' });
  assert.equal((await call('config.get', {}, { token: t })).error.code, 'TOKEN_EXPIRED');
});

test('FR-REP-08 upsert is idempotent on submissionId; V-02 parses money input', async () => {
  const token = await signIn();
  const a = await call('report.upsert', { submissionId: 's1', baseVersion: null, report: base3Nov }, { token });
  assert.equal(a.ok, true);
  assert.equal(a.data.report.pickme, 1900);
  assert.equal(a.data.report.total, 129849.85);
  const b = await call('report.upsert', { submissionId: 's1', baseVersion: null, report: { ...base3Nov, total: 1 } }, { token });
  assert.deepEqual(b.data, a.data);
  const st = await ctl('state');
  assert.equal(st.reports.filter((r) => r.businessDate === '2026-11-04').length, 1);
  assert.deepEqual(st.log.map((l) => l.result), ['created', 'duplicate']);
});

test('FR-REP-10 version conflict returns the current record', async () => {
  const token = await signIn();
  const c = await call('report.upsert', { submissionId: 's2', baseVersion: null, report: { ...base3Nov, businessDate: '2026-11-03' } }, { token });
  assert.equal(c.error.code, 'CONFLICT');
  assert.equal(c.error.current.version, 1);
  const ok = await call('report.upsert', { submissionId: 's3', baseVersion: 1, report: { ...base3Nov, businessDate: '2026-11-03' } }, { token });
  assert.equal(ok.data.version, 2);
});

test('FR-HIS-03 edit window: Manager blocked at 10 days, Owner allowed', async () => {
  await ctl('clock', { now: '2026-11-13T10:00:00+05:30' });
  const m = await signIn('111111');
  const r = await call('report.upsert', { submissionId: 's4', baseVersion: 1, report: { ...base3Nov, businessDate: '2026-11-03' } }, { token: m });
  assert.equal(r.error.code, 'EDIT_WINDOW_CLOSED');
  const o = await signIn('999999', 'dev-o');
  const r2 = await call('report.upsert', { submissionId: 's5', baseVersion: 1, report: { ...base3Nov, businessDate: '2026-11-03' } }, { token: o, deviceId: 'dev-o' });
  assert.equal(r2.ok, true);
});

test('8.2 validation rules reported per field', async () => {
  const token = await signIn();
  const r = await call('report.upsert', { submissionId: 's6', baseVersion: null, report: { businessDate: '2026-11-05', total: 100, bills: 0, uber: 80, pickme: 30, busyPeriods: ['After 9pm'], quietPeriod: 'After 9pm' } }, { token });
  const rules = r.error.details.map((d) => `${d.field}:${d.rule}`).sort();
  assert.deepEqual(rules, ['bills:billsRequired', 'businessDate:future', 'pickme:deliveryExceedsTotal', 'quietPeriod:alsoBusy']);
});

test('FR-DSH-01 dashboard is Owner only and computes KPIs from seed', async () => {
  const m = await signIn('111111');
  assert.equal((await call('dashboard.summary', { month: '2026-11' }, { token: m })).error.code, 'FORBIDDEN');
  const o = await signIn('999999', 'dev-o');
  await call('config.update', { MONTHLY_TARGET: 4500000 }, { token: o, deviceId: 'dev-o' });
  const d = (await call('dashboard.summary', { month: '2026-11' }, { token: o, deviceId: 'dev-o' })).data;
  assert.equal(d.periodStart, '2026-11-02');
  assert.equal(d.daysElapsed, 2);
  assert.equal(d.daysInPeriod, 29);
  assert.equal(d.kpis.totalBills, 128);
  assert.ok(Math.abs(d.kpis.mtdSales - 361724.75) < 1e-6);
  assert.ok(Math.abs(d.kpis.projectedMonthEnd - (361724.75 / 2) * 29) < 1e-6);
  assert.ok(Math.abs(d.kpis.requiredDaily - (4500000 - 361724.75) / 27) < 1e-6);
});

test('7.4 forced BUSY and unsupported apiVersion', async () => {
  await ctl('fail', { code: 'BUSY' });
  assert.equal((await call('config.get', {})).error.code, 'BUSY');
  assert.equal((await call('config.get', {}, { apiVersion: 2 })).error.code, 'UNSUPPORTED_API_VERSION');
});
