import { describe, expect, it } from 'vitest';
import {
  addDays,
  canEditDate,
  colomboIso,
  colomboParts,
  colomboTime,
  daysBetween,
  daysInMonth,
  defaultBusinessDate,
  fromDayNumber,
  dayNumber,
  isValidDate,
  monthOf,
  monthShort,
  shiftMonth,
  todayColombo,
  weekday,
} from './dates';

const at = (iso: string) => Date.parse(iso);

describe('Asia/Colombo dates (C-05)', () => {
  it('converts an instant to local date and time', () => {
    expect(colomboParts(at('2026-11-03T18:40:05Z'))).toEqual({ date: '2026-11-04', hour: 0, minute: 10, second: 5 });
    expect(todayColombo(at('2026-11-03T18:29:59Z'))).toBe('2026-11-03');
    expect(colomboIso(at('2026-11-04T16:40:00Z'))).toBe('2026-11-04T22:10:00+05:30');
    expect(colomboTime(at('2026-11-04T16:12:00Z'))).toBe('21:42');
  });

  it('validates calendar dates', () => {
    expect(isValidDate('2026-11-03')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-1-3')).toBe(false);
    expect(isValidDate('nonsense!!')).toBe(false);
  });

  it('does day arithmetic', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(daysBetween('2026-11-02', '2026-11-04')).toBe(2);
    expect(fromDayNumber(dayNumber('2026-11-02'))).toBe('2026-11-02');
    expect(weekday('2026-11-03')).toBe('Tue');
    expect(monthShort('2026-11-03')).toBe('Nov');
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(monthOf('2026-11-03')).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 2)).toBe('2027-01');
  });
});

describe('FR-REP-02 default business date (A-03)', () => {
  it('is yesterday before 12:00', () => expect(defaultBusinessDate(at('2026-11-05T06:29:00Z'), 12, '2026-11-02')).toBe('2026-11-04'));
  it('is today from 12:00', () => expect(defaultBusinessDate(at('2026-11-05T06:30:00Z'), 12, '2026-11-02')).toBe('2026-11-05'));
  it('is clamped to the opening date (OQ-16)', () =>
    expect(defaultBusinessDate(at('2026-11-02T01:00:00Z'), 12, '2026-11-02')).toBe('2026-11-02'));
});

describe('FR-HIS-03 edit window', () => {
  it('lets the Manager edit within 7 days only', () => {
    expect(canEditDate('Manager', '2026-11-03', '2026-11-10', 7)).toBe(true);
    expect(canEditDate('Manager', '2026-11-03', '2026-11-11', 7)).toBe(false);
  });
  it('lets the Owner edit any date', () => expect(canEditDate('Owner', '2026-11-03', '2027-11-11', 7)).toBe(true));
});
