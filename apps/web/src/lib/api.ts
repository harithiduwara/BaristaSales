// API client (7.1, ADR-0004): POST text/plain JSON, follow the redirect, read `ok`.
import {
  API_VERSION,
  type ActionName,
  type Actions,
  type ApiError,
  type ApiResponse,
  type ErrorCode,
  type HealthResponse,
} from '@aluthgama/shared';
import { API_URL, APP_VERSION } from './env';
import { session, signOut } from './session';

export const REQUEST_TIMEOUT_MS = 35_000;

export class ApiCallError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly error: ApiError | null = null,
  ) {
    super(message);
    this.name = 'ApiCallError';
  }
  get isNetwork(): boolean {
    return this.code === 'NETWORK';
  }
  /** 7.4: retried automatically. */
  get retryable(): boolean {
    return this.code === 'NETWORK' || this.code === 'BUSY' || this.code === 'INTERNAL';
  }
  get isAuth(): boolean {
    return this.code === 'UNAUTHORIZED' || this.code === 'TOKEN_EXPIRED';
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, credentials: 'omit', redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

export async function callApi<A extends ActionName>(
  action: A,
  payload: Actions[A]['payload'],
  opts: { timeoutMs?: number } = {},
): Promise<Actions[A]['data']> {
  const s = session.get();
  const envelope = {
    apiVersion: API_VERSION,
    action,
    token: s.token ?? undefined,
    deviceId: s.deviceId ?? 'unregistered',
    deviceName: s.deviceName ?? undefined,
    appVersion: APP_VERSION,
    payload,
  };
  let res: Response;
  let body: ApiResponse<Actions[A]['data']>;
  try {
    res = await fetchWithTimeout(
      API_URL,
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(envelope) },
      opts.timeoutMs ?? REQUEST_TIMEOUT_MS,
    );
    body = (await res.json()) as ApiResponse<Actions[A]['data']>;
  } catch {
    throw new ApiCallError('NETWORK', 'Network error');
  }
  if (body.ok) return body.data;
  const err = new ApiCallError(body.error.code, body.error.message, body.error);
  if (err.isAuth && action !== 'auth.verify') await signOut();
  throw err;
}

export async function checkHealth(timeoutMs = 10_000): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_URL}?action=health`, { method: 'GET' }, timeoutMs);
    const body = (await res.json()) as HealthResponse;
    return body.ok === true;
  } catch {
    return false;
  }
}
