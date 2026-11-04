import { describe, expect, it } from 'vitest';
import { hasAtMostTwoDecimals, parseInteger, parseMoney, round2 } from './money';

describe('V-02 parseMoney', () => {
  it.each([
    ['1,900', 1900],
    ['Rs 1900/=', 1900],
    ['Rs. 1 900.50', 1900.5],
    ['rs1900', 1900],
    ['1900/=', 1900],
    ['129,849.85', 129849.85],
    ['.5', 0.5],
    ['12.', 12],
  ])('UAT-01 accepts %s', (input, expected) => expect(parseMoney(input)).toBe(expected));

  it('returns null for empty input', () => expect(parseMoney('  ')).toBeNull());
  it.each(['abc', '-1', '1.2.3', 'Rs', '1e5'])('rejects %s', (input) => {
    const v = parseMoney(input);
    expect(v === null || Number.isNaN(v)).toBe(true);
  });
});

describe('V-03 parseInteger', () => {
  it('parses whole numbers with commas', () => expect(parseInteger('1,200')).toBe(1200));
  it('null for empty', () => expect(parseInteger('')).toBeNull());
  it('NaN for decimals', () => expect(parseInteger('4.5')).toBeNaN());
});

describe('hasAtMostTwoDecimals', () => {
  it.each([
    [1900, true],
    [129849.85, true],
    [0.1 + 0.2, true],
    [1.234, false],
  ])('%s → %s', (n, ok) => expect(hasAtMostTwoDecimals(n)).toBe(ok));
});

describe('8.4 round2 rounds half up', () => {
  it.each([
    [2822.8228, 2822.82],
    [0.005, 0.01],
    [1.005, 1.01],
    [2.675, 2.68],
    [-1.005, -1.01],
    [0, 0],
  ])('%s → %s', (n, r) => expect(round2(n)).toBe(r));
});
