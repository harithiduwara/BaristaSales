// Reading reports: from the server when online, from the IndexedDB cache otherwise (NFR-OFF-01).
import {
  addDays,
  type ListItem,
  type ReportRecord,
  type Weather,
  type DashboardSummary,
} from '@aluthgama/shared';
import { callApi } from './api';
import { db } from './db';

export async function cacheItems(items: ListItem[]): Promise<void> {
  const d = await db();
  const tx = d.transaction('reports', 'readwrite');
  for (const i of items) await tx.store.put({ ...i, cachedAt: Date.now() });
  await tx.done;
}

export async function cachedRange(from: string, to: string): Promise<ListItem[]> {
  const all = await (await db()).getAll('reports');
  return all
    .filter((r) => r.businessDate >= from && r.businessDate <= to)
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate));
}

export interface ListResult {
  items: ListItem[];
  nextCursor: string | null;
  fromCache: boolean;
}

export async function listReports(
  from: string,
  to: string,
  cursor: string | null = null,
): Promise<ListResult> {
  try {
    const data = await callApi('report.list', { from, to, cursor });
    await cacheItems(data.items);
    return { ...data, fromCache: false };
  } catch (e) {
    const items = await cachedRange(from, to);
    if (items.length === 0 && !(e as { isNetwork?: boolean }).isNetwork) throw e;
    return { items, nextCursor: null, fromCache: true };
  }
}

export interface GetResult {
  report: ReportRecord | null;
  weather: Weather | null;
  fromCache: boolean;
}

export async function getReport(date: string): Promise<GetResult> {
  try {
    const data = await callApi('report.get', { businessDate: date });
    if (data.report) await cacheItems([{ ...data.report, weather: data.weather }]);
    else await (await db()).delete('reports', date);
    return { ...data, fromCache: false };
  } catch (e) {
    const c = await (await db()).get('reports', date);
    if (!c && !(e as { isNetwork?: boolean }).isNetwork) throw e;
    return { report: c ?? null, weather: c?.weather ?? null, fromCache: true };
  }
}

export const last7 = (today: string) => cachedRange(addDays(today, -7), today);

export async function getDashboard(
  month: string,
): Promise<{ data: DashboardSummary; fetchedAt: number; fromCache: boolean } | null> {
  const d = await db();
  try {
    const data = await callApi('dashboard.summary', { month });
    const fetchedAt = Date.now();
    await d.put('dashboard', { month, data, fetchedAt });
    return { data, fetchedAt, fromCache: false };
  } catch {
    const c = await d.get('dashboard', month);
    return c ? { ...c, fromCache: true } : null;
  }
}
