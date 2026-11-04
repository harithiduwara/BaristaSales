// API core (Section 7, FR-BE-02, FR-BE-06). No Apps Script calls here: only the ports in ports.ts.
import { z } from 'zod';
import {
  ACTION_ROLES,
  API_VERSION,
  DEFAULT_CONFIG,
  HISTORY_PAGE_SIZE,
  MANAGER_HISTORY_DAYS,
  SEED_REPORTS,
  addDays,
  canEditDate,
  colomboIso,
  computeMetrics,
  dashboardSummary,
  daysBetween,
  todayColombo,
  validateReport,
  weekday,
  type ActionName,
  type Actions,
  type ApiError,
  type ApiResponse,
  type Config,
  type ErrorCode,
  type FieldIssue,
  type HealthResponse,
  type Report,
  type ReportRecord,
  type Role,
} from '@aluthgama/shared';
import { clearFailures, isLockedOut, issueToken, recordFailure, roleForPin, verifyToken } from './auth';
import type { Services, SubmissionLogRow } from './ports';

export const LOCK_TIMEOUT_MS = 30_000;

class ApiFailure extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly extra: Partial<ApiError> = {},
  ) {
    super(message);
  }
}

// ---------- config ----------

const CONFIG_NUMBERS: (keyof Config)[] = [
  'LATITUDE',
  'LONGITUDE',
  'TRADE_START_HOUR',
  'TRADE_END_HOUR',
  'DATE_CUTOFF_HOUR',
  'EDIT_WINDOW_DAYS',
  'MONTHLY_TARGET',
  'BENCHMARK_MONTHLY_AVG',
];

/** Config sheet values with defaults for anything missing or blank. */
export function readConfig(s: Services): Config {
  const raw = s.store.readConfig();
  const cfg: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    const v = raw[key];
    if (v === undefined || v === null || v === '') {
      if (key === 'MONTHLY_TARGET' && key in raw) cfg[key] = null;
      continue;
    }
    cfg[key] = CONFIG_NUMBERS.includes(key) ? Number(v) : String(v);
  }
  return cfg as unknown as Config;
}

// ---------- envelope ----------

const envelopeSchema = z.object({
  apiVersion: z.number(),
  action: z.string(),
  token: z.string().optional(),
  deviceId: z.string().min(1).max(64),
  deviceName: z.string().max(60).optional(),
  appVersion: z.string().max(64).default(''),
  payload: z.unknown().default({}),
});
type Envelope = z.infer<typeof envelopeSchema>;

interface Ctx {
  s: Services;
  env: Envelope;
  role: Role | null;
  config: Config;
  today: string;
}

const audit = (
  s: Services,
  event: Parameters<Services['store']['appendAudit']>[0]['event'],
  deviceId: string,
  detail: string,
) => s.store.appendAudit({ at: colomboIso(s.now()), event, deviceId, detail });

// ---------- actions ----------

type Handler<A extends ActionName> = (ctx: Ctx, payload: unknown) => Actions[A]['data'];

const authPayload = z.object({ pin: z.string(), deviceName: z.string().max(60).default('') });

const handlers: { [A in ActionName]: Handler<A> } = {
  'auth.verify'({ s, env }, payload) {
    if (isLockedOut(s, env.deviceId)) {
      audit(s, 'auth_fail', env.deviceId, 'attempt while locked out');
      throw new ApiFailure('LOCKED_OUT', 'Too many attempts. Try again in 15 minutes.');
    }
    const p = authPayload.safeParse(payload);
    const role = p.success ? roleForPin(s, p.data.pin) : null;
    if (!role) {
      const f = recordFailure(s, env.deviceId);
      audit(s, 'auth_fail', env.deviceId, `attempt ${f.attempts}`);
      if (f.lockedOut) audit(s, 'lockout', env.deviceId, '15 minutes');
      throw new ApiFailure('UNAUTHORIZED', 'Wrong PIN.');
    }
    clearFailures(s, env.deviceId);
    const t = issueToken(s, role, env.deviceId);
    return { role, token: t.token, expiresAt: colomboIso(t.expiresAt) };
  },

  'report.upsert'(ctx, payload) {
    const p = z
      .object({
        submissionId: z.string().min(8).max(64),
        baseVersion: z.number().int().nullable(),
        report: z.unknown(),
      })
      .safeParse(payload);
    if (!p.success)
      throw new ApiFailure('VALIDATION_FAILED', 'Bad request.', {
        details: [{ field: 'payload', rule: 'shape' }],
      });
    return upsertLocked(ctx, p.data);
  },

  'report.get'({ s, config }, payload) {
    const p = z.object({ businessDate: z.string() }).safeParse(payload);
    if (!p.success)
      throw new ApiFailure('VALIDATION_FAILED', 'Bad request.', {
        details: [{ field: 'businessDate', rule: 'date' }],
      });
    return {
      report: s.store.getReport(config.OUTLET_ID, p.data.businessDate),
      weather: s.store.getWeather(p.data.businessDate),
    };
  },

  'report.list'({ s, role, config, today }, payload) {
    const p = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        cursor: z.string().nullable().optional(),
      })
      .safeParse(payload ?? {});
    if (!p.success) throw new ApiFailure('VALIDATION_FAILED', 'Bad request.');
    let from = p.data.from ?? config.OPENING_DATE;
    const to = p.data.to ?? today;
    if (role === 'Manager') {
      const min = addDays(today, -MANAGER_HISTORY_DAYS);
      if (from < min) from = min;
    }
    const all = s.store
      .listReports(config.OUTLET_ID, from, to)
      .sort((a, b) => b.businessDate.localeCompare(a.businessDate));
    const start = Math.max(0, Number(p.data.cursor ?? 0) || 0);
    const page = all.slice(start, start + HISTORY_PAGE_SIZE);
    const weather = new Map(s.store.listWeather(page.at(-1)?.businessDate ?? to, to).map((w) => [w.date, w]));
    return {
      items: page.map((r) => ({ ...r, weather: weather.get(r.businessDate) ?? null })),
      nextCursor: start + HISTORY_PAGE_SIZE < all.length ? String(start + HISTORY_PAGE_SIZE) : null,
    };
  },

  'dashboard.summary'({ s, config }, payload) {
    const p = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).safeParse(payload);
    if (!p.success)
      throw new ApiFailure('VALIDATION_FAILED', 'Bad month.', {
        details: [{ field: 'month', rule: 'format' }],
      });
    const month = p.data.month;
    // include the 6 days before the month so the 7-day average is right on the 1st
    const from = addDays(`${month}-01`, -6);
    const to = addDays(`${month}-01`, 31);
    const reports = s.store
      .listReports(config.OUTLET_ID, from, to)
      .map((r) => ({ ...r, date: r.businessDate }));
    const weather = new Map(s.store.listWeather(`${month}-01`, to).map((w) => [w.date, w]));
    return dashboardSummary(month, reports, weather, config);
  },

  'config.get'({ config }) {
    return config;
  },

  'config.update'({ s, env }, payload) {
    const money = z.number().min(0).max(1_000_000_000);
    const p = z
      .object({ MONTHLY_TARGET: money.nullable().optional(), BENCHMARK_MONTHLY_AVG: money.optional() })
      .strict()
      .safeParse(payload);
    if (!p.success) {
      const details: FieldIssue[] = p.error.issues.map((i) => ({
        field: String(i.path[0] ?? 'payload'),
        rule: 'money',
      }));
      throw new ApiFailure('VALIDATION_FAILED', 'Bad value.', { details });
    }
    for (const [k, v] of Object.entries(p.data)) if (v !== undefined) s.store.writeConfig(k, v);
    audit(s, 'config_update', env.deviceId, JSON.stringify(p.data));
    return readConfig(s);
  },
};

// ---------- upsert (FR-BE-02) ----------

function upsertLocked(ctx: Ctx, p: { submissionId: string; baseVersion: number | null; report: unknown }) {
  const { s } = ctx;
  if (!s.lock.tryLock(LOCK_TIMEOUT_MS)) throw new ApiFailure('BUSY', 'The server is busy. Try again.');
  try {
    return upsert(ctx, p);
  } finally {
    s.lock.release();
  }
}

export function buildRecord(
  report: Report,
  prev: ReportRecord | null,
  meta: {
    outletId: string;
    openingDate: string;
    at: string;
    role: Role;
    device: string;
    submissionId: string;
    source: ReportRecord['source'];
  },
): ReportRecord {
  return {
    outletId: meta.outletId,
    ...report,
    dayOfWeek: weekday(report.businessDate),
    daysSinceOpening: daysBetween(meta.openingDate, report.businessDate),
    ...computeMetrics(report),
    version: (prev?.version ?? 0) + 1,
    createdAt: prev?.createdAt ?? meta.at,
    updatedAt: meta.at,
    updatedByRole: meta.role,
    updatedByDevice: meta.device,
    lastSubmissionId: meta.submissionId,
    source: meta.source,
  };
}

function upsert(ctx: Ctx, p: { submissionId: string; baseVersion: number | null; report: unknown }) {
  const { s, env, config, today } = ctx;
  const role = ctx.role as Role;
  const at = colomboIso(s.now());
  const businessDate =
    typeof (p.report as { businessDate?: unknown })?.businessDate === 'string'
      ? (p.report as { businessDate: string }).businessDate
      : '';
  const log = (result: SubmissionLogRow['result'], errorCode = '') =>
    s.store.appendSubmission({
      loggedAt: at,
      submissionId: p.submissionId,
      action: 'report.upsert',
      businessDate,
      role,
      deviceId: env.deviceId,
      deviceName: env.deviceName ?? '',
      appVersion: env.appVersion,
      result,
      errorCode,
      payloadJson: JSON.stringify(p.report).slice(0, 45_000),
    });

  // 1. idempotency
  const prior = s.store.findSubmission(p.submissionId);
  if (prior) {
    const current = s.store.getReport(config.OUTLET_ID, prior.businessDate);
    log('duplicate');
    if (current) return { report: current, version: current.version };
  }
  // 2. validation
  const v = validateReport(p.report, { openingDate: config.OPENING_DATE, today });
  if (!v.ok) {
    log('rejected', 'VALIDATION_FAILED');
    throw new ApiFailure('VALIDATION_FAILED', 'Fix the highlighted fields to continue.', {
      details: v.issues,
    });
  }
  // 3. role and edit window
  if (!canEditDate(role, v.value.businessDate, today, config.EDIT_WINDOW_DAYS)) {
    log('rejected', 'EDIT_WINDOW_CLOSED');
    throw new ApiFailure('EDIT_WINDOW_CLOSED', 'Reports older than 7 days can only be changed by the owner.');
  }
  // 4. optimistic concurrency
  const current = s.store.getReport(config.OUTLET_ID, v.value.businessDate);
  if ((current?.version ?? null) !== p.baseVersion) {
    log('rejected', 'CONFLICT');
    throw new ApiFailure('CONFLICT', 'This report was changed on another device.', { current });
  }
  // 5. write
  const record = buildRecord(v.value, current, {
    outletId: config.OUTLET_ID,
    openingDate: config.OPENING_DATE,
    at,
    role,
    device: env.deviceName || env.deviceId,
    submissionId: p.submissionId,
    source: 'app',
  });
  s.store.putReport(record);
  log(current ? 'updated' : 'created');
  return { report: record, version: record.version };
}

// ---------- request handling ----------

function respond<D>(
  s: Services,
  body: { ok: true; data: D } | { ok: false; error: ApiError },
): ApiResponse<D> {
  return { ...body, serverTime: colomboIso(s.now()), apiVersion: API_VERSION } as ApiResponse<D>;
}

/** Handles one POST body (C-02: a JSON string sent as text/plain). Never throws. */
export function handlePost(s: Services, body: string): ApiResponse<unknown> {
  let envelope: Envelope | null = null;
  let correlationId = '';
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      throw new ApiFailure('VALIDATION_FAILED', 'Request is not JSON.');
    }
    const e = envelopeSchema.safeParse(raw);
    if (!e.success) throw new ApiFailure('VALIDATION_FAILED', 'Bad request envelope.');
    envelope = e.data;
    correlationId =
      String((envelope.payload as { submissionId?: unknown })?.submissionId ?? '') || s.crypto.uuid();
    if (envelope.apiVersion !== API_VERSION)
      throw new ApiFailure('UNSUPPORTED_API_VERSION', 'Update the app.');
    const action = envelope.action as ActionName;
    const allowed = ACTION_ROLES[action];
    if (!allowed) throw new ApiFailure('NOT_FOUND', 'Unknown action.');
    let role: Role | null = null;
    if (allowed !== 'none') {
      const t = verifyToken(s, envelope.token, envelope.deviceId);
      if (!t.ok) throw new ApiFailure(t.code, 'Sign in again.');
      role = t.role;
      if (!allowed.includes(role)) {
        audit(s, 'forbidden', envelope.deviceId, `${role} called ${action}`);
        throw new ApiFailure('FORBIDDEN', 'Not allowed for this role.');
      }
    }
    if (action === 'auth.verify') {
      const name = (envelope.payload as { deviceName?: unknown })?.deviceName;
      if (typeof name === 'string') envelope = { ...envelope, deviceName: name.slice(0, 60) };
    }
    const ctx: Ctx = { s, env: envelope, role, config: readConfig(s), today: todayColombo(s.now()) };
    const data = (handlers[action] as Handler<ActionName>)(ctx, envelope.payload);
    return respond(s, { ok: true, data });
  } catch (err) {
    if (err instanceof ApiFailure) {
      return respond(s, { ok: false, error: { code: err.code, message: err.message, ...err.extra } });
    }
    const id = correlationId || s.crypto.uuid();
    try {
      audit(
        s,
        'error',
        envelope?.deviceId ?? '',
        `${id} ${err instanceof Error ? err.message : String(err)}`.slice(0, 2000),
      );
    } catch {
      // logging must never hide the original error
    }
    return respond(s, {
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong.', correlationId: id },
    });
  }
}

/** FR-BE-06: GET ?action=health, no auth, no data. */
export function handleGet(
  s: Services,
  params: Record<string, string | undefined>,
): HealthResponse | ApiResponse<never> {
  if (params.action === 'health')
    return { ok: true, apiVersion: API_VERSION, serverTime: colomboIso(s.now()) };
  return respond(s, { ok: false, error: { code: 'NOT_FOUND', message: 'Unknown action.' } });
}

// ---------- admin (FR-BE-01, 8.6) ----------

/** Inserts the two WhatsApp reports (8.6) if they are not already there. Returns the dates written. */
export function seed(s: Services): string[] {
  const config = readConfig(s);
  const written: string[] = [];
  const today = todayColombo(s.now());
  for (const r of SEED_REPORTS) {
    if (s.store.getReport(config.OUTLET_ID, r.businessDate)) continue;
    const v = validateReport(r, { openingDate: config.OPENING_DATE, today });
    if (!v.ok) throw new Error(`Seed ${r.businessDate} invalid: ${JSON.stringify(v.issues)}`);
    s.store.putReport(
      buildRecord(v.value, null, {
        outletId: config.OUTLET_ID,
        openingDate: config.OPENING_DATE,
        at: colomboIso(s.now()),
        role: 'Owner',
        device: 'WhatsApp backfill',
        submissionId: `seed-${r.businessDate}`,
        source: 'whatsapp-backfill',
      }),
    );
    written.push(r.businessDate);
  }
  return written;
}

/** Creates secrets that do not exist yet. Idempotent. */
export function ensureSecrets(s: Services): void {
  if (!s.props.get('PIN_SALT')) s.props.set('PIN_SALT', s.crypto.randomHex(32));
  if (!s.props.get('TOKEN_SECRET')) s.props.set('TOKEN_SECRET', s.crypto.randomHex(32));
  if (!s.props.get('TOKEN_VERSION')) s.props.set('TOKEN_VERSION', '1');
}

/** Writes Config defaults for keys that are missing. Idempotent. */
export function ensureConfigDefaults(s: Services): void {
  const raw = s.store.readConfig();
  for (const [k, v] of Object.entries(DEFAULT_CONFIG))
    if (!(k in raw)) s.store.writeConfig(k, v as string | number | null);
}
