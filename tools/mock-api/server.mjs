// Mock of the Apps Script API (REQUIREMENTS.md Section 7). See docs/adr/0007-mock-api-server.md.
// No dependencies. State is in memory. Test controls live under /__mock/*.
import { createServer } from 'node:http';
import { createHmac, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const API_VERSION = 1;
const TOKEN_SECRET = 'mock-only-secret';
const PIN_SALT = 'mock-only-salt';
const TOKEN_TTL_S = 30 * 24 * 3600;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const PAGE_SIZE = 30;
const MANAGER_HISTORY_DAYS = 60;
const COLOMBO_OFFSET_MIN = 330;

const hashPin = (pin) => createHash('sha256').update(`${PIN_SALT}:${pin}`).digest('hex');
const PIN_HASHES = { Manager: hashPin('111111'), Owner: hashPin('999999') };

export const PERIODS = ['Before 10am', '10am–12pm', '12pm–3pm', '3pm–6pm', '6pm–9pm', 'After 9pm'];
export const WEATHER = ['Sunny', 'Cloudy', 'Light rain', 'Heavy rain'];
export const CONDITIONS = [
  'Normal day', 'Public holiday', 'Poya day', 'School holiday', 'Local event / festival',
  'Power cut', 'Road closure / traffic', 'Promotion running', 'Delivery app issue', 'Short-staffed',
];

const MONEY = ['total', 'dineIn', 'takeaway', 'uber', 'pickme', 'cash', 'card', 'qr', 'discounts', 'comps', 'voids'];
const INTS = ['bills', 'uberOrders', 'pickmeOrders', 'foreignCustomers', 'staffOnDuty'];
const TEXT_LIMITS = { topItems: 200, stockOuts: 500, promotions: 200, feedback: 1000, comments: 1000, conditionsOther: 100 };
const WX = ['wxMorning', 'wxAfternoon', 'wxEvening', 'wxNight'];

const DEFAULT_CONFIG = {
  OUTLET_ID: 'ALU-01', OUTLET_NAME: 'Barista Aluthgama', OPENING_DATE: '2026-11-02',
  LATITUDE: 6.4333, LONGITUDE: 80.0, TRADE_START_HOUR: 7, TRADE_END_HOUR: 22,
  DATE_CUTOFF_HOUR: 12, EDIT_WINDOW_DAYS: 7, MONTHLY_TARGET: null, BENCHMARK_MONTHLY_AVG: 5720000,
};

const SEED = [
  { businessDate: '2026-11-02', total: 231874.9, bills: 82, uber: 0, pickme: 0,
    comments: 'Opening day. No Uber or PickMe orders; strong dine-in and takeaway sales.' },
  { businessDate: '2026-11-03', total: 129849.85, bills: 46, uber: 0, pickme: 1900,
    busyPeriods: ['After 9pm'], wxEvening: 'Light rain',
    comments: 'A few foreign customers in the morning. Customer traffic was low through the day; evening rain likely reduced turnout. Slightly busy at night, but sales were below expectations.' },
];

const SEED_WEATHER = {
  '2026-11-02': { date: '2026-11-02', avgTempTrading: 29.4, maxTemp: 31.2, minTemp: 25.1, maxFeelsLike: 35.8, avgHumidityTrading: 76, rainTradingMm: 0.4, rainHoursTrading: 2, rainDayMm: 3.1, source: 'forecast', fetchedAt: '2026-11-03T06:00:12+05:30' },
  '2026-11-03': { date: '2026-11-03', avgTempTrading: 28.1, maxTemp: 30.4, minTemp: 24.8, maxFeelsLike: 34.2, avgHumidityTrading: 82, rainTradingMm: 6.8, rainHoursTrading: 4, rainDayMm: 9.5, source: 'forecast', fetchedAt: '2026-11-04T06:00:09+05:30' },
};

// ---------- dates (Asia/Colombo, fixed +05:30) ----------
const pad = (n) => String(n).padStart(2, '0');
function colomboParts(ms) {
  const d = new Date(ms + COLOMBO_OFFSET_MIN * 60000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
const isoDate = (p) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;
const colomboIso = (ms) => { const p = colomboParts(ms); return `${isoDate(p)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}+05:30`; };
const dayNum = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000);
const fromDayNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOfWeek = (date) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// ---------- calculations (Phase 2: replaced by packages/shared/calc.ts) ----------
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
export function computed(r) {
  const deliverySales = (r.uber ?? 0) + (r.pickme ?? 0);
  return {
    avgBill: r.bills > 0 ? r.total / r.bills : null,
    deliverySales,
    deliveryShare: r.total > 0 ? deliverySales / r.total : null,
    walkInSales: r.total - deliverySales,
  };
}

// ---------- validation (Phase 2: replaced by the shared zod schema) ----------
export function parseMoney(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const s = v.replace(/^\s*rs\.?/i, '').replace(/\/=\s*$/, '').replace(/[\s,]/g, '');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

function validate(input, cfg, todayDate) {
  const details = [];
  const out = {};
  const bad = (field, rule) => details.push({ field, rule });
  const clean = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

  if (typeof input?.businessDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate) || Number.isNaN(Date.parse(input.businessDate))) bad('businessDate', 'date');
  else if (input.businessDate < cfg.OPENING_DATE) bad('businessDate', 'beforeOpening');
  else if (input.businessDate > todayDate) bad('businessDate', 'future');
  else out.businessDate = input.businessDate;

  for (const k of MONEY) {
    const req = ['total', 'uber', 'pickme'].includes(k);
    if (input[k] === undefined || input[k] === null || input[k] === '') { if (req) bad(k, 'required'); continue; }
    const n = parseMoney(input[k]);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) bad(k, 'money');
    else if (Math.round(n * 100) !== n * 100 && Math.abs(Math.round(n * 100) - n * 100) > 1e-6) bad(k, 'decimals');
    else out[k] = n;
  }
  for (const k of INTS) {
    if (input[k] === undefined || input[k] === null || input[k] === '') { if (k === 'bills') bad(k, 'required'); continue; }
    const n = Number(input[k]);
    if (!Number.isInteger(n) || n < 0 || n > 100_000) bad(k, 'integer');
    else out[k] = n;
  }
  if (out.total > 0 && out.bills !== undefined && out.bills < 1) bad('bills', 'billsRequired');
  for (const k of ['uber', 'pickme', 'dineIn', 'takeaway']) if (out[k] !== undefined && out.total !== undefined && out[k] > out.total) bad(k, 'exceedsTotal');
  if (out.uber !== undefined && out.pickme !== undefined && out.total !== undefined && out.uber + out.pickme > out.total) bad('pickme', 'deliveryExceedsTotal');

  if (input.busyPeriods !== undefined) {
    if (!Array.isArray(input.busyPeriods) || input.busyPeriods.some((p) => !PERIODS.includes(p))) bad('busyPeriods', 'enum'); else out.busyPeriods = [...new Set(input.busyPeriods)];
  }
  if (input.quietPeriod !== undefined && input.quietPeriod !== null) {
    if (!PERIODS.includes(input.quietPeriod)) bad('quietPeriod', 'enum');
    else if (out.busyPeriods?.includes(input.quietPeriod)) bad('quietPeriod', 'alsoBusy');
    else out.quietPeriod = input.quietPeriod;
  }
  for (const k of WX) if (input[k] !== undefined && input[k] !== null) { if (WEATHER.includes(input[k])) out[k] = input[k]; else bad(k, 'enum'); }
  if (input.conditions !== undefined) {
    if (!Array.isArray(input.conditions) || input.conditions.some((c) => !CONDITIONS.includes(c))) bad('conditions', 'enum'); else out.conditions = input.conditions;
  }
  for (const k of ['openTime', 'closeTime']) if (input[k]) { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(input[k])) out[k] = input[k]; else bad(k, 'time'); }
  for (const [k, max] of Object.entries(TEXT_LIMITS)) if (input[k] !== undefined && input[k] !== null) {
    const s = clean(input[k]);
    if (s.length > max) bad(k, 'maxLength'); else if (s) out[k] = s;
  }
  return { ok: details.length === 0, value: out, details };
}

// ---------- server state ----------
export function createMock() {
  let state;
  let clockOffsetMs = 0;
  let fixedNow = null;
  const controls = { failNext: [], latencyMs: 0, redirect: true };
  const echoes = new Map();
  const now = () => (fixedNow ?? Date.now()) + clockOffsetMs;

  function reset() {
    state = { config: { ...DEFAULT_CONFIG }, reports: new Map(), submissions: new Map(), weather: new Map(Object.entries(SEED_WEATHER)), log: [], audit: [], failures: new Map(), locked: new Map() };
    const t = Date.parse('2026-11-04T09:15:00+05:30');
    for (const s of SEED) writeReport({ ...s }, { role: 'Owner', deviceId: 'seed', deviceName: 'WhatsApp backfill', submissionId: `seed-${s.businessDate}`, source: 'whatsapp-backfill', at: t });
  }

  function writeReport(value, meta) {
    const key = value.businessDate;
    const prev = state.reports.get(key);
    const at = colomboIso(meta.at ?? now());
    const rec = {
      outletId: state.config.OUTLET_ID, ...value,
      dayOfWeek: dayOfWeek(key), daysSinceOpening: dayNum(key) - dayNum(state.config.OPENING_DATE),
      ...computed(value),
      version: (prev?.version ?? 0) + 1, createdAt: prev?.createdAt ?? at, updatedAt: at,
      updatedByRole: meta.role, updatedByDevice: meta.deviceName ?? meta.deviceId,
      lastSubmissionId: meta.submissionId, source: meta.source ?? 'app',
    };
    state.reports.set(key, rec);
    return rec;
  }

  // ---------- tokens ----------
  const b64u = (buf) => Buffer.from(buf).toString('base64url');
  const sign = (part) => createHmac('sha256', TOKEN_SECRET).update(part).digest('base64url');
  function issueToken(role, deviceId) {
    const exp = Math.floor(now() / 1000) + TOKEN_TTL_S;
    const part = b64u(JSON.stringify({ role, deviceId, ver: 1, exp }));
    return { token: `${part}.${sign(part)}`, expiresAt: colomboIso(exp * 1000) };
  }
  function checkToken(token, deviceId) {
    if (typeof token !== 'string' || !token.includes('.')) return { code: 'UNAUTHORIZED' };
    const [part, sig] = token.split('.');
    const exp = Buffer.from(sign(part)); const got = Buffer.from(sig ?? '');
    if (exp.length !== got.length || !timingSafeEqual(exp, got)) return { code: 'UNAUTHORIZED' };
    let p; try { p = JSON.parse(Buffer.from(part, 'base64url').toString()); } catch { return { code: 'UNAUTHORIZED' }; }
    if (p.deviceId !== deviceId) return { code: 'UNAUTHORIZED' };
    if (p.ver !== 1 || p.exp * 1000 <= now()) return { code: 'TOKEN_EXPIRED' };
    return { role: p.role };
  }

  const fail = (code, message, details) => ({ ok: false, error: { code, message, ...(details ? { details } : {}) } });
  const okData = (data) => ({ ok: true, data });
  const today = () => isoDate(colomboParts(now()));
  const audit = (event, deviceId, detail) => state.audit.push({ at: colomboIso(now()), event, deviceId, detail });

  // ---------- actions ----------
  const actions = {
    'auth.verify'(payload, env) {
      const dev = env.deviceId;
      const lockedUntil = state.locked.get(dev);
      if (lockedUntil && lockedUntil > now()) { audit('auth_fail', dev, 'locked'); return fail('LOCKED_OUT', 'Too many attempts.'); }
      const h = hashPin(String(payload?.pin ?? ''));
      const role = h === PIN_HASHES.Owner ? 'Owner' : h === PIN_HASHES.Manager ? 'Manager' : null;
      if (!role) {
        const f = (state.failures.get(dev) ?? []).filter((t) => t > now() - LOCK_WINDOW_MS);
        f.push(now()); state.failures.set(dev, f);
        audit('auth_fail', dev, `attempt ${f.length}`);
        if (f.length >= MAX_FAILURES) { state.locked.set(dev, now() + LOCK_WINDOW_MS); state.failures.delete(dev); audit('lockout', dev, '15 min'); }
        return fail('UNAUTHORIZED', 'Wrong PIN.');
      }
      state.failures.delete(dev);
      return okData({ role, ...issueToken(role, dev) });
    },

    'report.upsert'(payload, env, role) {
      const { submissionId, baseVersion = null, report } = payload ?? {};
      if (typeof submissionId !== 'string' || !submissionId) return fail('VALIDATION_FAILED', 'Missing submissionId.', [{ field: 'submissionId', rule: 'required' }]);
      const dup = state.submissions.get(submissionId);
      if (dup) { logSub(submissionId, report?.businessDate, role, env, 'duplicate'); return okData(dup); }
      const v = validate(report, state.config, today());
      if (!v.ok) { logSub(submissionId, report?.businessDate, role, env, 'rejected', 'VALIDATION_FAILED'); return fail('VALIDATION_FAILED', 'Fix the highlighted fields.', v.details); }
      const date = v.value.businessDate;
      if (role === 'Manager' && dayNum(today()) - dayNum(date) > state.config.EDIT_WINDOW_DAYS) {
        logSub(submissionId, date, role, env, 'rejected', 'EDIT_WINDOW_CLOSED');
        return fail('EDIT_WINDOW_CLOSED', 'Reports older than the edit window can only be changed by the owner.');
      }
      const cur = state.reports.get(date);
      if ((cur?.version ?? null) !== baseVersion) {
        logSub(submissionId, date, role, env, 'rejected', 'CONFLICT');
        return { ok: false, error: { code: 'CONFLICT', message: 'Changed on another device.', current: cur ?? null } };
      }
      const rec = writeReport(v.value, { role, deviceId: env.deviceId, deviceName: env.deviceName, submissionId });
      const result = { report: rec, version: rec.version };
      state.submissions.set(submissionId, result);
      logSub(submissionId, date, role, env, cur ? 'updated' : 'created');
      return okData(result);
    },

    'report.get'(payload) {
      const d = payload?.businessDate;
      return okData({ report: state.reports.get(d) ?? null, weather: state.weather.get(d) ?? null });
    },

    'report.list'(payload, _env, role) {
      let { from, to, cursor } = payload ?? {};
      from = from ?? state.config.OPENING_DATE; to = to ?? today();
      if (role === 'Manager') { const min = fromDayNum(dayNum(today()) - MANAGER_HISTORY_DAYS); if (from < min) from = min; }
      const all = [...state.reports.values()].filter((r) => r.businessDate >= from && r.businessDate <= to).sort((a, b) => b.businessDate.localeCompare(a.businessDate));
      const start = cursor ? Number(cursor) : 0;
      const items = all.slice(start, start + PAGE_SIZE).map((r) => ({ ...r, weather: state.weather.get(r.businessDate) ?? null }));
      return okData({ items, nextCursor: start + PAGE_SIZE < all.length ? String(start + PAGE_SIZE) : null });
    },

    'dashboard.summary'(payload, _env, role) {
      if (role !== 'Owner') { audit('forbidden', _env.deviceId, 'dashboard.summary'); return fail('FORBIDDEN', 'Owner only.'); }
      const month = payload?.month;
      if (!/^\d{4}-\d{2}$/.test(month ?? '')) return fail('VALIDATION_FAILED', 'Bad month.', [{ field: 'month', rule: 'format' }]);
      return okData(summary(month));
    },

    'config.get'() { return okData(publicConfig()); },

    'config.update'(payload, env, role) {
      if (role !== 'Owner') { audit('forbidden', env.deviceId, 'config.update'); return fail('FORBIDDEN', 'Owner only.'); }
      const details = [];
      for (const k of ['MONTHLY_TARGET', 'BENCHMARK_MONTHLY_AVG']) if (k in (payload ?? {})) {
        const v = payload[k];
        if (v === null && k === 'MONTHLY_TARGET') state.config[k] = null;
        else if (typeof v === 'number' && v >= 0 && v <= 1e9) state.config[k] = v;
        else details.push({ field: k, rule: 'money' });
      }
      if (details.length) return fail('VALIDATION_FAILED', 'Bad value.', details);
      audit('config_update', env.deviceId, JSON.stringify(payload));
      return okData(publicConfig());
    },
  };

  function publicConfig() { return { ...state.config }; }

  function logSub(submissionId, businessDate, role, env, result, errorCode = '') {
    state.log.push({ loggedAt: colomboIso(now()), submissionId, action: 'report.upsert', businessDate, role, deviceId: env.deviceId, deviceName: env.deviceName, appVersion: env.appVersion, result, errorCode });
  }

  function summary(month) {
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`; const last = `${month}-${pad(daysInMonth(y, m))}`;
    const periodStart = first < state.config.OPENING_DATE ? state.config.OPENING_DATE : first;
    const rows = [...state.reports.values()].filter((r) => r.businessDate >= periodStart && r.businessDate <= last).sort((a, b) => a.businessDate.localeCompare(b.businessDate));
    const mtd = rows.reduce((s, r) => s + r.total, 0);
    const bills = rows.reduce((s, r) => s + r.bills, 0);
    const delivery = rows.reduce((s, r) => s + (r.uber ?? 0) + (r.pickme ?? 0), 0);
    const totalDays = periodStart > last ? 0 : dayNum(last) - dayNum(periodStart) + 1;
    const latest = rows.at(-1)?.businessDate ?? null;
    const daysElapsed = latest ? dayNum(latest) - dayNum(periodStart) + 1 : 0;
    const target = state.config.MONTHLY_TARGET;
    const daysRemaining = latest ? dayNum(last) - dayNum(latest) : totalDays;
    const series = rows.map((r, i) => {
      const win = rows.filter((x) => dayNum(x.businessDate) > dayNum(r.businessDate) - 7 && x.businessDate <= r.businessDate);
      void i;
      return { date: r.businessDate, total: r.total, bills: r.bills, avgBill: r.bills ? r.total / r.bills : null, rainMm: state.weather.get(r.businessDate)?.rainTradingMm ?? null, avgTemp: state.weather.get(r.businessDate)?.avgTempTrading ?? null, ma7: win.reduce((s, x) => s + x.total, 0) / win.length, dineIn: r.dineIn ?? null, takeaway: r.takeaway ?? null, uber: r.uber, pickme: r.pickme };
    });
    const wk = {};
    for (const r of rows) { const d = dayOfWeek(r.businessDate); (wk[d] ??= { weekday: d, n: 0, sales: 0, bills: 0 }); wk[d].n++; wk[d].sales += r.total; wk[d].bills += r.bills; }
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((d) => wk[d]).map((d) => ({ weekday: d, reports: wk[d].n, avgSales: wk[d].sales / wk[d].n, avgBills: wk[d].bills / wk[d].n, avgBill: wk[d].bills ? wk[d].sales / wk[d].bills : null }));
    const remaining = target == null ? null : target - mtd;
    return {
      month, periodStart, periodEnd: last, latestReportDate: latest, daysElapsed, daysInPeriod: totalDays,
      kpis: {
        mtdSales: mtd, monthlyTarget: target, achievement: target ? mtd / target : null,
        projectedMonthEnd: daysElapsed ? (mtd / daysElapsed) * totalDays : null,
        requiredDaily: remaining == null ? null : remaining <= 0 ? 0 : daysRemaining > 0 ? remaining / daysRemaining : null,
        targetReached: remaining != null && remaining <= 0,
        avgBill: bills ? mtd / bills : null, totalBills: bills, deliveryShare: mtd ? delivery / mtd : null,
        targetDailyAvg: target && totalDays ? target / totalDays : null,
        benchmarkDailyAvg: state.config.BENCHMARK_MONTHLY_AVG / daysInMonth(y, m),
      },
      series, weekdays,
    };
  }

  // ---------- HTTP ----------
  async function handleApi(raw) {
    let env;
    try { env = JSON.parse(raw); } catch { return { ...fail('VALIDATION_FAILED', 'Body is not JSON.'), apiVersion: API_VERSION }; }
    const forced = controls.failNext.shift();
    if (forced?.code) return fail(forced.code, `Forced ${forced.code}`);
    if (env.apiVersion !== API_VERSION) return fail('UNSUPPORTED_API_VERSION', 'Update the app.');
    const fn = actions[env.action];
    if (!fn) return fail('NOT_FOUND', `Unknown action ${env.action}.`);
    let role = null;
    if (env.action !== 'auth.verify') {
      const t = checkToken(env.token, env.deviceId);
      if (t.code) return fail(t.code, 'Sign in again.');
      role = t.role;
    }
    try { return fn(env.payload, { ...env, deviceName: env.deviceName ?? env.payload?.deviceName }, role); }
    catch (e) { const id = env.payload?.submissionId ?? randomUUID(); audit('error', env.deviceId, `${id} ${e.message}`); return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong.', correlationId: id } }; }
  }

  const finish = (body) => ({ ...body, serverTime: colomboIso(now()), apiVersion: API_VERSION });

  async function handler(req, res) {
    const url = new URL(req.url, 'http://x');
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8', ...headers });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    // Apps Script does not answer CORS preflight; neither do we, so a non-simple request fails in tests too.
    if (req.method === 'OPTIONS') { res.writeHead(405); return res.end(); }

    const body = await new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => resolve(b)); });

    if (url.pathname.startsWith('/__mock/')) {
      const p = body ? JSON.parse(body) : {};
      switch (url.pathname.slice(8)) {
        case 'reset': reset(); clockOffsetMs = 0; fixedNow = null; controls.failNext = []; controls.latencyMs = 0; return send(200, { ok: true });
        case 'clock': fixedNow = p.now ? Date.parse(p.now) : null; clockOffsetMs = p.offsetDays ? p.offsetDays * 86400000 : 0; return send(200, { ok: true, now: colomboIso(now()) });
        case 'fail': controls.failNext.push(...Array(p.times ?? 1).fill({ code: p.code ?? null, drop: !!p.drop })); return send(200, { ok: true });
        case 'latency': controls.latencyMs = p.ms ?? 0; return send(200, { ok: true });
        case 'redirect': controls.redirect = !!p.on; return send(200, { ok: true });
        case 'config': Object.assign(state.config, p); return send(200, { ok: true });
        case 'state': return send(200, { reports: [...state.reports.values()], log: state.log, audit: state.audit, config: state.config });
        default: return send(404, { ok: false });
      }
    }

    if (url.pathname.startsWith('/__echo/')) {
      const out = echoes.get(url.pathname.slice(8)); echoes.delete(url.pathname.slice(8));
      return out ? send(200, out) : send(404, { ok: false });
    }

    if (controls.latencyMs) await new Promise((r) => setTimeout(r, controls.latencyMs));

    if (req.method === 'GET') {
      if (url.searchParams.get('action') === 'health') return send(200, { ok: true, apiVersion: API_VERSION, serverTime: colomboIso(now()) });
      return send(200, finish(fail('NOT_FOUND', 'Unknown action.')));
    }
    if (req.method !== 'POST') return send(405, undefined);

    if (controls.failNext[0]?.drop) { controls.failNext.shift(); req.socket.destroy(); return; }
    const out = finish(await handleApi(body));
    if (controls.redirect) {
      const id = randomUUID(); echoes.set(id, out);
      return send(302, undefined, { Location: `/__echo/${id}` });
    }
    return send(200, out);
  }

  reset();
  return { handler, reset, get state() { return state; } };
}

export function start(port = Number(process.env.PORT ?? 8787)) {
  const mock = createMock();
  const server = createServer((req, res) => mock.handler(req, res).catch((e) => { res.writeHead(500); res.end(String(e)); }));
  return new Promise((resolve) => server.listen(port, () => resolve({ server, mock, port: server.address().port })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  start().then(({ port }) => console.log(`Mock API on http://localhost:${port}  (Manager PIN 111111, Owner PIN 999999)`));
}
