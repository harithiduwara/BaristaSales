import { describe, expect, it } from 'vitest';
import {
  formatDateDmy,
  formatDateLong,
  formatDateShort,
  formatInt,
  formatMoney,
  formatMonth,
  formatPercent,
  formatRs,
  whatsappSummary,
} from './format';
import { SEED_REPORTS } from './constants';

describe('NFR-I18N-01 formats', () => {
  it('money', () => {
    expect(formatMoney(129849.85)).toBe('129,849.85');
    expect(formatMoney(2822.8228)).toBe('2,822.82');
    expect(formatMoney(0)).toBe('0.00');
    expect(formatMoney(1900)).toBe('1,900.00');
    expect(formatMoney(-500)).toBe('-500.00');
    expect(formatRs(129849.85)).toBe('Rs 129,849.85');
    expect(formatInt(12345)).toBe('12,345');
    expect(formatPercent(0.06094)).toBe('6.1%');
    expect(formatPercent(0)).toBe('0.0%');
  });
  it('dates', () => {
    expect(formatDateLong('2026-11-03')).toBe('Tue 3 Nov 2026');
    expect(formatDateShort('2026-11-03')).toBe('Tue 3 Nov');
    expect(formatDateDmy('2026-11-03')).toBe('03/11/2026');
    expect(formatMonth('2026-11')).toBe('November 2026');
  });
});

describe('FR-SHR-01 WhatsApp summary', () => {
  it('UAT-06 matches the 3 Nov seed exactly', () => {
    expect(whatsappSummary(SEED_REPORTS[1])).toBe(
      [
        '*Aluthgama*',
        '',
        'Date - 03/11/2026',
        'Sale - 129,849.85/=',
        'Uber - 0.00/=',
        'Pick me - 1,900.00/=',
        'Ticket - 46',
        'Avg bill - 2,822.82/=',
        '',
        SEED_REPORTS[1].comments,
      ].join('\n'),
    );
  });
  it('ends after Avg bill when there are no comments', () => {
    expect(
      whatsappSummary({
        businessDate: '2026-11-04',
        total: 148320,
        bills: 52,
        uber: 4640,
        pickme: 4400,
        comments: '  ',
      }),
    ).toBe(
      '*Aluthgama*\n\nDate - 04/11/2026\nSale - 148,320.00/=\nUber - 4,640.00/=\nPick me - 4,400.00/=\nTicket - 52\nAvg bill - 2,852.31/=',
    );
  });
  it('OQ-13 leaves out Avg bill when there are no bills', () => {
    expect(
      whatsappSummary({ businessDate: '2026-11-05', total: 0, bills: 0, uber: 0, pickme: 0 }),
    ).not.toContain('Avg bill');
  });
});
