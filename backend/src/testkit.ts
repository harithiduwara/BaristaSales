// Helpers for backend unit tests.
import { createMemoryServices, type MemoryServices } from './memory';
import { ensureConfigDefaults, ensureSecrets, handlePost } from './core';
import { setPins } from './auth';
import type { ApiResponse } from '@aluthgama/shared';

export const MANAGER_PIN = '111111';
export const OWNER_PIN = '999999';

export function setupServices(nowIso = '2026-11-04T21:42:00+05:30'): MemoryServices {
  const s = createMemoryServices();
  s.clock.now = Date.parse(nowIso);
  ensureSecrets(s);
  ensureConfigDefaults(s);
  setPins(s, MANAGER_PIN, OWNER_PIN);
  return s;
}

export function call<D = any>( // eslint-disable-line @typescript-eslint/no-explicit-any -- test helper returns loosely typed data
  s: MemoryServices,
  action: string,
  payload: unknown,
  opts: { token?: string; deviceId?: string; apiVersion?: number; deviceName?: string } = {},
): ApiResponse<D> {
  return handlePost(
    s,
    JSON.stringify({
      apiVersion: opts.apiVersion ?? 1,
      action,
      token: opts.token,
      deviceId: opts.deviceId ?? 'dev-1',
      deviceName: opts.deviceName ?? 'Outlet phone',
      appVersion: '0.1.0-test',
      payload,
    }),
  ) as ApiResponse<D>;
}

export function signIn(s: MemoryServices, pin = MANAGER_PIN, deviceId = 'dev-1'): string {
  const r = call<{ token: string }>(s, 'auth.verify', { pin, deviceName: 'Outlet phone' }, { deviceId });
  if (!r.ok) throw new Error(`sign in failed: ${r.error.code}`);
  return r.data.token;
}

export const errorCode = (r: ApiResponse<unknown>): string | null => (r.ok ? null : r.error.code);
