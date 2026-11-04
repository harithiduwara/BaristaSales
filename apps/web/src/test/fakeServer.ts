// Routes the app's fetch calls to the real backend core on in-memory services.
import { vi } from 'vitest';
import { ensureConfigDefaults, ensureSecrets, handleGet, handlePost, seed } from '@aluthgama/backend/core';
import { setPins } from '@aluthgama/backend/auth';
import { createMemoryServices, type MemoryServices } from '@aluthgama/backend/memory';

export const NOW = Date.parse('2026-11-04T21:42:00+05:30');

export interface FakeServer {
  s: MemoryServices;
  offline: boolean;
  calls: { action: string; payload: unknown }[];
  fetch: ReturnType<typeof vi.fn>;
}

export function installFakeServer(opts: { seed?: boolean } = {}): FakeServer {
  const s = createMemoryServices();
  s.clock.now = NOW;
  ensureSecrets(s);
  ensureConfigDefaults(s);
  setPins(s, '111111', '999999');
  if (opts.seed !== false) seed(s);
  const server: FakeServer = { s, offline: false, calls: [], fetch: vi.fn() };
  server.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (server.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url, 'http://localhost');
    if ((init?.method ?? 'GET') === 'GET')
      return new Response(JSON.stringify(handleGet(s, Object.fromEntries(u.searchParams))));
    const body = String(init?.body ?? '');
    const env = JSON.parse(body) as { action: string; payload: unknown };
    server.calls.push({ action: env.action, payload: env.payload });
    return new Response(JSON.stringify(handlePost(s, body)));
  });
  vi.stubGlobal('fetch', server.fetch);
  return server;
}
