import { describe, expect, it } from 'vitest';
import { guardFormula, objectToRow, recordToRow, REPORT_HEADERS, rowToObject, rowToRecord, WEATHER_HEADERS, WEATHER_NUMERIC } from './rows';
import { buildRecord } from './core';
import type { Weather } from '@aluthgama/shared';

const record = buildRecord(
  {
    businessDate: '2026-11-03',
    total: 129849.85,
    bills: 46,
    uber: 0,
    pickme: 1900,
    busyPeriods: ['6pm–9pm', 'After 9pm'],
    openTime: '07:00',
    comments: '=HYPERLINK("http://evil")',
    feedback: '-great coffee',
  },
  null,
  {
    outletId: 'ALU-01',
    openingDate: '2026-11-02',
    at: '2026-11-04T21:42:00+05:30',
    role: 'Manager',
    device: 'Outlet phone',
    submissionId: 'sub-1',
    source: 'app',
  },
);

describe('8.3 Reports sheet layout', () => {
  it('starts with keys, has every 8.1 field, then computed and meta columns', () => {
    expect(REPORT_HEADERS.slice(0, 5)).toEqual(['outletId', 'businessDate', 'dayOfWeek', 'daysSinceOpening', 'total']);
    expect(REPORT_HEADERS.slice(-11)).toEqual([
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
    ]);
    expect(REPORT_HEADERS).toHaveLength(46);
  });

  it('maps a record to a row and back', () => {
    const row = recordToRow(record);
    expect(row[REPORT_HEADERS.indexOf('busyPeriods')]).toBe('6pm–9pm; After 9pm');
    expect(row[REPORT_HEADERS.indexOf('dineIn')]).toBe('');
    expect(row[REPORT_HEADERS.indexOf('daysSinceOpening')]).toBe(1);
    expect(rowToRecord(row)).toEqual({ ...record });
  });

  it('V-11 guards formula-like strings', () => {
    const row = recordToRow(record);
    expect(row[REPORT_HEADERS.indexOf('comments')]).toBe(`'=HYPERLINK("http://evil")`);
    expect(row[REPORT_HEADERS.indexOf('feedback')]).toBe(`'-great coffee`);
    expect(guardFormula('+94 77')).toBe(`'+94 77`);
    expect(guardFormula('@x')).toBe(`'@x`);
    expect(guardFormula('fine')).toBe('fine');
  });

  it('reads null computed values from blank cells', () => {
    const row = recordToRow({ ...record, avgBill: null, deliveryShare: null });
    const back = rowToRecord(row);
    expect(back.avgBill).toBeNull();
    expect(back.deliveryShare).toBeNull();
  });

  it('maps generic objects', () => {
    const w: Weather = {
      date: '2026-11-03',
      avgTempTrading: 28.1,
      maxTemp: 30.4,
      minTemp: 24.8,
      maxFeelsLike: 34.2,
      avgHumidityTrading: 82,
      rainTradingMm: 6.8,
      rainHoursTrading: 4,
      rainDayMm: 9.5,
      source: 'forecast',
      fetchedAt: '2026-11-04T06:00:09+05:30',
    };
    const row = objectToRow(WEATHER_HEADERS, w);
    expect(rowToObject(WEATHER_HEADERS, row, WEATHER_NUMERIC)).toEqual(w);
    expect(rowToObject(['a', 'b'], [null, 5], new Set())).toEqual({ a: '', b: '5' });
  });
});
