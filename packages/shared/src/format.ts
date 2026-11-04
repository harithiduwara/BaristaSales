// Display formatting (NFR-I18N-01) and the WhatsApp summary (FR-SHR-01).
import { WHATSAPP_TITLE } from './constants';
import { MONTH_NAMES, monthShort, weekday } from './dates';
import { round2 } from './money';
import { avgBill } from './calc';

/** 129849.85 → "129,849.85" (always 2 dp, round half up). */
export function formatMoney(n: number): string {
  const r = round2(n);
  const [int, dec] = Math.abs(r).toFixed(2).split('.') as [string, string];
  return `${r < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

/** "Rs 129,849.85" */
export const formatRs = (n: number): string => `Rs ${formatMoney(n)}`;

/** 0.0609 → "6.1%" */
export const formatPercent = (share: number): string => `${(Math.round(share * 1000) / 10).toFixed(1)}%`;

/** 180 → "180", 12345 → "12,345" */
export const formatInt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "Tue 3 Nov 2026" */
export const formatDateLong = (date: string): string => `${formatDateShort(date)} ${date.slice(0, 4)}`;

/** "Tue 3 Nov" */
export const formatDateShort = (date: string): string =>
  `${weekday(date)} ${Number(date.slice(8, 10))} ${monthShort(date)}`;

/** "03/11/2026" */
export const formatDateDmy = (date: string): string =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

/** "2026-11" → "November 2026" */
export const formatMonth = (month: string): string =>
  `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

export interface WhatsAppInput {
  businessDate: string;
  total: number;
  bills: number;
  uber: number;
  pickme: number;
  comments?: string | undefined;
}

/**
 * The WhatsApp summary, exactly as FR-SHR-01 defines it. The Avg bill line is left out when
 * there are no bills (OQ-13). Comments follow after a blank line when present.
 */
export function whatsappSummary(r: WhatsAppInput): string {
  const lines = [
    `*${WHATSAPP_TITLE}*`,
    '',
    `Date - ${formatDateDmy(r.businessDate)}`,
    `Sale - ${formatMoney(r.total)}/=`,
    `Uber - ${formatMoney(r.uber)}/=`,
    `Pick me - ${formatMoney(r.pickme)}/=`,
    `Ticket - ${r.bills}`,
  ];
  const ab = avgBill(r);
  if (ab !== null) lines.push(`Avg bill - ${formatMoney(ab)}/=`);
  const comments = r.comments?.trim();
  if (comments) lines.push('', comments);
  return lines.join('\n');
}
