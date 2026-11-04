// IndexedDB layout (ADR-0010).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DashboardSummary, ListItem, Weather } from '@aluthgama/shared';
import type { FormValues } from './formModel';

export type OutboxStatus = 'waiting' | 'sending' | 'failed';

export interface OutboxItem {
  submissionId: string;
  businessDate: string;
  baseVersion: number | null;
  report: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  lastError: { code: string; message: string; correlationId?: string | undefined } | null;
}

export interface Draft {
  key: string;
  businessDate: string;
  values: FormValues;
  baseVersion: number | null;
  updatedAt: number;
}

export interface SyncEvent {
  id?: number;
  at: number;
  action: string;
  result: string;
  errorCode: string;
  businessDate?: string;
}

export interface CachedReport extends ListItem {
  cachedAt: number;
}

interface Schema extends DBSchema {
  drafts: { key: string; value: Draft };
  outbox: { key: string; value: OutboxItem; indexes: { byDate: string } };
  reports: { key: string; value: CachedReport };
  weather: { key: string; value: Weather };
  dashboard: { key: string; value: { month: string; data: DashboardSummary; fetchedAt: number } };
  syncLog: { key: number; value: SyncEvent };
  session: { key: string; value: { key: string; value: string } };
}

export type Db = IDBPDatabase<Schema>;
let dbPromise: Promise<Db> | null = null;

export function db(): Promise<Db> {
  dbPromise ??= openDB<Schema>('aluthgama-daily', 1, {
    upgrade(d) {
      d.createObjectStore('drafts', { keyPath: 'key' });
      d.createObjectStore('outbox', { keyPath: 'submissionId' }).createIndex('byDate', 'businessDate');
      d.createObjectStore('reports', { keyPath: 'businessDate' });
      d.createObjectStore('weather', { keyPath: 'date' });
      d.createObjectStore('dashboard', { keyPath: 'month' });
      d.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('session', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

/** Test helper: forget the open connection. */
export function resetDbForTests(): void {
  dbPromise = null;
}

export const draftKey = (date: string): string => `draft:${date}`;

export async function logSync(e: Omit<SyncEvent, 'id'>): Promise<void> {
  const d = await db();
  await d.add('syncLog', e);
  const keys = await d.getAllKeys('syncLog');
  const excess = keys.length - 50;
  for (let i = 0; i < excess; i++) await d.delete('syncLog', keys[i] as number);
}

export async function recentSync(): Promise<SyncEvent[]> {
  return (await (await db()).getAll('syncLog')).reverse();
}
