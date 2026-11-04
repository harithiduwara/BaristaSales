// The one report schema (5.2), used by the app, the backend and the mock API.
// Validation rules V-01 … V-10 (8.2). The server is authoritative.
// Each issue message is a short rule code; the UI maps codes to words (i18n).
import { z } from 'zod';
import {
  CONDITIONS,
  INT_MAX,
  MONEY_MAX,
  PERIODS,
  TEXT_LIMITS,
  WEATHER,
  type Config,
  type ReportField,
} from './constants';
import { isValidDate } from './dates';
import { hasAtMostTwoDecimals, parseInteger, parseMoney } from './money';

export type Rule =
  | 'required'
  | 'date'
  | 'beforeOpening'
  | 'future'
  | 'money'
  | 'decimals'
  | 'integer'
  | 'billsRequired'
  | 'exceedsTotal'
  | 'deliveryExceedsTotal'
  | 'alsoBusy'
  | 'time'
  | 'maxLength'
  | 'enum';

export interface FieldIssue {
  field: ReportField | string;
  rule: Rule | string;
}

const blankToUndefined = (v: unknown): unknown => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v);

const numberError = (iss: { input?: unknown }): string => (iss.input === undefined ? 'required' : 'money');
const intError = (iss: { input?: unknown }): string => (iss.input === undefined ? 'required' : 'integer');

const moneyNumber = z
  .number({ error: numberError })
  .min(0, { error: 'money' })
  .max(MONEY_MAX, { error: 'money' })
  .refine(hasAtMostTwoDecimals, { error: 'decimals' });

const preMoney = (v: unknown): unknown => {
  const b = blankToUndefined(v);
  return typeof b === 'string' ? parseMoney(b) : b;
};
const moneyRequired = () => z.preprocess(preMoney, moneyNumber);
const moneyOptional = () => z.preprocess(preMoney, moneyNumber.optional());

const intNumber = z
  .number({ error: intError })
  .int({ error: 'integer' })
  .min(0, { error: 'integer' })
  .max(INT_MAX, { error: 'integer' });

const preInt = (v: unknown): unknown => {
  const b = blankToUndefined(v);
  return typeof b === 'string' ? parseInteger(b) : b;
};
const intRequired = () => z.preprocess(preInt, intNumber);
const intOptional = () => z.preprocess(preInt, intNumber.optional());

// Strip control characters except tab and newline, normalise line endings, trim (V-09).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const cleanText = (s: string): string => s.replace(/\r\n?/g, '\n').replace(CONTROL, '').trim();

function textField(max: number) {
  return z.preprocess(
    (v) => {
      const b = typeof v === 'string' ? cleanText(v) : v;
      return blankToUndefined(b);
    },
    z.string({ error: 'maxLength' }).max(max, { error: 'maxLength' }).optional(),
  );
}

const enumOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values, { error: 'enum' }).optional());

const multiOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (Array.isArray(v) && v.length === 0 ? undefined : v),
    z
      .array(z.enum(values, { error: 'enum' }), { error: 'enum' })
      .transform((a) => values.filter((x) => a.includes(x)))
      .optional(),
  );

const timeField = z.preprocess(
  blankToUndefined,
  z
    .string({ error: 'time' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'time' })
    .optional(),
);

const baseShape = {
  businessDate: z.string({ error: 'required' }).refine(isValidDate, { error: 'date' }),
  total: moneyRequired(),
  bills: intRequired(),
  dineIn: moneyOptional(),
  takeaway: moneyOptional(),
  uber: moneyRequired(),
  uberOrders: intOptional(),
  pickme: moneyRequired(),
  pickmeOrders: intOptional(),
  cash: moneyOptional(),
  card: moneyOptional(),
  qr: moneyOptional(),
  discounts: moneyOptional(),
  comps: moneyOptional(),
  voids: moneyOptional(),
  foreignCustomers: intOptional(),
  busyPeriods: multiOf(PERIODS),
  quietPeriod: enumOf(PERIODS),
  topItems: textField(TEXT_LIMITS.topItems),
  stockOuts: textField(TEXT_LIMITS.stockOuts),
  staffOnDuty: intOptional(),
  openTime: timeField,
  closeTime: timeField,
  wxMorning: enumOf(WEATHER),
  wxAfternoon: enumOf(WEATHER),
  wxEvening: enumOf(WEATHER),
  wxNight: enumOf(WEATHER),
  conditions: multiOf(CONDITIONS),
  conditionsOther: textField(TEXT_LIMITS.conditionsOther),
  promotions: textField(TEXT_LIMITS.promotions),
  feedback: textField(TEXT_LIMITS.feedback),
  comments: textField(TEXT_LIMITS.comments),
};

export interface SchemaContext {
  /** OPENING_DATE from Config. */
  openingDate: string;
  /** Today in Asia/Colombo, YYYY-MM-DD. */
  today: string;
}

/** Builds the report schema for a given "today" (V-01 depends on it). */
export function createReportSchema(ctx: SchemaContext) {
  return z
    .object(baseShape)
    .strip()
    .superRefine((r, issue) => {
      const add = (field: ReportField, rule: Rule) => issue.addIssue({ code: 'custom', path: [field], message: rule });
      // Cross-field rules only compare values that passed their own checks,
      // so one bad entry gives one message.
      const okMoney = (n: unknown): n is number =>
        typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MONEY_MAX && hasAtMostTwoDecimals(n);
      // V-01
      if (isValidDate(r.businessDate)) {
        if (r.businessDate < ctx.openingDate) add('businessDate', 'beforeOpening');
        else if (r.businessDate > ctx.today) add('businessDate', 'future');
      }
      // V-07
      if (r.quietPeriod && r.busyPeriods?.includes(r.quietPeriod)) add('quietPeriod', 'alsoBusy');
      if (!okMoney(r.total)) return;
      // V-04
      if (r.total > 0 && r.bills === 0) add('bills', 'billsRequired');
      // V-05
      for (const f of ['uber', 'pickme', 'dineIn', 'takeaway'] as const) {
        const v = r[f];
        if (okMoney(v) && v > r.total) add(f, 'exceedsTotal');
      }
      // V-06
      if (okMoney(r.uber) && okMoney(r.pickme) && r.uber <= r.total && r.pickme <= r.total && r.uber + r.pickme > r.total) {
        add('pickme', 'deliveryExceedsTotal');
      }
    });
}

export type Report = z.output<ReturnType<typeof createReportSchema>>;
/** What a form or API caller may send before parsing (strings allowed for numbers). */
export type ReportInput = { [K in keyof Report]?: unknown };

export type ValidationResult = { ok: true; value: Report } | { ok: false; issues: FieldIssue[] };

export function validateReport(input: unknown, ctx: SchemaContext): ValidationResult {
  const result = createReportSchema(ctx).safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const seen = new Set<string>();
  const issues: FieldIssue[] = [];
  for (const i of result.error.issues) {
    const field = String(i.path[0] ?? 'report');
    const key = `${field}:${i.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push({ field, rule: i.message });
    }
  }
  return { ok: false, issues };
}

export const schemaContextFor = (config: Pick<Config, 'OPENING_DATE'>, today: string): SchemaContext => ({
  openingDate: config.OPENING_DATE,
  today,
});
