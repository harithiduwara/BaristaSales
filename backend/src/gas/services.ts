// Apps Script implementations of the ports (ADR-0006). Not unit-tested: covered by the integration suite.
import type { Insight, ReportRecord, Weather } from '@aluthgama/shared';
import { PROP } from '../auth';
import type { AuditRow, Cache, Crypto, KeyValue, Lock, Services, Store, SubmissionLogRow } from '../ports';
import {
  AUDIT_HEADERS,
  CONFIG_HEADERS,
  DATE_COLUMNS,
  INSIGHT_HEADERS,
  INSIGHT_NUMERIC,
  LOG_HEADERS,
  REPORT_HEADERS,
  SHEETS,
  WEATHER_HEADERS,
  WEATHER_NUMERIC,
  objectToRow,
  recordToRow,
  rowToObject,
  rowToRecord,
  type Cell,
} from '../rows';
import { bytesToHex } from '../util';
import { ClaudeAi } from './claude';

export const TZ = 'Asia/Colombo';

/** Sheet cell → plain value: Date cells become YYYY-MM-DD (or HH:mm for time-only cells). */
export function normaliseCell(v: unknown): Cell {
  if (v instanceof Date) {
    if (v.getFullYear() < 1900) return Utilities.formatDate(v, TZ, 'HH:mm');
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return v as Cell;
}

/** YYYY-MM-DD → a Date at midnight Asia/Colombo, so the Sheet stores a whole day. */
export function dateCell(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - 330 * 60_000);
}

function withDates(headers: readonly string[], row: Cell[]): (Cell | Date)[] {
  return row.map((v, i) =>
    DATE_COLUMNS.has(headers[i] as string) && typeof v === 'string' && v ? dateCell(v) : v,
  );
}

export function openSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const id = PropertiesService.getScriptProperties().getProperty(PROP.SHEET_ID);
  if (!id) throw new Error('SHEET_ID is not set. Run Admin → Run setup.');
  return SpreadsheetApp.openById(id);
}

function rows(sheet: GoogleAppsScript.Spreadsheet.Sheet): Cell[][] {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet
    .getRange(2, 1, last - 1, sheet.getLastColumn())
    .getValues()
    .map((r) => r.map(normaliseCell));
}

export class SheetStore implements Store {
  constructor(private readonly ss: GoogleAppsScript.Spreadsheet.Spreadsheet) {}
  private sheet(name: string) {
    const sh = this.ss.getSheetByName(name);
    if (!sh) throw new Error(`Missing sheet ${name}. Run Admin → Run setup.`);
    return sh;
  }

  private findReportRow(outletId: string, date: string): { index: number; row: Cell[] } | null {
    const all = rows(this.sheet(SHEETS.reports));
    const i = all.findIndex((r) => r[0] === outletId && r[1] === date);
    return i < 0 ? null : { index: i + 2, row: all[i] as Cell[] };
  }

  getReport(outletId: string, date: string) {
    const f = this.findReportRow(outletId, date);
    return f ? rowToRecord(f.row) : null;
  }

  listReports(outletId: string, from: string, to: string) {
    return rows(this.sheet(SHEETS.reports))
      .filter((r) => r[0] === outletId && String(r[1]) >= from && String(r[1]) <= to)
      .map(rowToRecord);
  }

  putReport(record: ReportRecord) {
    const sh = this.sheet(SHEETS.reports);
    const values = [withDates(REPORT_HEADERS, recordToRow(record))];
    const f = this.findReportRow(record.outletId, record.businessDate);
    if (f) sh.getRange(f.index, 1, 1, REPORT_HEADERS.length).setValues(values);
    else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, REPORT_HEADERS.length).setValues(values);
      const last = sh.getLastRow();
      if (last > 2) sh.getRange(2, 1, last - 1, REPORT_HEADERS.length).sort({ column: 2, ascending: true });
    }
  }

  findSubmission(id: string) {
    const sh = this.sheet(SHEETS.log);
    const last = sh.getLastRow();
    if (last < 2) return null;
    const hits = sh
      .getRange(2, 2, last - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findAll();
    for (const h of hits) {
      const row = sh.getRange(h.getRow(), 1, 1, LOG_HEADERS.length).getValues()[0]?.map(normaliseCell) ?? [];
      const o = rowToObject<SubmissionLogRow>(LOG_HEADERS, row, new Set());
      if (o.result === 'created' || o.result === 'updated') return o;
    }
    return null;
  }

  appendSubmission(row: SubmissionLogRow) {
    this.sheet(SHEETS.log).appendRow(withDates(LOG_HEADERS, objectToRow(LOG_HEADERS, row)));
  }

  appendAudit(row: AuditRow) {
    this.sheet(SHEETS.audit).appendRow(objectToRow(AUDIT_HEADERS, row));
  }

  getWeather(date: string) {
    return this.listWeather(date, date)[0] ?? null;
  }

  listWeather(from: string, to: string) {
    return rows(this.sheet(SHEETS.weather))
      .filter((r) => String(r[0]) >= from && String(r[0]) <= to)
      .map((r) => rowToObject<Weather>(WEATHER_HEADERS, r, WEATHER_NUMERIC));
  }

  putWeather(w: Weather) {
    if (this.getWeather(w.date)) return;
    const sh = this.sheet(SHEETS.weather);
    sh.appendRow(withDates(WEATHER_HEADERS, objectToRow(WEATHER_HEADERS, w)));
  }

  getInsight(date: string, version: number) {
    const row = rows(this.sheet(SHEETS.insights)).find((r) => r[0] === date && Number(r[1]) === version);
    return row ? rowToObject<Insight>(INSIGHT_HEADERS, row, INSIGHT_NUMERIC) : null;
  }

  putInsight(i: Insight) {
    this.sheet(SHEETS.insights).appendRow(withDates(INSIGHT_HEADERS, objectToRow(INSIGHT_HEADERS, i)));
  }

  readConfig() {
    const out: Record<string, string | number | null> = {};
    for (const [k, v] of rows(this.sheet(SHEETS.config)))
      if (k) out[String(k)] = v === '' ? null : (v as string | number);
    return out;
  }

  writeConfig(key: string, value: string | number | null) {
    const sh = this.sheet(SHEETS.config);
    const all = rows(sh);
    const i = all.findIndex((r) => r[0] === key);
    const v = value ?? '';
    if (i >= 0) sh.getRange(i + 2, 2).setValue(v);
    else sh.appendRow([key, v]);
  }
}

export const scriptProps = (): KeyValue => {
  const p = PropertiesService.getScriptProperties();
  return { get: (k) => p.getProperty(k), set: (k, v) => void p.setProperty(k, v) };
};

const scriptCache = (): Cache => {
  const c = CacheService.getScriptCache();
  return { get: (k) => c.get(k), put: (k, v, ttl) => c.put(k, v, ttl), remove: (k) => c.remove(k) };
};

const scriptLock = (): Lock => {
  const l = LockService.getScriptLock();
  return { tryLock: (ms) => l.tryLock(ms), release: () => l.releaseLock() };
};

export const gasCrypto: Crypto = {
  sha256Hex: (t) =>
    bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)),
  hmacSha256B64u: (d, k) =>
    Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(d, k, Utilities.Charset.UTF_8),
    ).replace(/=+$/, ''),
  uuid: () => Utilities.getUuid(),
  randomHex: (n) => {
    let out = '';
    while (out.length < n * 2) out += Utilities.getUuid().replace(/-/g, '');
    return out.slice(0, n * 2);
  },
};

export function gasServices(ss = openSpreadsheet()): Services {
  return {
    now: () => Date.now(),
    store: new SheetStore(ss),
    props: scriptProps(),
    cache: scriptCache(),
    lock: scriptLock(),
    crypto: gasCrypto,
    ai: new ClaudeAi(),
  };
}

export { CONFIG_HEADERS };
