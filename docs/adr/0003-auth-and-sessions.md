# ADR-0003: Authentication and sessions

- Status: Accepted (Phase 2)
- Date: 2026-11-04
- Requirements: FR-AUTH-01…05, NFR-SEC-01, NFR-SEC-02, OPS-03, C-02

## Context

The SRS fixes: 6-digit PINs, salted SHA-256 hashes in Script Properties, an HMAC-SHA256 token `{ role, deviceId, ver, exp }` valid 30 days, `TOKEN_VERSION` invalidation, and a 5-attempts / 15-minutes lockout via CacheService. It does not fix the token encoding, comparison method, client storage, or lockout key details.

## Decision

**PIN hash.** `hex(SHA-256(PIN_SALT + ":" + pin))` using `Utilities.computeDigest`. `PIN_SALT` is 32 random bytes (hex), created by `setup()`. The Manager and Owner PINs must differ; Admin → Set PINs refuses identical PINs.

**Token format.** `base64url(JSON payload) + "." + base64url(HMAC-SHA256(payloadPart, TOKEN_SECRET))`, using `Utilities.computeHmacSha256Signature`. Payload: `{ role, deviceId, ver, exp }` with `exp` in epoch seconds. `TOKEN_SECRET` is 32 random bytes created by `setup()`.

**Checks on every action except `auth.verify` and health.** Signature (constant-time string compare), `exp` > now, `ver` = current `TOKEN_VERSION`, and `deviceId` in the token = `deviceId` in the request envelope. Failure → `UNAUTHORIZED`; expired or old `ver` → `TOKEN_EXPIRED` (client returns to the PIN screen, drafts kept).

**Lockout.** CacheService key `lock:{deviceId}` counts failures with a 15-minute TTL from the first failure in the window. At 5 failures, key `locked:{deviceId}` is set for 15 minutes; while present, `auth.verify` returns `LOCKED_OUT` without checking the PIN (so a correct 6th PIN is still refused, as the acceptance criterion requires). Every failure and every lockout is written to the Audit sheet with the deviceId, never the PIN.

**Client storage.** APK: token in `@capacitor/preferences`. PWA: token in IndexedDB (`session` store). `deviceId` and device name are stored the same way. Drafts and the outbox are never cleared on sign-out or token expiry (FR-AUTH-04).

**Rotation.** Admin → Set PINs increments `TOKEN_VERSION` (OPS-03), signing out every device.

## Consequences

- A 6-digit PIN has 1,000,000 values; with 5 tries per 15 minutes per deviceId, an attacker who rotates deviceIds is limited only by Apps Script quotas. This is the accepted risk in ADR-0005. Auditing makes it visible.
- Tokens cannot be revoked one by one; only all at once by rotating PINs.
