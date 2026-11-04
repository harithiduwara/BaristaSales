// The outbox: the single path for sending reports, online or offline (FR-REP-08, FR-REP-09, NFR-REL-01, ADR-0010).
import type { Report, ReportRecord } from '@aluthgama/shared';
import { ApiCallError, callApi } from './api';
import { db, draftKey, logSync, type OutboxItem } from './db';
import { createStore } from './store';

/** Retry delays after the 1st, 2nd, 3rd and later failures (FR-REP-09). */
export const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000] as const;
export const backoff = (attempts: number): number =>
  BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[0];

export interface OutboxSummary {
  waiting: number;
  failed: number;
  items: OutboxItem[];
}

export const outboxState = createStore<OutboxSummary>({ waiting: 0, failed: 0, items: [] });

/** Set when the server says the session is no longer valid; the app shows the PIN screen. */
export const authLost = createStore<number>(0);

export async function refreshOutboxState(): Promise<void> {
  const items = (await (await db()).getAll('outbox')).sort((a, b) => a.createdAt - b.createdAt);
  outboxState.set({
    items,
    waiting: items.filter((i) => i.status !== 'failed').length,
    failed: items.filter((i) => i.status === 'failed').length,
  });
}

export type SendOutcome =
  | { kind: 'sent'; record: ReportRecord }
  | { kind: 'queued'; error: ApiCallError }
  | { kind: 'rejected'; error: ApiCallError };

let chain: Promise<unknown> = Promise.resolve();
/** One sender at a time, across tabs where the Web Locks API exists. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  const run = locks ? () => locks.request('aluthgama-outbox', fn) : fn;
  const next = chain.then(run, run) as Promise<T>;
  chain = next.catch(() => undefined);
  return next;
}

async function sendOne(item: OutboxItem): Promise<SendOutcome> {
  const d = await db();
  await d.put('outbox', { ...item, status: 'sending' });
  try {
    const data = await callApi('report.upsert', {
      submissionId: item.submissionId,
      baseVersion: item.baseVersion,
      report: item.report,
    });
    const tx = d.transaction(['outbox', 'drafts', 'reports'], 'readwrite');
    await tx.objectStore('outbox').delete(item.submissionId);
    await tx.objectStore('drafts').delete(draftKey(item.businessDate));
    const cached = await tx.objectStore('reports').get(item.businessDate);
    await tx
      .objectStore('reports')
      .put({ ...data.report, weather: cached?.weather ?? null, cachedAt: Date.now() });
    await tx.done;
    await logSync({
      at: Date.now(),
      action: 'report.upsert',
      result: data.version > 1 ? 'updated' : 'created',
      errorCode: '',
      businessDate: item.businessDate,
    });
    return { kind: 'sent', record: data.report };
  } catch (e) {
    const err = e instanceof ApiCallError ? e : new ApiCallError('NETWORK', String(e));
    const lastError = { code: err.code, message: err.message, correlationId: err.error?.correlationId };
    if (err.retryable || err.isAuth) {
      const attempts = err.isAuth ? item.attempts : item.attempts + 1;
      await d.put('outbox', {
        ...item,
        status: 'waiting',
        attempts,
        nextAttemptAt: err.isAuth ? 0 : Date.now() + backoff(attempts),
        lastError,
      });
      if (err.isAuth) authLost.set((n) => n + 1);
      await logSync({
        at: Date.now(),
        action: 'report.upsert',
        result: 'retry',
        errorCode: err.code,
        businessDate: item.businessDate,
      });
      return { kind: 'queued', error: err };
    }
    await d.put('outbox', { ...item, status: 'failed', attempts: item.attempts + 1, lastError });
    await logSync({
      at: Date.now(),
      action: 'report.upsert',
      result: 'rejected',
      errorCode: err.code,
      businessDate: item.businessDate,
    });
    return { kind: 'rejected', error: err };
  }
}

/**
 * Stores the report in the outbox, then tries to send it straight away.
 * The outbox row is committed before any network call (NFR-REL-01).
 */
export async function submitReport(
  report: Report,
  baseVersion: number | null,
): Promise<{ submissionId: string; outcome: SendOutcome }> {
  const item: OutboxItem = {
    submissionId: crypto.randomUUID(),
    businessDate: report.businessDate,
    baseVersion,
    report: report as unknown as Record<string, unknown>,
    status: 'waiting',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
    lastError: null,
  };
  const d = await db();
  // Only one unsent copy per date: a newer submission replaces an older unsent one.
  for (const old of await d.getAllFromIndex('outbox', 'byDate', report.businessDate))
    await d.delete('outbox', old.submissionId);
  await d.put('outbox', item);
  await refreshOutboxState();
  const outcome = await exclusive(() => sendOne(item));
  await refreshOutboxState();
  schedule();
  return { submissionId: item.submissionId, outcome };
}

/** Removes an item, e.g. after the wizard took over a rejected report, or the user discarded it. */
export async function removeFromOutbox(submissionId: string): Promise<void> {
  await (await db()).delete('outbox', submissionId);
  await refreshOutboxState();
}

let processing: Promise<void> | null = null;

/** Sends every due item. Safe to call often. */
export function processOutbox(opts: { force?: boolean } = {}): Promise<void> {
  processing ??= exclusive(async () => {
    const d = await db();
    const now = Date.now();
    const due = (await d.getAll('outbox'))
      .filter((i) => i.status !== 'failed' && (opts.force || i.nextAttemptAt <= now))
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const item of due) {
      const r = await sendOne(item);
      if (r.kind === 'queued' && (r.error.isNetwork || r.error.isAuth)) break;
    }
    await refreshOutboxState();
  }).finally(() => {
    processing = null;
    schedule();
  });
  return processing;
}

/** Puts a failed item back in the queue (Settings → Try sending now). */
export async function retryItem(submissionId: string): Promise<void> {
  const d = await db();
  const item = await d.get('outbox', submissionId);
  if (item) await d.put('outbox', { ...item, status: 'waiting', nextAttemptAt: 0 });
  await processOutbox({ force: true });
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Arms a timer for the next due item. */
export function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  const next = outboxState
    .get()
    .items.filter((i) => i.status === 'waiting' && i.nextAttemptAt > 0)
    .reduce((m, i) => Math.min(m, i.nextAttemptAt), Number.POSITIVE_INFINITY);
  if (Number.isFinite(next)) timer = setTimeout(() => void processOutbox(), Math.max(0, next - Date.now()));
}
