# ADR-0010: Client storage and the outbox

- Status: Accepted (Phase 2)
- Date: 2026-11-04
- Requirements: FR-REP-07, FR-REP-08, FR-REP-09, FR-SET-02, NFR-REL-01, NFR-OFF-01, FR-DSH-07

## Context

The SRS fixes IndexedDB via `idb`, draft keys `draft:{businessDate}`, the outbox, retry timings and the sync chip text. It does not fix the database layout or how the outbox avoids sending twice from two tabs.

## Decision

One IndexedDB database `aluthgama-daily`, version 1, object stores:

| Store       | Key                    | Holds                                                                                                 |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `drafts`    | `draft:{businessDate}` | form values, `baseVersion`, `updatedAt`                                                               |
| `outbox`    | `submissionId`         | envelope payload, `status` (`waiting`, `sending`, `failed`), `attempts`, `nextAttemptAt`, `lastError` |
| `reports`   | `businessDate`         | last known server copy + weather, for offline history and dashboard                                   |
| `dashboard` | `month`                | last `dashboard.summary` response + `fetchedAt`                                                       |
| `syncLog`   | auto-increment         | `{ at, action, result, errorCode }`, trimmed to the last 50 (FR-SET-02)                               |
| `session`   | key                    | PWA only: token, deviceId, device name (ADR-0003)                                                     |

**Write order (NFR-REL-01).** The outbox row is written and the transaction committed _before_ the network call. The draft is deleted only after the server confirms. Force-closing at any moment leaves the report in the outbox or the Sheet.

**One sender at a time.** The outbox runner takes a Web Locks API lock (`navigator.locks.request("outbox", …)`) so two tabs (PWA on desktop) never send the same item at once. Idempotency on the server (FR-REP-08) is the second guard.

**Retry.** Backoff 5 s, 15 s, 60 s, then 5 min repeating. Triggers: app start, `online` event / Network plugin, app resume (`@capacitor/app`), and the timer. Only network errors, `BUSY` and `INTERNAL` are retried automatically (7.4). Any other error (e.g. `VALIDATION_FAILED`, `EDIT_WINDOW_CLOSED`, `CONFLICT`) moves the item to `failed` and the sync chip shows "Couldn't send – tap for details".

**Storage persistence.** On first run the PWA calls `navigator.storage.persist()` so the browser does not evict unsent reports.

## Consequences

- The outbox is the single path for submitting, online or offline, so there is one code path to test (E2E-03, UAT-07).

## Phase 2 notes

- Only one unsent copy per business date is kept: submitting the same date again replaces the older unsent item, so a later edit never races an earlier one.
- A rejected send (`VALIDATION_FAILED`, `EDIT_WINDOW_CLOSED`, `CONFLICT`) during the wizard's own submit is handed back to the wizard and removed from the outbox; the same error during a background retry leaves the item as "Couldn't send" for Settings → Unsent reports (retry, open, discard).
- After a successful send the draft for that date is deleted (FR-REP-07) and the saved record is cached for offline History.
