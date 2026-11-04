# ADR-0005: Accepting a public /exec URL

- Status: Accepted (Phase 2)
- Date: 2026-11-04
- Requirements: NFR-SEC-03, R-02

## Context

The web app must be deployed with "Who has access: Anyone" so the app can call it without Google sign-in. The `/exec` URL is baked into the PWA and APK, both of which are public. Anyone who finds the URL can call it.

## Decision

Accept the risk, as the SRS directs, with these layers:

1. PIN + signed, expiring token on every data action (ADR-0003).
2. Lockout per deviceId and an Audit row for every failed sign-in and every forbidden action.
3. Server-side validation of every request with the shared schema (NFR-SEC-02), formula-injection guard on every string written to the Sheet (V-11).
4. The health action returns no data.
5. No customer personal data is stored (8.5), so a breach exposes sales figures only.
6. The Owner reviews the Audit sheet weekly (runbook).

## Consequences

- Denial-of-service against the Apps Script quota is possible and not mitigated beyond Google's own limits. Reports survive in the phone's outbox until the service recovers (NFR-REL-01).
- If abuse appears in the Audit sheet, the response is: rotate PINs (OPS-03), and if needed redeploy to a new URL and ship a new APK (a new URL breaks old builds).
