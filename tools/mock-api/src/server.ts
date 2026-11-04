// Mock API: the real backend core (backend/src/core.ts) on in-memory services (ADR-0007).
// Adds test controls under /__mock/* and imitates Apps Script's transport quirks (ADR-0004).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { API_VERSION, colomboIso, type ErrorCode } from '@aluthgama/shared';
import { ensureConfigDefaults, ensureSecrets, handleGet, handlePost, seed } from '@aluthgama/backend/core';
import { setPins } from '@aluthgama/backend/auth';
import { createMemoryServices, type MemoryServices } from '@aluthgama/backend/memory';

export const MANAGER_PIN = '111111';
export const OWNER_PIN = '999999';
const DEFAULT_NOW = '2026-11-04T21:42:00+05:30';

interface Controls {
  failNext: { code?: ErrorCode; drop?: boolean }[];
  latencyMs: number;
  redirect: boolean;
}

export function createMock(opts: { redirect?: boolean; now?: string | null } = {}) {
  let s: MemoryServices;
  const controls: Controls = { failNext: [], latencyMs: 0, redirect: opts.redirect ?? true };
  const echoes = new Map<string, string>();

  function reset() {
    s = createMemoryServices();
    const now = opts.now === undefined ? DEFAULT_NOW : opts.now;
    s.clock.now = now ? Date.parse(now) : null;
    ensureSecrets(s);
    ensureConfigDefaults(s);
    setPins(s, MANAGER_PIN, OWNER_PIN);
    const keep = s.clock.now;
    s.clock.now = Date.parse('2026-11-04T09:15:00+05:30');
    seed(s);
    s.clock.now = keep;
    controls.failNext = [];
    controls.latencyMs = 0;
  }
  reset();

  async function readBody(req: IncomingMessage): Promise<string> {
    let b = '';
    for await (const c of req) b += c;
    return b;
  }

  function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body));
  }

  function control(name: string, p: Record<string, unknown>): unknown {
    switch (name) {
      case 'reset':
        reset();
        return { ok: true };
      case 'clock':
        if (typeof p.now === 'string') s.clock.now = Date.parse(p.now);
        if (p.now === null) s.clock.now = null;
        s.clock.offsetMs = typeof p.offsetDays === 'number' ? p.offsetDays * 86_400_000 : 0;
        return { ok: true, now: colomboIso(s.now()) };
      case 'fail': {
        const times = typeof p.times === 'number' ? p.times : 1;
        for (let i = 0; i < times; i++) controls.failNext.push({ code: p.code as ErrorCode, drop: p.drop === true });
        return { ok: true };
      }
      case 'latency':
        controls.latencyMs = Number(p.ms ?? 0);
        return { ok: true };
      case 'redirect':
        controls.redirect = p.on === true;
        return { ok: true };
      case 'config':
        for (const [k, v] of Object.entries(p)) s.store.writeConfig(k, v as string | number | null);
        return { ok: true };
      case 'state':
        return {
          reports: [...s.store.reports.values()],
          log: s.store.log,
          audit: s.store.audit,
          config: s.store.config,
        };
      default:
        return null;
    }
  }

  async function handler(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // Apps Script does not answer CORS preflight; neither do we, so a non-simple request fails in tests too.
    if (req.method === 'OPTIONS') {
      res.writeHead(405);
      res.end();
      return;
    }
    const body = await readBody(req);

    if (url.pathname.startsWith('/__mock/')) {
      const out = control(url.pathname.slice(8), body ? (JSON.parse(body) as Record<string, unknown>) : {});
      return out ? send(res, 200, out) : send(res, 404, { ok: false });
    }
    if (url.pathname.startsWith('/__echo/')) {
      const id = url.pathname.slice(8);
      const out = echoes.get(id);
      echoes.delete(id);
      return out ? send(res, 200, out) : send(res, 404, { ok: false });
    }
    if (controls.latencyMs) await new Promise((r) => setTimeout(r, controls.latencyMs));

    if (req.method === 'GET') return send(res, 200, handleGet(s, Object.fromEntries(url.searchParams)));
    if (req.method !== 'POST') return send(res, 405);

    const forced = controls.failNext.shift();
    if (forced?.drop) {
      req.socket.destroy();
      return;
    }
    const out = forced?.code
      ? { ok: false, error: { code: forced.code, message: `Forced ${forced.code}` }, serverTime: colomboIso(s.now()), apiVersion: API_VERSION }
      : handlePost(s, body);
    const text = JSON.stringify(out);
    if (controls.redirect) {
      const id = randomUUID();
      echoes.set(id, text);
      return send(res, 302, undefined, { Location: `/__echo/${id}` });
    }
    return send(res, 200, text);
  }

  return {
    handler,
    reset,
    get services() {
      return s;
    },
  };
}

export function start(port = Number(process.env.PORT ?? 8787)) {
  const mock = createMock({ now: process.env.MOCK_REAL_TIME === '1' ? null : DEFAULT_NOW });
  const server = createServer((req, res) => {
    mock.handler(req, res).catch((e: unknown) => {
      res.writeHead(500);
      res.end(String(e));
    });
  });
  return new Promise<{ server: typeof server; port: number; mock: typeof mock }>((resolve) =>
    server.listen(port, () => {
      const addr = server.address();
      resolve({ server, mock, port: typeof addr === 'object' && addr ? addr.port : port });
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void start().then(({ port }) =>
    console.log(`Mock API on http://localhost:${port}  (Manager PIN ${MANAGER_PIN}, Owner PIN ${OWNER_PIN})`),
  );
}
