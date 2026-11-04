// Money input parsing (V-02) and rounding (8.4).

/**
 * Parses what a manager types: "1,900", "Rs 1900/=", "Rs. 1 900.50", "1900/=".
 * Returns null for empty input and NaN for anything that is not a plain non-negative number.
 */
export function parseMoney(input: string): number | null {
  const s = input
    .trim()
    .replace(/^rs\.?/i, '')
    .replace(/\/=$/, '')
    .replace(/[\s,]/g, '');
  if (s === '') return null;
  return /^(\d+(\.\d*)?|\.\d+)$/.test(s) ? Number(s) : Number.NaN;
}

/** Whole numbers only (V-03). Returns null for empty input and NaN otherwise. */
export function parseInteger(input: string): number | null {
  const s = input.trim().replace(/[\s,]/g, '');
  if (s === '') return null;
  return /^\d+$/.test(s) ? Number(s) : Number.NaN;
}

/** True when a number has at most two decimal places. */
export function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

/** Round half up to 2 dp, for display only (8.4). Handles binary-float cases such as 1.005. */
export function round2(n: number): number {
  const scaled = Number((Math.abs(n) * 100).toPrecision(15));
  return (Math.sign(n) * Math.round(scaled)) / 100 || 0;
}
