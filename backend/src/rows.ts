// Sheet layout (8.3) and row mapping. Pure: dates and times are YYYY-MM-DD / HH:mm strings here;
// the Apps Script adapter converts Sheet Date cells to these strings when reading.
import { REPORT_FIELDS, TEXT_LIMITS, type Insight, type ReportRecord, type Weather } from '@aluthgama/shared';
import type { AuditRow, SubmissionLogRow } from './ports';

export const SHEETS = {
  reports: 'Reports',
  log: 'Submissions_Log',
  weather: 'Weather',
  config: 'Config',
  audit: 'Audit',
  insights: 'Insights',
} as const;

const REPORT_BODY = REPORT_FIELDS.filter((f) => f !== 'businessDate');

export const REPORT_HEADERS = [
  'outletId',
  'businessDate',
  'dayOfWeek',
  'daysSinceOpening',
  ...REPORT_BODY,
  'avgBill',
  'deliverySales',
  'deliveryShare',
  'walkInSales',
  'version',
  'createdAt',
  'updatedAt',
  'updatedByRole',
  'updatedByDevice',
  'lastSubmissionId',
  'source',
] as const;

export const LOG_HEADERS = [
  'loggedAt',
  'submissionId',
  'action',
  'businessDate',
  'role',
  'deviceId',
  'deviceName',
  'appVersion',
  'result',
  'errorCode',
  'payloadJson',
] as const satisfies readonly (keyof SubmissionLogRow)[];

export const WEATHER_HEADERS = [
  'date',
  'avgTempTrading',
  'maxTemp',
  'minTemp',
  'maxFeelsLike',
  'avgHumidityTrading',
  'rainTradingMm',
  'rainHoursTrading',
  'rainDayMm',
  'source',
  'fetchedAt',
] as const satisfies readonly (keyof Weather)[];

export const INSIGHT_HEADERS = [
  'businessDate',
  'reportVersion',
  'generatedAt',
  'model',
  'text',
] as const satisfies readonly (keyof Insight)[];
export const INSIGHT_NUMERIC = new Set<string>(['reportVersion']);

export const AUDIT_HEADERS = [
  'at',
  'event',
  'deviceId',
  'detail',
] as const satisfies readonly (keyof AuditRow)[];

export const CONFIG_HEADERS = ['key', 'value'] as const;

export const MONEY_COLUMNS = new Set<string>([
  'total',
  'dineIn',
  'takeaway',
  'uber',
  'pickme',
  'cash',
  'card',
  'qr',
  'discounts',
  'comps',
  'voids',
  'avgBill',
  'deliverySales',
  'walkInSales',
]);
export const SHARE_COLUMNS = new Set<string>(['deliveryShare']);
export const DATE_COLUMNS = new Set<string>(['businessDate', 'date']);
export const TEXT_COLUMNS = new Set<string>([
  'openTime',
  'closeTime',
  ...Object.keys(TEXT_LIMITS),
  'comments',
]);
const LIST_COLUMNS = new Set<string>(['busyPeriods', 'conditions']);
const NUMERIC_COLUMNS = new Set<string>([
  ...MONEY_COLUMNS,
  ...SHARE_COLUMNS,
  'bills',
  'uberOrders',
  'pickmeOrders',
  'foreignCustomers',
  'staffOnDuty',
  'daysSinceOpening',
  'version',
]);

export type Cell = string | number | boolean | null;

/** V-11: strings that a spreadsheet would read as a formula get a leading apostrophe. */
export const guardFormula = (v: string): string => (/^[=+\-@]/.test(v) ? `'${v}` : v);
const unguard = (v: string): string => (/^'[=+\-@]/.test(v) ? v.slice(1) : v);

function toCell(v: unknown): Cell {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return guardFormula(v.join('; '));
  if (typeof v === 'string') return guardFormula(v);
  return v as number | boolean;
}

export function recordToRow(r: ReportRecord): Cell[] {
  const rec = r as unknown as Record<string, unknown>;
  return REPORT_HEADERS.map((h) => toCell(rec[h]));
}

export function rowToRecord(row: readonly Cell[]): ReportRecord {
  const out: Record<string, unknown> = {};
  REPORT_HEADERS.forEach((h, i) => {
    const v = row[i];
    if (v === '' || v === null || v === undefined) {
      if (['avgBill', 'deliveryShare'].includes(h)) out[h] = null;
      return;
    }
    if (LIST_COLUMNS.has(h))
      out[h] = String(v)
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean);
    else if (NUMERIC_COLUMNS.has(h)) out[h] = Number(v);
    else out[h] = typeof v === 'string' ? unguard(v) : String(v);
  });
  return out as unknown as ReportRecord;
}

export const objectToRow = <T extends object>(headers: readonly (keyof T & string)[], o: T): Cell[] =>
  headers.map((h) => toCell((o as Record<string, unknown>)[h]));

export function rowToObject<T>(
  headers: readonly string[],
  row: readonly Cell[],
  numeric: ReadonlySet<string>,
): T {
  const out: Record<string, unknown> = {};
  headers.forEach((h, i) => {
    const v = row[i];
    out[h] = numeric.has(h)
      ? Number(v)
      : typeof v === 'string'
        ? unguard(v)
        : v === null || v === undefined
          ? ''
          : String(v);
  });
  return out as T;
}

export const WEATHER_NUMERIC = new Set<string>(
  WEATHER_HEADERS.filter((h) => !['date', 'source', 'fetchedAt'].includes(h)),
);
