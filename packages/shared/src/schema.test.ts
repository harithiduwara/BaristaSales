import { describe, expect, it } from 'vitest';
import { cleanText, validateReport, schemaContextFor, type ValidationResult } from './schema';
import { DEFAULT_CONFIG, SEED_REPORTS } from './constants';

const ctx = schemaContextFor(DEFAULT_CONFIG, '2026-11-04');
const base = { businessDate: '2026-11-04', total: '148,320.00', bills: '52', uber: '4640', pickme: 'Rs 4,400/=' };
const rules = (r: ValidationResult) => (r.ok ? [] : r.issues.map((i) => `${i.field}:${i.rule}`).sort());

describe('report schema (8.1, 8.2)', () => {
  it('accepts the required fields as typed by a manager', () => {
    const r = validateReport(base, ctx);
    expect(r).toEqual({
      ok: true,
      value: { businessDate: '2026-11-04', total: 148320, bills: 52, uber: 4640, pickme: 4400 },
    });
  });

  it('accepts both seed reports (8.6)', () => {
    for (const s of SEED_REPORTS) expect(validateReport(s, ctx).ok).toBe(true);
  });

  it('accepts every field filled in', () => {
    const full = {
      ...base,
      dineIn: '96500',
      takeaway: 42780,
      uberOrders: 3,
      pickmeOrders: '',
      cash: 61200,
      card: 72620,
      qr: 14000,
      discounts: 1850,
      comps: 960,
      voids: 0,
      foreignCustomers: 4,
      busyPeriods: ['After 9pm', '6pm–9pm', '6pm–9pm'],
      quietPeriod: '3pm–6pm',
      topItems: 'Cappuccino, iced latte, club sandwich',
      stockOuts: '  ',
      staffOnDuty: 6,
      openTime: '07:00',
      closeTime: '00:30',
      wxMorning: 'Sunny',
      wxAfternoon: 'Cloudy',
      wxEvening: 'Cloudy',
      wxNight: 'Light rain',
      conditions: ['Normal day'],
      conditionsOther: 'Wedding nearby',
      promotions: null,
      feedback: 'Line 1\r\nLine 2\u0007',
      comments: 'Steady day.',
    };
    const r = validateReport(full, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.busyPeriods).toEqual(['6pm–9pm', 'After 9pm']);
      expect(r.value.feedback).toBe('Line 1\nLine 2');
      expect(r.value.stockOuts).toBeUndefined();
      expect(r.value.pickmeOrders).toBeUndefined();
      expect(r.value.promotions).toBeUndefined();
      expect(r.value.conditions).toEqual(['Normal day']);
    }
  });

  it('drops unknown keys', () => {
    const r = validateReport({ ...base, hacker: 'x' }, ctx);
    expect(r.ok && 'hacker' in r.value).toBe(false);
  });

  it('treats an empty multi-select as not given', () => {
    const r = validateReport({ ...base, conditions: [] }, ctx);
    expect(r.ok && r.value.conditions).toBeUndefined();
  });

  it('reports missing required fields', () => {
    expect(rules(validateReport({}, ctx))).toEqual([
      'bills:required',
      'businessDate:required',
      'pickme:required',
      'total:required',
      'uber:required',
    ]);
  });

  it('V-01 date validity, opening date and future', () => {
    expect(rules(validateReport({ ...base, businessDate: '2026-02-30' }, ctx))).toEqual(['businessDate:date']);
    expect(rules(validateReport({ ...base, businessDate: '2026-11-01' }, ctx))).toEqual(['businessDate:beforeOpening']);
    expect(rules(validateReport({ ...base, businessDate: '2026-11-05' }, ctx))).toEqual(['businessDate:future']);
  });

  it('V-02 money bounds and decimals', () => {
    expect(rules(validateReport({ ...base, total: 'abc' }, ctx))).toEqual(['total:money']);
    expect(rules(validateReport({ ...base, total: -1 }, ctx))).toEqual(['total:money']);
    expect(rules(validateReport({ ...base, total: 10_000_000.01 }, ctx))).toEqual(['total:money']);
    expect(rules(validateReport({ ...base, total: '1.234' }, ctx))).toEqual(['total:decimals']);
    expect(rules(validateReport({ ...base, cash: 'x' }, ctx))).toEqual(['cash:money']);
  });

  it('V-03 integers', () => {
    expect(rules(validateReport({ ...base, bills: '4.5' }, ctx))).toEqual(['bills:integer']);
    expect(rules(validateReport({ ...base, bills: 100_001 }, ctx))).toEqual(['bills:integer']);
    expect(rules(validateReport({ ...base, staffOnDuty: -2 }, ctx))).toEqual(['staffOnDuty:integer']);
  });

  it('UAT-04 V-04 bills required when there are sales', () => {
    expect(rules(validateReport({ ...base, bills: 0 }, ctx))).toEqual(['bills:billsRequired']);
    expect(validateReport({ ...base, total: 0, uber: 0, pickme: 0, bills: 0 }, ctx).ok).toBe(true);
  });

  it('V-05 and V-06 channel amounts within total', () => {
    expect(rules(validateReport({ ...base, total: 100, uber: 150, pickme: 0, dineIn: 200, takeaway: 101 }, ctx))).toEqual([
      'dineIn:exceedsTotal',
      'takeaway:exceedsTotal',
      'uber:exceedsTotal',
    ]);
    expect(rules(validateReport({ ...base, total: 100, uber: 80, pickme: 30 }, ctx))).toEqual(['pickme:deliveryExceedsTotal']);
    expect(rules(validateReport({ ...base, total: 100, uber: 0, pickme: 130 }, ctx))).toEqual(['pickme:exceedsTotal']);
  });

  it('V-07 quiet period is not also busy', () => {
    expect(rules(validateReport({ ...base, busyPeriods: ['After 9pm'], quietPeriod: 'After 9pm' }, ctx))).toEqual([
      'quietPeriod:alsoBusy',
    ]);
  });

  it('V-08 times', () => {
    expect(rules(validateReport({ ...base, openTime: '7:00' }, ctx))).toEqual(['openTime:time']);
    expect(rules(validateReport({ ...base, closeTime: '24:00' }, ctx))).toEqual(['closeTime:time']);
    expect(rules(validateReport({ ...base, closeTime: 1200 }, ctx))).toEqual(['closeTime:time']);
  });

  it('V-09 text length after trimming', () => {
    expect(validateReport({ ...base, comments: ` ${'a'.repeat(1000)} ` }, ctx).ok).toBe(true);
    expect(rules(validateReport({ ...base, comments: 'a'.repeat(1001) }, ctx))).toEqual(['comments:maxLength']);
    expect(rules(validateReport({ ...base, topItems: 42 }, ctx))).toEqual(['topItems:maxLength']);
  });

  it('V-10 enumerations must match exactly', () => {
    expect(rules(validateReport({ ...base, wxMorning: 'sunny' }, ctx))).toEqual(['wxMorning:enum']);
    expect(rules(validateReport({ ...base, busyPeriods: ['Lunch'] }, ctx))).toEqual(['busyPeriods:enum']);
    expect(rules(validateReport({ ...base, conditions: 'Poya day' }, ctx))).toEqual(['conditions:enum']);
  });

  it('reports each field/rule pair once', () => {
    const r = validateReport({ ...base, busyPeriods: ['x', 'y'] }, ctx);
    expect(rules(r)).toEqual(['busyPeriods:enum']);
  });

  it('labels non-object input', () => {
    expect(rules(validateReport('nope', ctx))).toEqual(['report:Invalid input: expected object, received string']);
  });

  it('cleanText strips control characters and trims', () => expect(cleanText('\u0000 hi\r\n')).toBe('hi'));
});
