# ADR-0007: Mock API server

- Status: Proposed (Phase 1)
- Date: 2026-11-04
- Requirements: 12.1 (E2E), 12.4, Section 7, Phase 1 output

## Context

E2E tests (E2E-01…09) and local development need a server that implements the Section 7 contract. The SRS layout (5.3) does not say where it lives (OQ-18).

## Decision

- Location: `tools/mock-api/`. Plain Node.js (`node:http`), no dependencies, so it starts in well under a second in CI.
- It implements every action in 7.3, the envelope in 7.2, all error codes in 7.4, idempotency on `submissionId`, optimistic concurrency on `baseVersion`, the Manager edit window, lockout, and `GET ?action=health`.
- State is in memory and starts with the two seed reports (8.6).
- Test controls (mock only, never in the real backend), under `POST /__mock/*`:
  - `reset` — restore the seed state;
  - `clock` — set "now" (so E2E-06 can make a report 10 days old);
  - `fail` — make the next N calls fail with a given code or drop the connection (offline/BUSY tests);
  - `redirect` — answer with a 302 to itself first, like Apps Script (ADR-0004);
  - `latency` — add delay (progress indicator after 400 ms, NFR-PERF-03);
  - `state` — dump the store, so tests can assert "appears once".
- PINs in the mock: Manager `111111`, Owner `999999`. These are test values only.
- In Phase 1 the mock carries a minimal copy of the validation rules. In Phase 2 it imports the shared zod schema and calculation functions from `packages/shared`, so the mock and the real backend cannot drift.

## Consequences

- E2E tests run against the same contract the real backend implements; the integration suite (12.1) then checks the real backend against the same cases.
- The mock is not a security reference; its tokens are signed but its secrets are fixed test values.
