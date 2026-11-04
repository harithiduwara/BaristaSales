// App-wide state: connectivity, config, theme, and hand-offs between screens.
import { useSyncExternalStore } from 'react';
import { DEFAULT_CONFIG, type Config, type Report, type ReportRecord } from '@aluthgama/shared';
import { createStore, type Store } from '../lib/store';
import { kvGet, kvSet } from '../lib/kv';
import { callApi } from '../lib/api';

export const online = createStore<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
export const config = createStore<Config>(DEFAULT_CONFIG);

export type Theme = 'system' | 'light' | 'dark';
export const theme = createStore<Theme>('system');

export function useStore<T>(s: Store<T>): T {
  return useSyncExternalStore(s.subscribe, s.get);
}

export async function loadCachedConfig(): Promise<void> {
  const raw = await kvGet('config');
  if (raw) config.set({ ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<Config>) });
}

export async function refreshConfig(): Promise<void> {
  try {
    const c = await callApi('config.get', {});
    config.set(c);
    await kvSet('config', JSON.stringify(c));
  } catch {
    // keep the cached config
  }
}

export async function setConfigLocal(c: Config): Promise<void> {
  config.set(c);
  await kvSet('config', JSON.stringify(c));
}

export function applyTheme(t: Theme): void {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

export async function loadTheme(): Promise<void> {
  const v = (await kvGet('theme')) as Theme | null;
  const t = v === 'light' || v === 'dark' ? v : 'system';
  theme.set(t);
  applyTheme(t);
}

export async function saveTheme(t: Theme): Promise<void> {
  theme.set(t);
  applyTheme(t);
  await kvSet('theme', t);
}

/** Wizard → Success screen. */
export interface LastSubmission {
  date: string;
  report: Report;
  queued: boolean;
}
export const lastSubmission = createStore<LastSubmission | null>(null);

/** Wizard → Conflict screen (S-09). */
export interface ConflictState {
  mine: Report;
  current: ReportRecord;
}
export const conflictState = createStore<ConflictState | null>(null);

/** History detail → wizard: load the saved report straight into the form. */
export const editIntent = createStore<string | null>(null);
