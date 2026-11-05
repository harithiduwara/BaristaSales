// Enumerations and defaults from REQUIREMENTS.md 8.1 and 8.3.

export const API_VERSION = 1;
export const APP_TITLE = 'Aluthgama Daily Report';
export const WHATSAPP_TITLE = 'Aluthgama';

export const PERIODS = ['Before 10am', '10am–12pm', '12pm–3pm', '3pm–6pm', '6pm–9pm', 'After 9pm'] as const;
export const WEATHER = ['Sunny', 'Cloudy', 'Light rain', 'Heavy rain'] as const;
export const CONDITIONS = [
  'Normal day',
  'Public holiday',
  'Poya day',
  'School holiday',
  'Local event / festival',
  'Power cut',
  'Road closure / traffic',
  'Promotion running',
  'Delivery app issue',
  'Short-staffed',
] as const;

export type Period = (typeof PERIODS)[number];
export type WeatherLabel = (typeof WEATHER)[number];
export type Condition = (typeof CONDITIONS)[number];

export const MONEY_MAX = 10_000_000;
export const INT_MAX = 100_000;

/** Every report field, in the order of the 8.1 table (also the Sheet column order). */
export const REPORT_FIELDS = [
  'businessDate',
  'total',
  'bills',
  'dineIn',
  'takeaway',
  'uber',
  'uberOrders',
  'pickme',
  'pickmeOrders',
  'cash',
  'card',
  'qr',
  'discounts',
  'comps',
  'voids',
  'foreignCustomers',
  'busyPeriods',
  'quietPeriod',
  'topItems',
  'stockOuts',
  'staffOnDuty',
  'openTime',
  'closeTime',
  'wxMorning',
  'wxAfternoon',
  'wxEvening',
  'wxNight',
  'conditions',
  'conditionsOther',
  'promotions',
  'feedback',
  'comments',
] as const;
export type ReportField = (typeof REPORT_FIELDS)[number];

export const MONEY_FIELDS = [
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
] as const;
export const INT_FIELDS = ['bills', 'uberOrders', 'pickmeOrders', 'foreignCustomers', 'staffOnDuty'] as const;
export const WX_FIELDS = ['wxMorning', 'wxAfternoon', 'wxEvening', 'wxNight'] as const;
export const TEXT_LIMITS = {
  topItems: 200,
  stockOuts: 500,
  conditionsOther: 100,
  promotions: 200,
  feedback: 1000,
  comments: 1000,
} as const;

/** Wizard step (1–4) that holds each field, for error dots on the stepper (FR-REP-01). */
export const FIELD_STEP: Record<ReportField, 1 | 2 | 3 | 4> = {
  businessDate: 1,
  total: 1,
  bills: 1,
  dineIn: 1,
  takeaway: 1,
  uber: 1,
  uberOrders: 1,
  pickme: 1,
  pickmeOrders: 1,
  cash: 2,
  card: 2,
  qr: 2,
  discounts: 2,
  comps: 2,
  voids: 2,
  foreignCustomers: 3,
  busyPeriods: 3,
  quietPeriod: 3,
  topItems: 3,
  stockOuts: 3,
  staffOnDuty: 3,
  openTime: 3,
  closeTime: 3,
  wxMorning: 4,
  wxAfternoon: 4,
  wxEvening: 4,
  wxNight: 4,
  conditions: 4,
  conditionsOther: 4,
  promotions: 4,
  feedback: 4,
  comments: 4,
};

export interface Config {
  OUTLET_ID: string;
  OUTLET_NAME: string;
  OPENING_DATE: string;
  LATITUDE: number;
  LONGITUDE: number;
  TRADE_START_HOUR: number;
  TRADE_END_HOUR: number;
  DATE_CUTOFF_HOUR: number;
  EDIT_WINDOW_DAYS: number;
  MONTHLY_TARGET: number | null;
  BENCHMARK_MONTHLY_AVG: number;
  /** CR-01: model used for insights. */
  CLAUDE_MODEL: string;
}

export const DEFAULT_CONFIG: Config = {
  OUTLET_ID: 'ALU-01',
  OUTLET_NAME: 'Barista Aluthgama',
  OPENING_DATE: '2026-11-02',
  LATITUDE: 6.4333,
  LONGITUDE: 80.0,
  TRADE_START_HOUR: 7,
  TRADE_END_HOUR: 22,
  DATE_CUTOFF_HOUR: 12,
  EDIT_WINDOW_DAYS: 7,
  MONTHLY_TARGET: null,
  BENCHMARK_MONTHLY_AVG: 5_720_000,
  CLAUDE_MODEL: 'claude-opus-5-5',
};

/** Days of history the Manager sees (FR-HIS-01, OQ-17). */
export const MANAGER_HISTORY_DAYS = 60;
export const HISTORY_PAGE_SIZE = 30;

export const PIN_LENGTH = 6;
export const MAX_PIN_FAILURES = 5;
export const LOCKOUT_MINUTES = 15;
export const TOKEN_TTL_DAYS = 30;

/** Seed reports from the manager's WhatsApp messages (8.6). */
export const SEED_REPORTS = [
  {
    businessDate: '2026-11-02',
    total: 231874.9,
    bills: 82,
    uber: 0,
    pickme: 0,
    comments: 'Opening day. No Uber or PickMe orders; strong dine-in and takeaway sales.',
  },
  {
    businessDate: '2026-11-03',
    total: 129849.85,
    bills: 46,
    uber: 0,
    pickme: 1900,
    busyPeriods: ['After 9pm'],
    wxEvening: 'Light rain',
    comments:
      'A few foreign customers in the morning. Customer traffic was low through the day; evening rain likely reduced turnout. Slightly busy at night, but sales were below expectations.',
  },
] as const;
