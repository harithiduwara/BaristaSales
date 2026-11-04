// API contract types (REQUIREMENTS.md Section 7).
import type { Computed, DashboardSummary } from './calc';
import type { Config } from './constants';
import type { FieldIssue, Report } from './schema';

export type Role = 'Manager' | 'Owner';

export const ERROR_CODES = [
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'LOCKED_OUT',
  'FORBIDDEN',
  'VALIDATION_FAILED',
  'EDIT_WINDOW_CLOSED',
  'CONFLICT',
  'NOT_FOUND',
  'BUSY',
  'UNSUPPORTED_API_VERSION',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Codes the client retries on its own (7.4). Network errors are retried too. */
export const RETRYABLE_CODES: readonly ErrorCode[] = ['BUSY', 'INTERNAL'];

export interface RequestEnvelope<P = unknown> {
  apiVersion: number;
  action: ActionName;
  token?: string | undefined;
  deviceId: string;
  /** Shown in History detail and the Submissions_Log (FR-HIS-02). */
  deviceName?: string | undefined;
  appVersion: string;
  payload: P;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: FieldIssue[];
  /** CONFLICT: the record as currently saved. */
  current?: ReportRecord | null;
  /** NFR-OBS-01: shown to the user in error details. */
  correlationId?: string;
}

export type ApiResponse<D> =
  | { ok: true; data: D; serverTime: string; apiVersion: number }
  | { ok: false; error: ApiError; serverTime: string; apiVersion: number };

export interface Weather {
  date: string;
  avgTempTrading: number;
  maxTemp: number;
  minTemp: number;
  maxFeelsLike: number;
  avgHumidityTrading: number;
  rainTradingMm: number;
  rainHoursTrading: number;
  rainDayMm: number;
  source: 'forecast' | 'archive';
  fetchedAt: string;
}

/** A report as stored in the Reports sheet (8.3). */
export type ReportRecord = Report &
  Computed & {
    outletId: string;
    dayOfWeek: string;
    daysSinceOpening: number;
    version: number;
    createdAt: string;
    updatedAt: string;
    updatedByRole: Role;
    updatedByDevice: string;
    lastSubmissionId: string;
    source: 'app' | 'whatsapp-backfill';
  };

export interface ListItem extends ReportRecord {
  weather: Weather | null;
}

export interface Actions {
  'auth.verify': {
    payload: { pin: string; deviceName: string };
    data: { role: Role; token: string; expiresAt: string };
  };
  'report.upsert': {
    payload: { submissionId: string; baseVersion: number | null; report: unknown };
    data: { report: ReportRecord; version: number };
  };
  'report.get': {
    payload: { businessDate: string };
    data: { report: ReportRecord | null; weather: Weather | null };
  };
  'report.list': {
    payload: { from?: string; to?: string; cursor?: string | null };
    data: { items: ListItem[]; nextCursor: string | null };
  };
  'dashboard.summary': { payload: { month: string }; data: DashboardSummary };
  'config.get': { payload: Record<string, never>; data: Config };
  'config.update': {
    payload: Partial<Pick<Config, 'MONTHLY_TARGET' | 'BENCHMARK_MONTHLY_AVG'>>;
    data: Config;
  };
}
export type ActionName = keyof Actions;

/** Actions each role may call. `auth.verify` needs no token. */
export const ACTION_ROLES: Record<ActionName, readonly Role[] | 'none'> = {
  'auth.verify': 'none',
  'report.upsert': ['Manager', 'Owner'],
  'report.get': ['Manager', 'Owner'],
  'report.list': ['Manager', 'Owner'],
  'dashboard.summary': ['Owner'],
  'config.get': ['Manager', 'Owner'],
  'config.update': ['Owner'],
};

export interface HealthResponse {
  ok: true;
  apiVersion: number;
  serverTime: string;
}
