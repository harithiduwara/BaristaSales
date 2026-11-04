# ADR-0012: Phase 2 deviations and interpretations

- Status: Proposed — for Owner approval at the Phase 2 gate
- Date: 2026-11-04
- Requirements: as listed per item

## Context

Section 0 asks for every deviation to be recorded. These are the places where Phase 2 differs from, or interprets, the SRS.

## Decision

1. **Dashboard deferred to Phase 3 (FR-DSH-\*, S-10).** The bottom navigation shows Home, History and Settings. The Dashboard tab is added with the dashboard in Phase 3. The Owner's month-to-date strip on Home (S-03) is already live.
2. **Status bar follows the phone's theme, not the in-app theme choice (AND-03, FR-SET-04).** Native status-bar colours change with the Android light/dark setting (`values-night`). Following the in-app System/Light/Dark switch would need `@capacitor/status-bar`, which is not in the 5.2 plugin list. See OQ-20.
3. **Pull-to-refresh (S-07)** is a Refresh button in the History app bar. A pull gesture conflicts with the WebView's own scrolling and adds no information.
4. **Money fields select their whole value on focus.** Typing then replaces the amount instead of appending to it. This was found by the E2E tests and suits a phone keypad.
5. **Wrong-PIN feedback.** The 5th wrong PIN still shows "Wrong PIN"; the 6th attempt (even the correct PIN) shows the lockout message, as the FR-AUTH-03 acceptance criterion says.
6. **Envelope `deviceName`** — see ADR-0004 addendum.
7. **Check for update (FR-SET-05)** is Phase 3, as Section 15.1 lists it there.

## Consequences

The Owner approves or rejects each item at the Phase 2 gate.
