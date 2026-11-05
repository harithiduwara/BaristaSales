// The backend core talks to Google services only through these ports (ADR-0006),
// so it runs unchanged in unit tests and in the mock API (ADR-0007).
import type { Insight, ListItem, ReportRecord, Role, Weather } from '@aluthgama/shared';

export interface SubmissionLogRow {
  loggedAt: string;
  submissionId: string;
  action: string;
  businessDate: string;
  role: Role | '';
  deviceId: string;
  deviceName: string;
  appVersion: string;
  result: 'created' | 'updated' | 'duplicate' | 'rejected';
  errorCode: string;
  payloadJson: string;
}

export interface AuditRow {
  at: string;
  event:
    'auth_fail' | 'lockout' | 'config_update' | 'forbidden' | 'error' | 'pins_set' | 'setup' | 'ai_error';
  deviceId: string;
  detail: string;
}

export interface Store {
  getReport(outletId: string, businessDate: string): ReportRecord | null;
  /** All reports for the outlet with from ≤ businessDate ≤ to. Order is not guaranteed. */
  listReports(outletId: string, from: string, to: string): ReportRecord[];
  putReport(record: ReportRecord): void;
  /** The first successful (created/updated) log row for this submissionId, if any. */
  findSubmission(submissionId: string): SubmissionLogRow | null;
  appendSubmission(row: SubmissionLogRow): void;
  appendAudit(row: AuditRow): void;
  getWeather(date: string): Weather | null;
  listWeather(from: string, to: string): Weather[];
  putWeather(w: Weather): void;
  /** Raw key/value pairs from the Config sheet. */
  /** CR-01: cached insight for one report version. */
  getInsight(businessDate: string, reportVersion: number): Insight | null;
  putInsight(insight: Insight): void;
  readConfig(): Record<string, string | number | null>;
  writeConfig(key: string, value: string | number | null): void;
}

export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface Cache {
  get(key: string): string | null;
  put(key: string, value: string, ttlSeconds: number): void;
  remove(key: string): void;
}

export interface Lock {
  /** Waits up to timeoutMs. True when the lock was taken. */
  tryLock(timeoutMs: number): boolean;
  release(): void;
}

export interface Crypto {
  sha256Hex(text: string): string;
  /** HMAC-SHA256 of `data` with `key`, base64url without padding. */
  hmacSha256B64u(data: string, key: string): string;
  uuid(): string;
  randomHex(bytes: number): string;
}

export interface AiRequest {
  model: string;
  system: string;
  user: string;
}

export type AiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: 'notConfigured' | 'refused' | 'error'; detail: string };

/** CR-01: a large language model behind the backend (Claude API in Apps Script, a stub in tests). */
export interface Ai {
  complete(req: AiRequest): AiResult;
}

export interface Services {
  now(): number;
  store: Store;
  props: KeyValue;
  cache: Cache;
  lock: Lock;
  crypto: Crypto;
  ai: Ai;
}

export type { ListItem };
