import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeServer, NOW, type FakeServer } from '../test/fakeServer';
import { signedIn } from '../test/session';
import { ApiCallError, callApi, checkHealth } from './api';
import { loadSession, saveDevice, session, signOut } from './session';
import {
  backoff,
  outboxState,
  processOutbox,
  refreshOutboxState,
  removeFromOutbox,
  retryItem,
  submitReport,
  authLost,
} from './outbox';
import { db, draftKey, logSync, recentSync } from './db';
import { emptyForm, reportToForm } from './formModel';
import { getDashboard, getReport, last7, listReports } from './reports';
import { parseRoute } from '../router';
import { t, tDynamic } from '../i18n';
import type { Report } from '@aluthgama/shared';

let server: FakeServer;
const report: Report = { businessDate: '2026-11-04', total: 148320, bills: 52, uber: 4640, pickme: 4400 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  server = installFakeServer();
  session.set({ loaded: false, deviceId: null, deviceName: null, token: null, role: null, expiresAt: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('7.1 api client', () => {
  it('sends a CORS simple request (C-02) with the envelope', async () => {
    await saveDevice('Test phone');
    await expect(callApi('config.get', {})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const [url, init] = server.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8787');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
    expect(init.credentials).toBe('omit');
    const env = JSON.parse(String(init.body));
    expect(env).toMatchObject({
      apiVersion: 1,
      action: 'config.get',
      deviceName: 'Test phone',
      appVersion: '0.1.0-test',
    });
    expect(env.deviceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps network failures and classifies errors', async () => {
    server.offline = true;
    const e = (await callApi('config.get', {}).catch((x: unknown) => x)) as ApiCallError;
    expect(e).toBeInstanceOf(ApiCallError);
    expect(e.isNetwork && e.retryable).toBe(true);
    expect(new ApiCallError('BUSY', '').retryable).toBe(true);
    expect(new ApiCallError('CONFLICT', '').retryable).toBe(false);
    expect(new ApiCallError('TOKEN_EXPIRED', '').isAuth).toBe(true);
  });

  it('signs out when the server rejects the token, keeping the device', async () => {
    await signedIn(server);
    expect(session.get().role).toBe('Manager');
    server.s.props.set('TOKEN_VERSION', '99');
    await expect(callApi('config.get', {})).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(session.get()).toMatchObject({ token: null, deviceName: 'Test phone' });
  });

  it('checks health', async () => {
    expect(await checkHealth()).toBe(true);
    server.offline = true;
    expect(await checkHealth()).toBe(false);
  });
});

describe('session (FR-AUTH-01, -04)', () => {
  it('persists device and token, and drops an expired token', async () => {
    await signedIn(server);
    const s = await loadSession(NOW);
    expect(s).toMatchObject({ loaded: true, deviceName: 'Test phone', role: 'Manager' });
    const later = await loadSession(NOW + 31 * 86_400_000);
    expect(later.token).toBeNull();
    await signOut();
    expect((await loadSession(NOW)).token).toBeNull();
  });
});

describe('outbox (FR-REP-08, FR-REP-09, NFR-REL-01)', () => {
  beforeEach(async () => {
    await signedIn(server);
  });

  it('backoff is 5 s, 15 s, 60 s, then 5 min', () => {
    expect([1, 2, 3, 4, 9].map(backoff)).toEqual([5000, 15000, 60000, 300000, 300000]);
  });

  it('sends straight away when online and clears the draft', async () => {
    await (
      await db()
    ).put('drafts', {
      key: draftKey('2026-11-04'),
      businessDate: '2026-11-04',
      values: emptyForm('2026-11-04'),
      baseVersion: null,
      updatedAt: NOW,
    });
    const r = await submitReport(report, null);
    expect(r.outcome.kind).toBe('sent');
    expect(outboxState.get().items).toHaveLength(0);
    expect(await (await db()).get('drafts', draftKey('2026-11-04'))).toBeUndefined();
    expect((await (await db()).get('reports', '2026-11-04'))?.version).toBe(1);
    expect((await recentSync())[0]).toMatchObject({ result: 'created' });
  });

  it('keeps the report when offline, then sends it once', async () => {
    server.offline = true;
    const r = await submitReport(report, null);
    expect(r.outcome.kind).toBe('queued');
    expect(outboxState.get()).toMatchObject({ waiting: 1, failed: 0 });
    const item = outboxState.get().items[0];
    expect(item).toMatchObject({ status: 'waiting', attempts: 1, nextAttemptAt: NOW + 5000 });
    // not due yet
    server.offline = false;
    await processOutbox();
    expect(outboxState.get().waiting).toBe(1);
    vi.setSystemTime(NOW + 5000);
    await processOutbox();
    expect(outboxState.get().waiting).toBe(0);
    expect(server.s.store.log.filter((l) => l.result === 'created')).toHaveLength(1);
  });

  it('replaces an older unsent copy for the same date', async () => {
    server.offline = true;
    await submitReport(report, null);
    await submitReport({ ...report, total: 150000 }, null);
    expect(outboxState.get().items).toHaveLength(1);
    expect(outboxState.get().items[0]?.report.total).toBe(150000);
  });

  it('marks non-retryable errors as failed, and retryItem/removeFromOutbox work', async () => {
    const r = await submitReport({ ...report, businessDate: '2026-11-03' }, null);
    expect(r.outcome.kind).toBe('rejected');
    expect(r.outcome.kind === 'rejected' && r.outcome.error.code).toBe('CONFLICT');
    expect(outboxState.get()).toMatchObject({ failed: 1 });
    await retryItem(r.submissionId);
    expect(outboxState.get().items[0]?.attempts).toBe(2);
    await retryItem('missing');
    await removeFromOutbox(r.submissionId);
    expect(outboxState.get().items).toHaveLength(0);
  });

  it('waits for sign-in on an auth error without counting an attempt', async () => {
    server.s.props.set('TOKEN_VERSION', '99');
    const before = authLost.get();
    const r = await submitReport(report, null);
    expect(r.outcome.kind).toBe('queued');
    expect(authLost.get()).toBe(before + 1);
    expect(outboxState.get().items[0]).toMatchObject({ attempts: 0, nextAttemptAt: 0, status: 'waiting' });
  });

  it('BUSY is retried with backoff', async () => {
    server.s.lock.failNext = true;
    const r = await submitReport(report, null);
    expect(r.outcome.kind === 'queued' && r.outcome.error.code).toBe('BUSY');
    await processOutbox({ force: true });
    expect(outboxState.get().items).toHaveLength(0);
  });
});

describe('reports cache (NFR-OFF-01)', () => {
  beforeEach(async () => {
    await signedIn(server, '999999');
  });
  it('lists, gets and falls back to the cache offline', async () => {
    const l = await listReports('2026-11-01', '2026-11-30');
    expect(l.items.map((i) => i.businessDate)).toEqual(['2026-11-03', '2026-11-02']);
    expect((await getReport('2026-11-03')).report?.total).toBe(129849.85);
    expect((await getReport('2026-11-05')).report).toBeNull();
    expect((await getDashboard('2026-11'))?.data.kpis.totalBills).toBe(128);
    server.offline = true;
    expect((await listReports('2026-11-01', '2026-11-30')).fromCache).toBe(true);
    expect((await getReport('2026-11-03')).fromCache).toBe(true);
    expect((await getDashboard('2026-11'))?.fromCache).toBe(true);
    expect(await getDashboard('2026-10')).toBeNull();
    expect((await last7('2026-11-04')).length).toBe(2);
  });
  it('rethrows non-network errors when nothing is cached', async () => {
    server.s.props.set('TOKEN_VERSION', '99');
    await expect(listReports('2026-11-01', '2026-11-30')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    await expect(getReport('2026-11-03')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('sync log keeps the last 50 (FR-SET-02)', () => {
  it('trims', async () => {
    for (let i = 0; i < 55; i++) await logSync({ at: i, action: 'x', result: 'r', errorCode: '' });
    const log = await recentSync();
    expect(log).toHaveLength(50);
    expect(log[0]?.at).toBe(54);
  });
});

describe('form model, router, i18n', () => {
  it('maps a saved report to form values', () => {
    const f = reportToForm({ ...report, busyPeriods: ['After 9pm'], comments: 'Hi', foreignCustomers: 3 });
    expect(f).toMatchObject({
      total: '148,320.00',
      bills: '52',
      busyPeriods: ['After 9pm'],
      comments: 'Hi',
      foreignCustomers: '3',
      dineIn: '',
    });
  });
  it('parses routes', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/report/2026-11-03/3')).toEqual({ name: 'wizard', date: '2026-11-03', step: 3 });
    expect(parseRoute('/report/new/9')).toEqual({ name: 'wizard', date: null, step: 1 });
    expect(parseRoute('/saved/2026-11-03')).toEqual({ name: 'saved', date: '2026-11-03' });
    expect(parseRoute('/saved/x')).toEqual({ name: 'notFound' });
    expect(parseRoute('/conflict/2026-11-03')).toEqual({ name: 'conflict', date: '2026-11-03' });
    expect(parseRoute('/conflict/x').name).toBe('notFound');
    expect(parseRoute('/view/2026-11-03')).toEqual({ name: 'view', date: '2026-11-03' });
    expect(parseRoute('/view/').name).toBe('notFound');
    expect(parseRoute('/history')).toEqual({ name: 'history' });
    expect(parseRoute('/settings')).toEqual({ name: 'settings' });
    expect(parseRoute('/nope')).toEqual({ name: 'notFound' });
  });
  it('fills placeholders and falls back', () => {
    expect(t('success.saved', { date: 'Tue 3 Nov' })).toBe('Report for Tue 3 Nov saved.');
    expect(t('app.version')).toBe('Version {version}');
    expect(tDynamic('rule.nope', 'rule.unknown')).toBe('Check this value.');
  });
});

it('refreshOutboxState counts statuses', async () => {
  await refreshOutboxState();
  expect(outboxState.get()).toEqual({ waiting: 0, failed: 0, items: [] });
});
