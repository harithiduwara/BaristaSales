# ADR-0004: CORS and transport to Apps Script

- Status: Proposed (Phase 1)
- Date: 2026-11-04
- Requirements: C-02, Section 7.1, FR-BE-06, NFR-PERF-03

## Context

Apps Script web apps do not answer CORS preflight requests and reply to `/exec` with a 302 redirect to `script.googleusercontent.com`, which carries `Access-Control-Allow-Origin: *`. The SRS requires "simple requests": `POST`, `Content-Type: text/plain;charset=utf-8`, JSON string body. The APK runs in Android System WebView from `https://localhost` (Capacitor default scheme).

## Decision

- One client function `callApi(action, payload)` sends `fetch(VITE_API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(envelope), redirect: "follow", credentials: "omit" })`. No other headers, so no preflight.
- Timeouts: an `AbortController` aborts after 30 s (the backend may wait up to 30 s for the lock); the outbox treats an abort as a network error and retries.
- The response is always read as JSON and checked for `ok`; HTTP status is ignored except for network-level failures.
- The health check (S-01) uses `GET ?action=health`, also a simple request.
- **Fallback:** if CORS fails inside the APK WebView during integration testing, enable `CapacitorHttp` for API calls only (native HTTP, no CORS) and record the change in a new ADR, as Section 7.1 allows.

## Consequences

- The mock API server (ADR-0007) behaves the same way: it accepts `text/plain` bodies, always answers HTTP 200, and can be told to answer with a 302 first so the redirect path is tested in E2E.
- Idempotency (FR-REP-08) makes retries after a timeout safe even when the first request actually reached the server.
