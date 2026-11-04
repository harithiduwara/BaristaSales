// In-memory implementation of the ports: used by unit tests and the mock API (ADR-0007).
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { ReportRecord, Weather } from '@aluthgama/shared';
import type { AuditRow, Cache, Crypto, KeyValue, Lock, Services, Store, SubmissionLogRow } from './ports';
import { guardFormula } from './rows';

export class MemoryStore implements Store {
  reports = new Map<string, ReportRecord>();
  log: SubmissionLogRow[] = [];
  audit: AuditRow[] = [];
  weather = new Map<string, Weather>();
  config: Record<string, string | number | null> = {};

  private key = (o: string, d: string) => `${o}|${d}`;
  getReport(outletId: string, date: string) {
    const r = this.reports.get(this.key(outletId, date));
    return r ? structuredClone(r) : null;
  }
  listReports(outletId: string, from: string, to: string) {
    return [...this.reports.values()]
      .filter((r) => r.outletId === outletId && r.businessDate >= from && r.businessDate <= to)
      .map((r) => structuredClone(r));
  }
  putReport(r: ReportRecord) {
    this.reports.set(this.key(r.outletId, r.businessDate), structuredClone(r));
  }
  findSubmission(id: string) {
    return this.log.find((l) => l.submissionId === id && (l.result === 'created' || l.result === 'updated')) ?? null;
  }
  appendSubmission(row: SubmissionLogRow) {
    this.log.push({ ...row, payloadJson: guardFormula(row.payloadJson) });
  }
  appendAudit(row: AuditRow) {
    this.audit.push(row);
  }
  getWeather(date: string) {
    return this.weather.get(date) ?? null;
  }
  listWeather(from: string, to: string) {
    return [...this.weather.values()].filter((w) => w.date >= from && w.date <= to);
  }
  putWeather(w: Weather) {
    if (!this.weather.has(w.date)) this.weather.set(w.date, w);
  }
  readConfig() {
    return { ...this.config };
  }
  writeConfig(k: string, v: string | number | null) {
    this.config[k] = v;
  }
}

export class MemoryKeyValue implements KeyValue {
  data = new Map<string, string>();
  get(k: string) {
    return this.data.get(k) ?? null;
  }
  set(k: string, v: string) {
    this.data.set(k, v);
  }
}

export class MemoryCache implements Cache {
  private data = new Map<string, { v: string; until: number }>();
  constructor(private readonly now: () => number) {}
  get(k: string) {
    const e = this.data.get(k);
    if (!e || e.until <= this.now()) return null;
    return e.v;
  }
  put(k: string, v: string, ttl: number) {
    this.data.set(k, { v, until: this.now() + ttl * 1000 });
  }
  remove(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

export class MemoryLock implements Lock {
  held = false;
  /** Set to make the next tryLock fail (BUSY tests). */
  failNext = false;
  tryLock() {
    if (this.failNext || this.held) {
      this.failNext = false;
      return false;
    }
    this.held = true;
    return true;
  }
  release() {
    this.held = false;
  }
}

export const nodeCrypto: Crypto = {
  sha256Hex: (t) => createHash('sha256').update(t, 'utf8').digest('hex'),
  hmacSha256B64u: (d, k) => createHmac('sha256', k).update(d, 'utf8').digest('base64url'),
  uuid: () => randomUUID(),
  randomHex: (n) => randomBytes(n).toString('hex'),
};

export interface MemoryServices extends Services {
  store: MemoryStore;
  props: MemoryKeyValue;
  cache: MemoryCache;
  lock: MemoryLock;
  /** Change "now" for tests. */
  clock: { now: number | null; offsetMs: number };
}

export function createMemoryServices(): MemoryServices {
  const clock = { now: null as number | null, offsetMs: 0 };
  const now = () => (clock.now ?? Date.now()) + clock.offsetMs;
  return {
    now,
    clock,
    store: new MemoryStore(),
    props: new MemoryKeyValue(),
    cache: new MemoryCache(now),
    lock: new MemoryLock(),
    crypto: nodeCrypto,
  };
}
