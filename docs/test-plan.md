# Test plan

Covers REQUIREMENTS.md Section 12. Test names carry the requirement ID, e.g. `it("FR-SHR-01 formats the 3 Nov seed exactly", …)`.

## 1. Levels and gates

| Level | Tool | Where | What | Gate |
|-------|------|-------|------|------|
| Unit | Vitest 5 + coverage-v8 | `packages/shared`, `backend/src` (pure logic) | zod schema and every V-rule, `calc.*`, `format.*` (money, dates, WhatsApp), money input parsing, token sign/verify, PIN hash, lockout counter, upsert decision (create / update / duplicate / conflict / edit window), weather summariser, formula-injection guard | CI `unit`; ≥ 80 % lines overall, **100 %** for `packages/shared` (NFR-MNT-02) |
| Component | Vitest + React Testing Library (jsdom) | `apps/web/src/components` | Every component in 10.3, each documented state (default, focus, disabled, error, loading, empty) | CI `unit` |
| E2E | Playwright 1.64, Pixel 7 device | `apps/web/e2e` against `tools/mock-api` | E2E-01 … E2E-09 | CI `e2e` |
| Accessibility | @axe-core/playwright | same | S-01 … S-11, light and dark | CI `e2e`; zero serious/critical |
| Integration | Node script | `backend/integration` against the TEST deployment | auth, upsert, idempotency, conflict, list, dashboard, weather | `workflow_dispatch` with `run_integration: true`, before each release |
| Device | Manual checklist | outlet phone | install over previous build, offline submit, share to WhatsApp, update check, font size 200 % | before each release |
| UAT | Manager + Owner | outlet phone | UAT-01 … UAT-10 | Owner sign-off |

## 2. Unit test inventory (minimum)

### packages/shared
- `schema`: V-01 (opening date, future date, Asia/Colombo "today" at 23:59 and 00:01), V-02 (bounds, 2 dp, inputs `1,900`, `Rs 1900/=`, `Rs. 1 900`, `1900/=`, `abc`, `-1`, `1.234`), V-03, V-04, V-05, V-06, V-07, V-08 (close after midnight), V-09 (trim, length, control chars), V-10.
- `calc`: `avgBill` (bills 0 → null), `deliverySales`, `deliveryShare` (total 0 → null), `walkInSales`, `movingAverage(7)` (fewer than 7 points, gaps), `projectedMonthEnd` and `requiredDaily` (month starting before OPENING_DATE, target reached, last day of month → OQ-11), `weekdayAverages`, `reconciliationDiff` (direction and ≥ Rs 1 threshold), `trailingAverage` (OQ-10).
- `format`: money display `129,849.85`, `Rs 129,849.85`; dates `Tue 3 Nov 2026`, `Tue 3 Nov`, `03/11/2026`; round half up (`2,822.8228` → `2,822.82`, `0.005` → `0.01`); WhatsApp text for both seed days and the bills-0 case (OQ-13).
- `businessDate.default`: 11:59 → yesterday, 12:00 → today, clamp to OPENING_DATE (OQ-16).

### backend
- Token: valid, bad signature, expired, old `ver`, wrong deviceId.
- PIN: correct Manager, correct Owner, wrong, 5 failures → `LOCKED_OUT`, correct PIN while locked → `LOCKED_OUT`, unlock after 15 min.
- Upsert decision table: new date; same `submissionId` again → `duplicate`, nothing written; `baseVersion` mismatch → `CONFLICT` with current record; Manager editing a date 8 days old → `EDIT_WINDOW_CLOSED`; Owner same → ok.
- Sheet row mapping: column order per 8.3, `;` joins, computed columns, V-11 prefix for `=`, `+`, `-`, `@`.
- Weather summariser: fixed responses for a dry and a wet day; reject 23 values; reject a null temperature.

## 3. E2E journeys (Section 12.2)

Each test starts with `POST /__mock/reset`.

| ID | Steps (abridged) | Assertions |
|----|------------------|-----------|
| E2E-01 | Setup device → PIN `111111` → Start report → total, bills, Uber 0, PickMe 0 → Review → Submit → Share | Success text "Report for … saved."; share opens (mocked `navigator.share` receives the FR-SHR-01 text) |
| E2E-02 | Fill every field on all 4 steps → submit → open in History | Every value shown in detail; mock state matches |
| E2E-03 | Start report → `context.setOffline(true)` → submit → chip "1 waiting to send" → online | Chip "All sent"; mock `state` has exactly one submission for the date |
| E2E-04 | Pick 3 Nov (seeded) | Banner text per FR-REP-03; Load saved → fields pre-filled; submit → version 2 |
| E2E-05 | Two browser contexts load the same report; A submits; B submits | B sees conflict screen; "Keep saved" discards B's change; repeat and "Replace with mine" saves B's values with the next version |
| E2E-06 | Mock clock = seed + 10 days; Manager opens 3 Nov | Edit hidden/disabled, server returns `EDIT_WINDOW_CLOSED` if forced; Owner can edit |
| E2E-07 | 5 wrong PINs then correct PIN | "Too many attempts. Try again in 15 minutes." |
| E2E-08 | Type values → reload page | "Draft restored · last edited HH:mm" and values present |
| E2E-09 | Seed + 5 fixture days, target set | Every KPI card equals the hand-calculated values in `e2e/fixtures/dashboard-expected.json` |

## 4. UAT (Section 12.3)

Run on the outlet phone with the production APK pointing at the TEST deployment first, then production. Record pass/fail, tester, date and build `versionName` in `docs/uat-log.md`.

## 5. Environments

| Env | Backend | Sheet | Used by |
|-----|---------|-------|---------|
| Mock | `tools/mock-api` (in memory) | none | local dev, CI unit/E2E |
| Test | separate Apps Script project | "Aluthgama Daily Report – Data – TEST" | integration suite, UAT dry run |
| Production | production Apps Script project | "Aluthgama Daily Report – Data" | outlet APK, Owner PWA |

`VITE_API_URL` is injected at build time per environment. The tagged APK always points to production (12.4).

## 6. Non-functional checks

| NFR | How it is verified |
|-----|--------------------|
| NFR-PERF-01 | Device test: stopwatch cold start ×5, median < 2.5 s |
| NFR-PERF-02 | CI `build-web`: gzip size of entry chunks ≤ 250 KB; dashboard chunk separate |
| NFR-PERF-03 | Integration suite times 20 upserts, reports p95; E2E with 1 s mock latency checks progress shows after 400 ms |
| NFR-REL-01 | E2E-03, UAT-07, plus a unit test that the outbox row is committed before `fetch` is called |
| NFR-OFF-01 | E2E: offline from start (after first load) — wizard, drafts, cached history and dashboard all render |
| NFR-SEC-01/02 | Unit (token, hash), integration (calls with no/forged token rejected, invalid payload rejected server-side) |
| NFR-A11Y-01/02 | axe suite; Playwright at 200 % text zoom checks no horizontal scroll; reduced-motion emulation |
| NFR-USA-01 | UAT timing with the Manager |
| NFR-I18N-01 | Lint rule: no string literals in JSX outside `i18n/en.json` (eslint `react/jsx-no-literals` with allow-list) |
| NFR-MNT-01/02 | CI `quality` and `unit` |
| NFR-OBS-01 | Integration: forced error returns a correlation ID that appears in the Audit sheet |
