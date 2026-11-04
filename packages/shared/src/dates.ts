// Asia/Colombo date helpers (C-05). Sri Lanka has no daylight saving: always UTC+05:30.

export const COLOMBO_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const pad = (n: number): string => String(n).padStart(2, '0');

export interface ColomboParts {
  date: string;
  hour: number;
  minute: number;
  second: number;
}

/** Local Colombo calendar date and time for an instant. */
export function colomboParts(epochMs: number): ColomboParts {
  const d = new Date(epochMs + COLOMBO_OFFSET_MINUTES * 60_000);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export const todayColombo = (epochMs: number): string => colomboParts(epochMs).date;

/** ISO 8601 timestamp with the +05:30 offset, e.g. 2026-11-04T22:10:00+05:30. */
export function colomboIso(epochMs: number): string {
  const p = colomboParts(epochMs);
  return `${p.date}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+05:30`;
}

/** "21:42" in Colombo time. */
export function colomboTime(epochMs: number): string {
  const p = colomboParts(epochMs);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD date. */
export const dayNumber = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
export const fromDayNumber = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const addDays = (date: string, days: number): string => fromDayNumber(dayNumber(date) + days);
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

export function weekday(date: string): Weekday {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as Weekday;
}

export function monthShort(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1] as string;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const monthOf = (date: string): string => date.slice(0, 7);

/** "2026-11" → "2026-10". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/**
 * Default business date (A-03, FR-REP-02): before the cut-off hour it is yesterday, otherwise today.
 * Never earlier than the opening date (OQ-16).
 */
export function defaultBusinessDate(epochMs: number, cutoffHour: number, openingDate: string): string {
  const p = colomboParts(epochMs);
  const date = p.hour < cutoffHour ? addDays(p.date, -1) : p.date;
  return date < openingDate ? openingDate : date;
}

/** Whether a role may create or change a report for this date (FR-HIS-03, OQ-19). */
export function canEditDate(
  role: 'Manager' | 'Owner',
  businessDate: string,
  today: string,
  windowDays: number,
): boolean {
  return role === 'Owner' || daysBetween(businessDate, today) <= windowDays;
}
