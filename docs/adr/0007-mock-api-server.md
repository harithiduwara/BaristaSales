# ADR-0007: Mock API server

- Status: Accepted (Phase 2, amended)
- Date: 2026-11-04
- Requirements: 12.1 (E2E), 12.4, Section 7, Phase 1 output

## Context

E2E tests (E2E-01…09) and local development need a server that implements the Section 7 contract. The SRS layout (5.3) does not say where it lives (OQ-18).

## Decision

- Location: `tools/mock-api/`. A small Node.js server (`node:http`) bundled with esbuild to `dist/server.mjs`.
- It implements every action in 7.3, the envelope in 7.2, all error codes in 7.4, idempotency on `submissionId`, optimistic concurrency on `baseVersion`, the Manager edit window, lockout, and `GET ?action=health`.
- State is in memory and starts with the two seed reports (8.6).
- Test controls (mock only, never in the real backend), under `POST /__mock/*`:
  - `reset` — restore the seed state;
  - `clock` — set "now" (so E2E-06 can make a report 10 days old);
  - `fail` — make the next N calls fail with a given code or drop the connection (offline/BUSY tests);
  - `redirect` — answer with a 302 to itself first, like Apps Script (ADR-0004);
  - `latency` — add delay (progress indicator after 400 ms, NFR-PERF-03);
  - `state` — dump the store, so tests can assert "appears once".
- PINs in the mock: Manager `111111`, Owner `999999`. These are test values only. The mock's clock starts at Wed 4 Nov 2026 21:42 (Asia/Colombo) so tests are repeatable; `MOCK_REAL_TIME=1` uses the real clock.
- **Phase 2 amendment:** the mock now runs the real backend core (`backend/src/core.ts`) on in-memory implementations of its ports (`backend/src/memory.ts`). The mock adds only the transport (HTTP, the 302 redirect) and the test controls. So the E2E suite exercises the same validation, auth, idempotency and concurrency code that runs in Apps Script, and the two cannot drift.

## Consequences

- E2E tests run against the same contract the real backend implements; the integration suite (12.1) then checks the real backend against the same cases.
- The mock is not a security reference; its tokens are signed but its secrets are fixed test values.
