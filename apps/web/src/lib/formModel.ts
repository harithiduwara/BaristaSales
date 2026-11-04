// Wizard form values: what the inputs hold (strings), converted by the shared schema on submit.
import { formatMoney, type Report, type ReportRecord } from '@aluthgama/shared';

export interface FormValues {
  businessDate: string;
  total: string;
  bills: string;
  dineIn: string;
  takeaway: string;
  uber: string;
  uberOrders: string;
  pickme: string;
  pickmeOrders: string;
  cash: string;
  card: string;
  qr: string;
  discounts: string;
  comps: string;
  voids: string;
  foreignCustomers: string;
  busyPeriods: string[];
  quietPeriod: string;
  topItems: string;
  stockOuts: string;
  staffOnDuty: string;
  openTime: string;
  closeTime: string;
  wxMorning: string;
  wxAfternoon: string;
  wxEvening: string;
  wxNight: string;
  conditions: string[];
  conditionsOther: string;
  promotions: string;
  feedback: string;
  comments: string;
}

export const MONEY_KEYS = ['total', 'dineIn', 'takeaway', 'uber', 'pickme', 'cash', 'card', 'qr', 'discounts', 'comps', 'voids'] as const;
export const INT_KEYS = ['bills', 'uberOrders', 'pickmeOrders', 'foreignCustomers', 'staffOnDuty'] as const;

export function emptyForm(businessDate: string): FormValues {
  return {
    businessDate,
    total: '',
    bills: '',
    dineIn: '',
    takeaway: '',
    uber: '',
    uberOrders: '',
    pickme: '',
    pickmeOrders: '',
    cash: '',
    card: '',
    qr: '',
    discounts: '',
    comps: '',
    voids: '',
    foreignCustomers: '',
    busyPeriods: [],
    quietPeriod: '',
    topItems: '',
    stockOuts: '',
    staffOnDuty: '',
    openTime: '',
    closeTime: '',
    wxMorning: '',
    wxAfternoon: '',
    wxEvening: '',
    wxNight: '',
    conditions: [],
    conditionsOther: '',
    promotions: '',
    feedback: '',
    comments: '',
  };
}

/** A saved report (or a parsed report) as form values. Money is shown formatted, like after blur. */
export function reportToForm(r: Report | ReportRecord): FormValues {
  const f = emptyForm(r.businessDate);
  const src = r as unknown as Record<string, unknown>;
  for (const k of Object.keys(f) as (keyof FormValues)[]) {
    const v = src[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(f[k])) (f as unknown as Record<string, unknown>)[k] = [...(v as string[])];
    else if ((MONEY_KEYS as readonly string[]).includes(k)) (f as unknown as Record<string, unknown>)[k] = formatMoney(v as number);
    else (f as unknown as Record<string, unknown>)[k] = String(v);
  }
  return f;
}
