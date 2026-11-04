# Barista Aluthgama – Daily Sales Reporting App

## Software Requirements Specification (SRS)

| Item        | Value                                       |
|-------------|---------------------------------------------|
| Document ID | RB-ALU-DSR-SRS                              |
| Version     | 1.1                                         |
| Date        | 4 Nov 2026                                  |
| Owner       | Harith (Royal Bliss (Pvt) Ltd)              |
| Status      | Draft for Owner approval                    |
| Audience    | Claude Code (implementer), Owner (approver) |

---

## 0. Instructions to Claude Code (read first)

1.  **Work phase by phase (Section 15).** At the end of each phase, stop, summarise what was produced, list deviations, and wait for the Owner's approval before starting the next phase.
2.  **Do not invent requirements.** If something is ambiguous or missing, add it to `docs/open-questions.md` and ask. Do not guess silently.
3.  **Every design decision that this SRS does not fix** is recorded as an ADR in `docs/adr/NNNN-title.md` (context, decision, consequences).
4.  **Requirement IDs are binding.** Reference FR/NFR IDs in commit messages, test names and PR descriptions. Keep the traceability matrix (Section 16) up to date.
5.  **Pin every dependency to an exact version** (no `^` or `~`). Use the latest stable version available at build time and record it in the ADR for the stack.
6.  **No secrets in the repository.** PINs, signing keys and HMAC secrets live in Apps Script Script Properties or GitHub Actions secrets only.
7.  Use Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), keep `CHANGELOG.md`, and tag releases `vMAJOR.MINOR.PATCH`.
8.  A requirement is done only when its Definition of Done (Section 15.3) is met.

---

## 1. Introduction

### 1.1 Purpose

Replace the outlet manager's free-text WhatsApp sales message with a structured daily report captured in an Android app. Store every report in a Google Sheet so the Owner (and Claude, via the Google Drive connector) can analyse sales against weather, day of week, channels and targets.

### 1.2 Background

- The outlet is a Barista Coffee franchise at No. 433 Main Street, Aluthgama, Sri Lanka, operated by Royal Bliss (Pvt) Ltd. It opened on **2 Nov 2026**.
- Today the manager sends a WhatsApp message each night with: date, total sales, Uber sales, PickMe sales and ticket count, plus a comment.
- Access to POS system exports is being requested from the franchisor (Barista Accounts). POS integration is **out of scope** for this release (Section 2.2).

### 1.3 Definitions

| Term            | Meaning                                                                  |
|-----------------|--------------------------------------------------------------------------|
| Business date   | The trading day a report covers (Asia/Colombo). Not the submission date. |
| Total net sales | All channels combined, after discounts, in LKR.                          |
| Bill / ticket   | One POS receipt, any channel.                                            |
| Walk-in sales   | Total net sales − Uber Eats − PickMe Food.                               |
| Delivery share  | (Uber Eats + PickMe Food) ÷ Total net sales.                             |
| Average bill    | Total net sales ÷ bills (only when bills \> 0).                          |
| Manager         | Outlet manager who submits reports.                                      |
| Owner           | Harith, or another Royal Bliss director with the Owner PIN.              |
| API             | The Google Apps Script web app that is the app's only backend.           |
| PWA             | The web build of the app, installable from Chrome.                       |
| APK             | The Android build of the same app (Capacitor).                           |

---

## 2. Scope

### 2.1 In scope

1.  Daily report entry (multi-step form) with validation, draft autosave and an offline queue.
2.  Report history: list, view, edit (subject to role and edit window), with conflict detection.
3.  Owner dashboard: month-to-date KPIs, target tracking and trends.
4.  A WhatsApp-ready summary after each submission (share sheet).
5.  A Google Apps Script backend that writes to a Google Sheet, with an audit log.
6.  Automatic weather enrichment for Aluthgama from Open-Meteo.
7.  PIN-based access with Manager and Owner roles.
8.  Delivery as a PWA (GitHub Pages) **and** a signed Android APK (GitHub Actions → GitHub Releases).
9.  Seeding the two reports already received (Section 8.6).
10. Automated tests, CI/CD, and operating documentation.

### 2.2 Out of scope (this release)

- POS / accounting system integration (future phase, depends on the franchisor).
- Inventory, payroll, purchasing, royalty calculation.
- Multiple outlets in the UI (but the data model carries `outletId`; see NFR-MNT-03).
- Google Play Store publishing (the APK is side-loaded).
- iOS app.
- Customer personal data of any kind.

---

## 3. Stakeholders and roles

| Role          | Who                              | Can do                                                                                                                                                                 |
|---------------|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Manager       | Outlet manager (e.g. shift lead) | Sign in with the Manager PIN; create reports; edit own outlet's reports for business dates within the last **7** days; view history (last 60 days); share the summary. |
| Owner         | Harith / directors               | Everything the Manager can do, plus: edit any date, view the dashboard, change settings (target, PINs via the backend), view the sync log.                             |
| Analyst       | Claude (read-only)               | Reads the Google Sheet via the Google Drive connector. No app access.                                                                                                  |
| Administrator | Harith                           | Deploys the backend, manages GitHub secrets, installs the APK.                                                                                                         |

---

## 4. Assumptions, constraints and prerequisites

### 4.1 Prerequisites (Owner provides)

- P-01: A Google account that owns the Sheet and the Apps Script project.
- P-02: A GitHub account and a repository for this code. **On a free GitHub plan, GitHub Pages requires a public repository.** That is acceptable because the repo contains no secrets or data, but confirm it (OQ-05).
- P-03: The outlet's Android phone (model and Android version to be confirmed, OQ-02), with "Install unknown apps" allowed for the browser or file manager used to install the APK.

### 4.2 Constraints

- C-01: Backend is **Google Apps Script** (V8 runtime) and **Google Sheets** only. No paid servers or databases.
- C-02: Apps Script does not answer CORS preflight (`OPTIONS`) requests. Every client request must be a CORS "simple request": `POST` with `Content-Type: text/plain;charset=utf-8` and a JSON string body. The client follows the 302 redirect Apps Script returns (`fetch` does this by default).
- C-03: Apps Script does not support ES modules. Backend source may use modules locally, but the deployed bundle must expose **top-level function declarations** `doPost(e)`, `doGet(e)` and every trigger handler, because Apps Script only discovers top-level functions (use `gas-webpack-plugin` or an equivalent esbuild footer that emits stubs).
- C-04: Android System WebView does not implement the Web Share API. The APK must use the Capacitor Share plugin; the PWA uses `navigator.share`, falling back to a `https://wa.me/?text=` link and then copy-to-clipboard.
- C-05: All times are **Asia/Colombo (UTC+05:30)**. Currency is **LKR**, stored as numbers with 2 decimal places.
- C-06: Branding: the Barista name and logo are the franchisor's. Use them in the app only if the franchise agreement permits (OQ-04). Until confirmed, the app is titled **"Aluthgama Daily Report"** and uses Royal Bliss branding or neutral styling, with no franchisor logo.
- C-07: Fonts are self-hosted (bundled). No runtime calls to Google Fonts or any CDN, so the app works offline.

### 4.3 Assumptions

- A-01: One report per business date per outlet. Re-submitting the same date replaces it (upsert) and keeps the history in the audit log.
- A-02: The outlet trades roughly 07:00–22:00. The weather "trading window" is configurable (`TRADE_START_HOUR`, `TRADE_END_HOUR`).
- A-03: The manager usually submits after closing, sometimes after midnight. The default business date is **yesterday if the local time is before 12:00, otherwise today** (configurable `DATE_CUTOFF_HOUR`, default 12).

---

## 5. Architecture

### 5.1 Overview

    Android phone
     ├─ APK (Capacitor, web assets bundled)  ─┐
     └─ PWA (Chrome, installed to home screen) ┤  HTTPS POST text/plain JSON
                                               ▼
                 Google Apps Script Web App  (/exec, "Execute as: Me", "Anyone")
                    ├─ Auth (PIN → HMAC session token, lockout)
                    ├─ Validation (shared rules, server is authoritative)
                    ├─ Reports upsert + optimistic concurrency
                    ├─ Audit log
                    ├─ Weather enrichment (UrlFetchApp → Open-Meteo)
                    └─ Time-driven triggers (weather backfill, weekly backup)
                                               ▼
                             Google Sheet "Aluthgama Daily Report – Data"
                                               ▼
                         Owner in Sheets  ·  Claude via Google Drive connector

### 5.2 Technology stack (fixed)

| Layer                | Choice                                                                                                                                                                            |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Front end            | React + TypeScript (`strict: true`) + Vite                                                                                                                                        |
| Forms and validation | react-hook-form + zod. **One zod schema** in `packages/shared` used by both client and backend.                                                                                   |
| PWA                  | vite-plugin-pwa (Workbox), web app manifest, offline app shell                                                                                                                    |
| Offline storage      | IndexedDB (via `idb`) for drafts, the outbox queue and a cache of recent reports                                                                                                  |
| Charts               | One charting library, chosen by ADR (e.g. Recharts or Chart.js), tree-shaken                                                                                                      |
| Android              | Capacitor (Android platform), plugins: `@capacitor/share`, `@capacitor/network`, `@capacitor/app`, `@capacitor/preferences`, `@capacitor/browser` (to open the APK download link) |
| Backend              | Google Apps Script, V8 runtime; source in TypeScript or ES modules, bundled to a single file                                                                                      |
| Backend deployment   | `@google/clasp`, run locally by the Administrator (not from CI)                                                                                                                   |
| Unit tests           | Vitest (+ React Testing Library)                                                                                                                                                  |
| End-to-end tests     | Playwright, mobile emulation (Pixel 7 descriptor)                                                                                                                                 |
| Accessibility tests  | `@axe-core/playwright`                                                                                                                                                            |
| Lint and format      | ESLint + Prettier, enforced in CI                                                                                                                                                 |
| CI/CD                | GitHub Actions, full pipeline on every commit (Section 11.1); GitHub Pages for the PWA; GitHub Releases for tagged APKs                                                           |

### 5.3 Repository layout

    /apps/web            React app (shared by the PWA and the APK)
    /apps/android        Capacitor Android project (generated, committed)
    /packages/shared     zod schemas, calculations, formatting, constants, types
    /backend             Apps Script source, appsscript.json, build config, tests
    /docs                adr/, open-questions.md, runbook.md, user-guide.md, test-plan.md
    /.github/workflows   pipeline.yml
    REQUIREMENTS.md      this document
    CHANGELOG.md

---

## 6. Functional requirements

Priority: **M** = must, **S** = should, **C** = could.

### 6.1 Access and session

**FR-AUTH-01 (M) – First-run setup.** On first launch the app asks for a device name (e.g. "Outlet phone") and a PIN. It stores a generated `deviceId` (UUID v4) locally.

**FR-AUTH-02 (M) – PIN sign-in.** The user enters a 6-digit PIN. The backend compares a salted SHA-256 hash against `MANAGER_PIN_HASH` and `OWNER_PIN_HASH` in Script Properties and returns `{ role, token, expiresAt }`.

- The token is an HMAC-SHA256 signed payload `{ role, deviceId, ver, exp }`, signed with `TOKEN_SECRET` (Script Property). `ver` is the current `TOKEN_VERSION` Script Property. It is valid for **30 days**.
- Every other API action requires a valid, unexpired token whose `ver` equals the current `TOKEN_VERSION`. Signature, version and expiry are checked server-side on every call.

**FR-AUTH-03 (M) – Lockout.** After **5** failed PIN attempts from one `deviceId` within 15 minutes, `auth.verify` returns `LOCKED_OUT` for 15 minutes (tracked with CacheService). Every failure is written to the Audit sheet.

**FR-AUTH-04 (M) – Sign out.** Settings → "Sign out" clears the token. Drafts and unsent reports in the outbox are kept, and the user is warned if any are unsent.

**FR-AUTH-05 (S) – Role-aware UI.** Owner-only screens and actions are hidden for the Manager. The backend enforces the same rules regardless of the UI.

Acceptance:

- Given a correct Manager PIN, when the user signs in, then the Home screen shows and the role is Manager.
- Given 5 wrong PINs within 15 minutes, when a 6th attempt is made (even a correct one), then the app shows "Too many attempts. Try again in 15 minutes."
- Given an expired token, when any action is called, then the app returns to the PIN screen without losing drafts.

### 6.2 Daily report entry

**FR-REP-01 (M) – Report wizard.** A 5-step form with a visible stepper. Fields are defined in Section 8.1.

1.  Sales
2.  Payments & adjustments
3.  Customers & operations
4.  Conditions & notes
5.  Review & submit

Users can jump between steps; required-field errors are shown on the step that contains them.

**FR-REP-02 (M) – Business date default.** Default per A-03. The date cannot be in the future or before `OPENING_DATE` (2026-11-02).

**FR-REP-03 (M) – Existing report detection.** When the selected date already has a saved report, show a banner: "A report for Tue 3 Nov is already saved. Submitting replaces it." with the action **Load saved report**. Loading pre-fills every field and sets `baseVersion`.

**FR-REP-04 (M) – Live calculations** (shown on step 1 and on the Review step): average bill, delivery share %, walk-in sales. Formulas are in Section 1.3; they show "–" when inputs are missing.

**FR-REP-05 (M) – Reconciliation warnings** (do not block submission):

- When dine-in or takeaway is entered: if `dineIn + takeaway + uber + pickme` differs from `total` by ≥ Rs 1, show the difference and its direction.
- When cash, card or QR is entered: if `cash + card + qr` differs from `total` by ≥ Rs 1, show the difference.
- Average bill outside Rs 500–20,000 → "Average bill looks unusual. Check the total and bill count."
- Total more than 3× or less than 0.25× the trailing 7-day average (when at least 3 prior reports exist) → "Sales are far from the recent average. Check the figure."

Before submitting with any warning, the user must tick "I've checked these figures."

**FR-REP-06 (M) – Validation (blocking).** Rules are in Section 8.2. Errors are shown inline with the field, plus a summary at the top of the Review step that links to each field.

**FR-REP-07 (M) – Draft autosave.** Every change is saved to IndexedDB (debounced 500 ms) under the key `draft:{businessDate}`. Reopening the app restores the draft and shows "Draft restored · last edited 21:42". The draft is cleared after a successful submit.

**FR-REP-08 (M) – Submit.** On submit the client:

1.  validates with the shared schema;
2.  creates a `submissionId` (UUID v4);
3.  writes the payload to the IndexedDB outbox;
4.  calls `report.upsert`;
5.  on success, removes it from the outbox and shows the Success screen.

The backend is **idempotent** on `submissionId`: a repeated call returns the original result and writes nothing.

**FR-REP-09 (M) – Offline submit.** With no connection, the report stays in the outbox with status "Waiting to send". The outbox retries automatically when connectivity returns (Network plugin or `online` event) and when the app is opened, with exponential backoff (5 s, 15 s, 60 s, 5 min; max 5 min). The Home screen shows a persistent sync status chip: "All sent" / "1 waiting to send" / "Couldn't send – tap for details".

**FR-REP-10 (M) – Concurrency.** Every report row has an integer `version`. An edit sends `baseVersion`. If the stored version differs, the backend returns `CONFLICT` with the current record. The app shows a comparison (yours vs saved) and lets the user choose **Keep saved** or **Replace with mine**. Choosing Replace re-sends with the new `baseVersion`.

**FR-REP-11 (M) – Success screen.** Shows "Report for Tue 3 Nov saved" and the WhatsApp summary (FR-SHR-01), with the actions **Share to WhatsApp**, **Copy** and **Done**.

### 6.3 Sharing

**FR-SHR-01 (M) – WhatsApp summary format.** This must match exactly. It keeps the format the manager's group already uses and adds the Avg bill line:

    *Aluthgama*

    Date - 03/11/2026
    Sale - 129,849.85/=
    Uber - 0.00/=
    Pick me - 1,900.00/=
    Ticket - 46
    Avg bill - 2,822.82/=

    <manager comments, if any>

**FR-SHR-02 (M) – Share mechanism.** APK: Capacitor Share. PWA: `navigator.share` → `https://wa.me/?text=<urlencoded>` → clipboard. Never claim the message was sent; show "Share sheet opened" or "Copied".

### 6.4 History

**FR-HIS-01 (M) – List.** Newest first. Each row shows the date (e.g. "Tue 3 Nov"), total sales, bills, average bill, a sync status icon, and a weather icon once enriched. Manager sees 60 days; Owner sees all, paginated by 30.

**FR-HIS-02 (M) – Detail view.** Shows every field grouped as in the wizard, the computed metrics, the weather metrics (when available), the last submitted time, and the submitting device name.

**FR-HIS-03 (M) – Edit.** "Edit" opens the wizard pre-filled. The Manager can edit only business dates within the last 7 days (server-enforced, `EDIT_WINDOW_DAYS`). The Owner can edit any date.

**FR-HIS-04 (S) – Search and filter.** Owner can filter by month and by special-condition tag (e.g. "Poya day").

### 6.5 Owner dashboard

**FR-DSH-01 (M) – KPI header** for the selected month (default: current month):

- MTD sales
- Monthly target (`MONTHLY_TARGET`) and achievement %
- Projected month-end sales
- Required daily average to hit target
- Average bill (MTD)
- Total bills (MTD)
- Delivery share (MTD)

Definitions:

- `periodStart` = max(first day of month, `OPENING_DATE`); `periodEnd` = last day of month.
- `daysElapsed` = days from `periodStart` to the latest reported business date in the month, inclusive.
- `projected` = MTD ÷ `daysElapsed` × days from `periodStart` to `periodEnd`, inclusive.
- `requiredDaily` = (target − MTD) ÷ days remaining after the latest reported date. Shown as "Target reached" when ≤ 0.
- When `MONTHLY_TARGET` is not set, target cards show "Set a monthly target in Settings".

**FR-DSH-02 (M) – Daily sales chart.** Bars for daily totals, a line for the 7-day moving average, and a dashed reference line for the target daily average (target ÷ days in period). Tooltip shows date, total, bills, average bill and rain (mm).

**FR-DSH-03 (M) – Day-of-week table.** Average sales, bills and average bill per weekday (only weekdays with ≥ 1 report).

**FR-DSH-04 (S) – Channel mix.** Stacked bar per day: dine-in, takeaway, Uber, PickMe. Days without the split show as "Unsplit".

**FR-DSH-05 (S) – Weather vs sales.** A scatter of daily sales against trading-window rainfall (mm), and a second against average temperature.

**FR-DSH-06 (S) – Chain benchmark.** A reference line for the chain average daily sales = `BENCHMARK_MONTHLY_AVG` ÷ days in month. Default `BENCHMARK_MONTHLY_AVG` = 5,720,000 (the franchisor's March 2026 outlet average); editable by the Owner.

**FR-DSH-07 (M) – Data freshness.** Show "Updated 21:42" and a refresh action. The dashboard works from the cached data when offline and labels it "Offline · showing data from …".

### 6.6 Settings

**FR-SET-01 (M)** Device name, signed-in role, app version, API URL (read-only), Sign out. **FR-SET-02 (M)** Sync log: the last 50 outbox events (time, action, result, error code). **FR-SET-03 (M, Owner)** Edit `MONTHLY_TARGET` and `BENCHMARK_MONTHLY_AVG` via `config.update`. PINs are not changed in the app; see the runbook. **FR-SET-04 (S)** Theme: System / Light / Dark. **FR-SET-05 (S, APK only)** "Check for update": compares the app version with `version.json` on GitHub Pages; when newer, opens the GitHub Release APK link.

### 6.7 Backend: data, weather and maintenance

**FR-BE-01 (M) – Setup function.** The Apps Script project is **bound to the spreadsheet** (created with `clasp create --type sheets`), so admin functions can use a custom menu. `onOpen()` adds an **Admin** menu with *Run setup*, *Set PINs*, *Load seed data* and *Fetch missing weather now*. All data access uses `SpreadsheetApp.openById(SHEET_ID)`, never the active spreadsheet, so restore (OPS-04) works.

`setup()` (run once by the Administrator) does the following. It is idempotent: re-running does not duplicate anything.

- creates the tabs in Section 8.3 and their headers in the bound spreadsheet, and stores its ID as `SHEET_ID`;
- sets the Sheet time zone to Asia/Colombo;
- writes Config defaults;
- creates the triggers in FR-BE-04 and FR-BE-05;
- logs the Sheet URL.

**FR-BE-02 (M) – Upsert.** `report.upsert` takes `LockService.getScriptLock()` (wait up to 30 s), then:

1.  checks `submissionId` idempotency;
2.  validates with the shared schema;
3.  checks the role and edit window;
4.  checks `baseVersion`;
5.  writes or replaces the row in **Reports** (key = `outletId` + `businessDate`), incrementing `version`;
6.  appends to **Submissions_Log**;
7.  releases the lock;
8.  returns `{ report, version }`.

**FR-BE-03 (M) – Weather enrichment on submit.** After a successful upsert for a past date (outside the lock), fetch weather for that date if the Weather sheet has no row. Weather failure never fails the submission.

**FR-BE-04 (M) – Daily weather backfill.** Time-driven trigger at 06:00 Asia/Colombo: fill missing weather for every date from `OPENING_DATE` to yesterday (at most 31 dates per run).

- Source order: Open-Meteo forecast endpoint (`/v1/forecast` with `start_date`/`end_date`), then the archive endpoint (`archive-api.open-meteo.com/v1/archive`) for older dates.
- Hourly variables: `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `precipitation`.
- `latitude=6.4333`, `longitude=80.0000`, `timezone=Asia/Colombo` (all from Config).
- Reject a response that has fewer than 24 hourly values or any null temperature.
- Store the metrics in Section 8.3 (Weather).

**FR-BE-05 (S) – Weekly backup.** Sunday 03:00 trigger: copy the spreadsheet to a Drive folder named "Aluthgama Daily Report – Backups", keeping the latest 8 copies.

**FR-BE-06 (M) – Health check.** `doGet` with `?action=health` returns `{ ok: true, apiVersion, serverTime }` without auth (no data).

---

## 7. API contract

### 7.1 Transport

- One URL: the Apps Script web app `/exec` URL, set as `VITE_API_URL` at build time.
- Request: `POST`, header `Content-Type: text/plain;charset=utf-8`, body = JSON string.
- Response: JSON (`ContentService` with MimeType JSON). The HTTP status is always 200 from Apps Script, so callers must read `ok`.
- If CORS fails inside the APK WebView during integration testing, enable `CapacitorHttp` for API calls and record it in an ADR.

### 7.2 Envelope

``` json
// request
{ "apiVersion": 1, "action": "report.upsert", "token": "…", "deviceId": "…", "appVersion": "1.0.0", "payload": { } }

// success
{ "ok": true, "data": { }, "serverTime": "2026-11-04T22:10:00+05:30", "apiVersion": 1 }

// failure
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "…", "details": [ { "field": "bills", "rule": "integer" } ] },
  "serverTime": "…", "apiVersion": 1 }
```

### 7.3 Actions

| Action              | Role          | Payload                                        | Data returned                         |
|---------------------|---------------|------------------------------------------------|---------------------------------------|
| `auth.verify`       | none          | `{ pin, deviceName }`                          | `{ role, token, expiresAt }`          |
| `report.upsert`     | Manager/Owner | `{ submissionId, baseVersion | null, report }` | `{ report, version }`                 |
| `report.get`        | Manager/Owner | `{ businessDate }`                             | `{ report | null, weather | null }`   |
| `report.list`       | Manager/Owner | `{ from, to, cursor? }`                        | `{ items: [...], nextCursor | null }` |
| `dashboard.summary` | Owner         | `{ month: "YYYY-MM" }`                         | KPIs + daily series + weekday table   |
| `config.get`        | Manager/Owner | `{}`                                           | public config (no secrets)            |
| `config.update`     | Owner         | `{ MONTHLY_TARGET?, BENCHMARK_MONTHLY_AVG? }`  | updated config                        |

### 7.4 Error codes

`UNAUTHORIZED`, `TOKEN_EXPIRED`, `LOCKED_OUT`, `FORBIDDEN`, `VALIDATION_FAILED`, `EDIT_WINDOW_CLOSED`, `CONFLICT`, `NOT_FOUND`, `BUSY` (lock timeout), `UNSUPPORTED_API_VERSION`, `INTERNAL`. The client maps each to a user-facing message (Section 10.6). It retries automatically only on `BUSY`, `INTERNAL` and network errors.

---

## 8. Data

### 8.1 Report fields

| Field                                           | Key                     | Type                                                     | Required        | Step |
|-------------------------------------------------|-------------------------|----------------------------------------------------------|-----------------|------|
| Business date                                   | `businessDate`          | `YYYY-MM-DD`                                             | Yes             | 1    |
| Total net sales (Rs)                            | `total`                 | money                                                    | Yes             | 1    |
| Bills / tickets                                 | `bills`                 | integer                                                  | Yes             | 1    |
| Dine-in sales (Rs)                              | `dineIn`                | money                                                    | No              | 1    |
| Takeaway sales (Rs), walk-in only               | `takeaway`              | money                                                    | No              | 1    |
| Uber Eats sales (Rs)                            | `uber`                  | money                                                    | Yes (0 allowed) | 1    |
| Uber Eats orders                                | `uberOrders`            | integer                                                  | No              | 1    |
| PickMe Food sales (Rs)                          | `pickme`                | money                                                    | Yes (0 allowed) | 1    |
| PickMe Food orders                              | `pickmeOrders`          | integer                                                  | No              | 1    |
| Cash (Rs)                                       | `cash`                  | money                                                    | No              | 2    |
| Card (Rs)                                       | `card`                  | money                                                    | No              | 2    |
| QR / transfer / other (Rs)                      | `qr`                    | money                                                    | No              | 2    |
| Discounts given (Rs)                            | `discounts`             | money                                                    | No              | 2    |
| Complimentary / staff meals (Rs, at menu price) | `comps`                 | money                                                    | No              | 2    |
| Voids / refunds (Rs)                            | `voids`                 | money                                                    | No              | 2    |
| Foreign customers (approx.)                     | `foreignCustomers`      | integer                                                  | No              | 3    |
| Busiest periods                                 | `busyPeriods`           | multi-select of PERIODS                                  | No              | 3    |
| Quietest period                                 | `quietPeriod`           | single-select of PERIODS                                 | No              | 3    |
| Top 3 selling items                             | `topItems`              | text ≤ 200                                               | No              | 3    |
| Items out of stock                              | `stockOuts`             | text ≤ 500                                               | No              | 3    |
| Staff on duty                                   | `staffOnDuty`           | integer                                                  | No              | 3    |
| Opened at                                       | `openTime`              | `HH:mm`                                                  | No              | 3    |
| Closed at                                       | `closeTime`             | `HH:mm`                                                  | No              | 3    |
| Weather – morning / afternoon / evening / night | `wxMorning` … `wxNight` | single-select of WEATHER                                 | No              | 4    |
| Special conditions                              | `conditions`            | multi-select of CONDITIONS + optional "Other" text ≤ 100 | No              | 4    |
| Promotions running                              | `promotions`            | text ≤ 200                                               | No              | 4    |
| Customer feedback / complaints                  | `feedback`              | text ≤ 1000                                              | No              | 4    |
| Manager comments                                | `comments`              | text ≤ 1000                                              | No              | 4    |

Enumerations (in `packages/shared/constants.ts`):

- PERIODS: `Before 10am`, `10am–12pm`, `12pm–3pm`, `3pm–6pm`, `6pm–9pm`, `After 9pm`
- WEATHER: `Sunny`, `Cloudy`, `Light rain`, `Heavy rain`
- CONDITIONS: `Normal day`, `Public holiday`, `Poya day`, `School holiday`, `Local event / festival`, `Power cut`, `Road closure / traffic`, `Promotion running`, `Delivery app issue`, `Short-staffed`

Helper text under Feedback and Comments: "Don't enter customer names or phone numbers."

### 8.2 Validation rules (shared schema; server is authoritative)

| ID   | Rule                                                                                                                                                              |
|------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| V-01 | `businessDate` is a valid date, ≥ `OPENING_DATE`, ≤ today (Asia/Colombo).                                                                                         |
| V-02 | Money fields: number ≥ 0 and ≤ 10,000,000, at most 2 decimals. The input accepts commas, spaces, "Rs", "Rs." and a trailing "/=", and strips them before parsing. |
| V-03 | Integer fields: whole number ≥ 0 and ≤ 100,000.                                                                                                                   |
| V-04 | If `total` \> 0 then `bills` ≥ 1.                                                                                                                                 |
| V-05 | Each of `uber`, `pickme`, `dineIn`, `takeaway` is ≤ `total`.                                                                                                      |
| V-06 | `uber` + `pickme` ≤ `total`.                                                                                                                                      |
| V-07 | `quietPeriod` is not one of `busyPeriods`.                                                                                                                        |
| V-08 | `closeTime` and `openTime` are valid `HH:mm` (close may be earlier than open, meaning after midnight).                                                            |
| V-09 | Text fields are trimmed; length limits per 8.1; control characters are stripped.                                                                                  |
| V-10 | Enumerated values must match the lists exactly.                                                                                                                   |
| V-11 | When writing to the Sheet, any string starting with `=`, `+`, `-` or `@` is prefixed with `'` (formula-injection guard).                                          |

### 8.3 Google Sheet structure

Spreadsheet: **"Aluthgama Daily Report – Data"**, time zone Asia/Colombo.

**Reports** – one row per `outletId` + `businessDate`, header row frozen, sorted by `businessDate` ascending. Columns in this order:

1.  `outletId`, `businessDate`, `dayOfWeek` (Mon–Sun), `daysSinceOpening`
2.  All fields from 8.1 in table order (multi-selects joined with `; `)
3.  `avgBill`, `deliverySales`, `deliveryShare`, `walkInSales` (computed server-side)
4.  `version`, `createdAt`, `updatedAt`, `updatedByRole`, `updatedByDevice`, `lastSubmissionId`, `source` (`app` \| `whatsapp-backfill`)

Number formats: money `#,##0.00`; share `0.0%`; dates `yyyy-mm-dd`.

**Submissions_Log** – append-only: `loggedAt`, `submissionId`, `action`, `businessDate`, `role`, `deviceId`, `deviceName`, `appVersion`, `result` (`created`, `updated`, `duplicate`, `rejected`), `errorCode`, `payloadJson`.

**Weather** – one row per date: `date`, `avgTempTrading`, `maxTemp`, `minTemp`, `maxFeelsLike`, `avgHumidityTrading`, `rainTradingMm`, `rainHoursTrading` (hours with ≥ 0.1 mm), `rainDayMm`, `source` (`forecast` \| `archive`), `fetchedAt`.

**Config** – key/value:

- `OUTLET_ID` = `ALU-01`
- `OUTLET_NAME` = `Barista Aluthgama`
- `OPENING_DATE` = `2026-11-02`
- `LATITUDE` = `6.4333`
- `LONGITUDE` = `80.0000`
- `TRADE_START_HOUR` = `7`
- `TRADE_END_HOUR` = `22`
- `DATE_CUTOFF_HOUR` = `12`
- `EDIT_WINDOW_DAYS` = `7`
- `MONTHLY_TARGET` = (blank, OQ-01)
- `BENCHMARK_MONTHLY_AVG` = `5720000`

**Audit** – `at`, `event` (`auth_fail`, `lockout`, `config_update`, `forbidden`), `deviceId`, `detail`.

**Analysis view** (S) – a sheet built with formulas (no script) that joins Reports and Weather by date, for Claude and for pivot tables.

Secrets in **Script Properties only**: `MANAGER_PIN_HASH`, `OWNER_PIN_HASH`, `PIN_SALT`, `TOKEN_SECRET`, `TOKEN_VERSION` (integer, starts at 1), `SHEET_ID`.

### 8.4 Calculations

All calculation functions live in `packages/shared/calc.ts`, are pure, and have 100% unit-test coverage:

- `avgBill`
- `deliverySales`
- `deliveryShare`
- `walkInSales`
- `movingAverage(7)`
- `projectedMonthEnd`
- `requiredDaily`
- `weekdayAverages`
- `reconciliationDiff`

Rounding: money to 2 dp (round half up) for display only; never round stored inputs.

### 8.5 Retention and privacy

- Data is kept indefinitely; backups per FR-BE-05.
- No customer personal data is collected. No analytics or third-party trackers in the app.

### 8.6 Seed data (insert during Phase 4 via `seed()`; `source = whatsapp-backfill`)

| businessDate | total     | bills | uber | pickme | comments                                                                                                                                                                          |
|--------------|-----------|-------|------|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 2026-11-02   | 231874.90 | 82    | 0    | 0      | Opening day. No Uber or PickMe orders; strong dine-in and takeaway sales.                                                                                                         |
| 2026-11-03   | 129849.85 | 46    | 0    | 1900   | A few foreign customers in the morning. Customer traffic was low through the day; evening rain likely reduced turnout. Slightly busy at night, but sales were below expectations. |

For 2026-11-03 also set `busyPeriods = After 9pm` and `wxEvening = Light rain`.

---

## 9. Non-functional requirements

| ID          | Category        | Requirement                                                                                                                                                                                                           |
|-------------|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| NFR-PERF-01 | Performance     | Cold start to an interactive PIN screen \< 2.5 s on a mid-range Android phone (APK, bundled assets).                                                                                                                  |
| NFR-PERF-02 | Performance     | Initial JS ≤ 250 KB gzipped; charts lazy-loaded on the dashboard route only.                                                                                                                                          |
| NFR-PERF-03 | Performance     | `report.upsert` p95 round trip \< 6 s on 4G (Apps Script cold starts included). The UI shows progress after 400 ms and never freezes.                                                                                 |
| NFR-REL-01  | Reliability     | Zero data loss: a submitted report exists either in the Sheet or in the outbox. Force-closing the app or losing connectivity must not lose it.                                                                        |
| NFR-REL-02  | Reliability     | Idempotent submissions (FR-REP-08); concurrent writes serialised with LockService (FR-BE-02).                                                                                                                         |
| NFR-OFF-01  | Offline         | The full wizard, drafts, history (cached) and dashboard (cached) work offline; only sending requires connectivity.                                                                                                    |
| NFR-SEC-01  | Security        | All traffic over HTTPS. Tokens are signed and expire; PINs are never stored or logged in plain text; PIN input is masked.                                                                                             |
| NFR-SEC-02  | Security        | The backend validates every request independently of the client.                                                                                                                                                      |
| NFR-SEC-03  | Security        | Risk accepted: the `/exec` URL is public, and protection relies on PIN + token + lockout. Document this in an ADR.                                                                                                    |
| NFR-SEC-04  | Security        | The APK is signed with a release keystore stored only as GitHub secrets, with an offline backup kept by the Owner. Debug builds are never distributed.                                                                |
| NFR-A11Y-01 | Accessibility   | WCAG 2.1 AA: contrast ≥ 4.5:1 for text (3:1 for large text and UI boundaries), touch targets ≥ 48×48 dp, every input labelled, errors announced via `aria-live`, logical focus order, no information by colour alone. |
| NFR-A11Y-02 | Accessibility   | Respects system font scaling up to 200% without clipping or horizontal scroll; respects `prefers-reduced-motion`.                                                                                                     |
| NFR-USA-01  | Usability       | A first-time manager completes the required fields in ≤ 90 s and a full report in ≤ 4 min (verified in UAT).                                                                                                          |
| NFR-COMP-01 | Compatibility   | APK: Android version per OQ-02, minimum as supported by the chosen Capacitor version. PWA: latest Chrome for Android; the Owner also uses it in desktop Chrome.                                                       |
| NFR-I18N-01 | Localisation    | English only in v1; all strings in `apps/web/src/i18n/en.json`, ready for Sinhala/Tamil later. Dates as "Tue 3 Nov 2026"; money as "Rs 129,849.85".                                                                   |
| NFR-MNT-01  | Maintainability | TypeScript strict, ESLint clean, no `any` without a justification comment.                                                                                                                                            |
| NFR-MNT-02  | Maintainability | Unit coverage ≥ 80% lines overall, 100% for `packages/shared`.                                                                                                                                                        |
| NFR-MNT-03  | Scalability     | `outletId` on every record and API call, so a second outlet needs only configuration.                                                                                                                                 |
| NFR-OBS-01  | Observability   | The backend writes errors with a correlation ID (= `submissionId` or a generated UUID) to the Audit sheet; the client shows that ID in error details.                                                                 |

---

## 10. UI/UX specification (enterprise grade)

### 10.1 Principles

Clear before clever; one primary action per screen; status always visible (sync, role, date); forgiving input (accepts "1,900", "Rs 1900/="); no dead ends (every error says how to fix it).

### 10.2 Design system (tokens in `apps/web/src/design/tokens.css`)

**Colour** – light and dark sets, every pair meeting NFR-A11Y-01:

- Neutrals: `bg`, `surface`, `surface-raised`, `border`, `text`, `text-muted`
- Brand: `primary` (deep green, light `#1D6A54` / dark `#5CC39F`), `on-primary`, `primary-soft`
- Semantic: `success`, `warning`, `danger`, `info`, each with a `-soft` background variant

**Typography** – IBM Plex Sans (UI), IBM Plex Mono (figures, tabular numerals), self-hosted WOFF2, with a system fallback stack. Scale (px): 12 / 14 / 16 (body) / 18 / 22 / 28. Weights 400 / 500 / 600.

**Other tokens:**

- Spacing: 4 px base grid — 4, 8, 12, 16, 24, 32, 48.
- Radius: 8 (inputs, cards), 999 (chips).
- Elevation: 0 (flat), 1 (cards), 2 (sheets/dialogs). Use sparingly.
- Motion: 150–200 ms ease-out; disabled under reduced motion.

### 10.3 Component library (`apps/web/src/components`, each with documented states)

Every component documents its default, hover/pressed, focus-visible, disabled, error, loading and empty states as applicable.

- AppBar: title, role badge, sync chip
- Stepper: clickable, shows error dots per step
- MoneyField: `inputmode="decimal"`, shows the raw value while focused and `129,849.85` on blur, "Rs" prefix
- IntegerField
- DateField
- TimeField
- ChipGroup (single/multi)
- WeatherGrid
- TextArea with counter
- Banner (info/warning/error)
- InlineAlert
- Toast
- ConfirmDialog (in-app; never `window.confirm`)
- BottomActionBar (sticky; respects safe-area insets)
- KpiCard
- ChartCard
- DataList / ListRow
- EmptyState
- Skeleton
- ErrorState with retry and correlation ID

### 10.4 Screens

| \#   | Screen                  | Key content                                                                                                                                                                                                                 |
|------|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| S-01 | Setup (first run)       | Device name, API health check result, continue to PIN                                                                                                                                                                       |
| S-02 | PIN                     | 6-digit masked PIN pad, error and lockout messaging, app version                                                                                                                                                            |
| S-03 | Home                    | Greeting with role; "Today's report" card (state: not started / draft / saved / waiting to send) with the primary CTA **Start report** or **Continue draft**; last 7 days mini-list; sync chip; Owner sees an MTD KPI strip |
| S-04 | Report wizard (5 steps) | Stepper, fields per 8.1, live summary strip (avg bill, delivery %, walk-in), sticky Back / Next and Save draft                                                                                                              |
| S-05 | Review & submit         | Read-only summary by section with Edit links, warnings list with confirmation checkbox, blocking errors list, **Submit report**                                                                                             |
| S-06 | Success                 | Confirmation, WhatsApp preview, Share / Copy / Done                                                                                                                                                                         |
| S-07 | History                 | Month filter (Owner), list rows per FR-HIS-01, pull-to-refresh                                                                                                                                                              |
| S-08 | Report detail           | Grouped fields, metrics, weather card, audit info, Edit (when allowed)                                                                                                                                                      |
| S-09 | Conflict                | Side-by-side differences, Keep saved / Replace with mine                                                                                                                                                                    |
| S-10 | Dashboard (Owner)       | KPI grid (2 columns on phone, 4 on desktop), daily chart, weekday table, channel mix, weather scatter, freshness label                                                                                                      |
| S-11 | Settings                | Per FR-SET-01 to FR-SET-05, sync log                                                                                                                                                                                        |
| S-12 | Offline / error states  | Banner "You're offline. Reports will send when you're back online."                                                                                                                                                         |

Navigation: bottom navigation with Home, History, Dashboard (Owner only), Settings. The wizard is full-screen with an exit confirmation if there are unsaved changes (the draft is still kept).

### 10.5 Responsive behaviour

Phone-first (360–430 px width) with a 16 px side gutter. From ≥ 768 px, the dashboard uses a multi-column grid and the wizard a centred 640 px column. No horizontal page scroll at any width; tables scroll inside their own container.

### 10.6 Microcopy (must use these patterns)

- Buttons state the action: "Submit report", "Save draft", "Share to WhatsApp".
- Success: "Report for Tue 3 Nov saved."
- `VALIDATION_FAILED`: "Fix the highlighted fields to continue."
- `EDIT_WINDOW_CLOSED`: "Reports older than 7 days can only be changed by the owner."
- `CONFLICT`: "This report was changed on another device. Choose which version to keep."
- `LOCKED_OUT`: "Too many attempts. Try again in 15 minutes."
- Network: "Couldn't reach the server. Your report is saved on this phone and will send automatically."
- No apologies, no jargon (never "API", "token" or "payload" in the UI).

### 10.7 Design deliverable (Phase 1)

Before building, produce `docs/design/` with:

- high-fidelity HTML/CSS prototypes (static) of S-02, S-03, S-04 (step 1), S-05, S-06, S-07 and S-10 at 390 px, light and dark;
- the token sheet;
- a component inventory.

The Owner approves these before Phase 2.

---

## 11. Android build and distribution

**AND-01** – Capacitor wraps `apps/web` with web assets **bundled** in the APK, so it works offline from first launch. App ID `lk.royalbliss.aluthgamadaily` (confirm, OQ-06). App name "Aluthgama Daily".

**AND-02** – App icon and splash screen from a single source SVG (Royal Bliss or neutral; see C-06). Adaptive icon included.

**AND-03** – Portrait orientation only. Status bar colours follow the theme. The hardware back button navigates back within the app and asks for confirmation before leaving the wizard.

**AND-04** – APK signing uses one release keystore held in GitHub Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Every APK the pipeline produces (Section 11.1) is signed with this key and verified with `apksigner verify`, so any build can be installed over any earlier build.

**AND-05** – Versioning (one scheme for every build, so newer builds always install as updates):

- `versionCode` = `github.run_number` of `pipeline.yml` + 1000. It increases on every run, on every branch and tag. Never derive it from the semantic version.
- `versionName`: on a tag `vX.Y.Z` → `X.Y.Z`; on any other commit → `X.Y.Z-dev.<run_number>+<short SHA>`, where `X.Y.Z` is the `version` in the root `package.json`.
- The app shows `versionName` in Settings and on the PIN screen.

**AND-06** – `version.json` (`{ version, versionCode, apkUrl, releasedAt }`) is published to GitHub Pages only from **tagged releases**, so the in-app update check (FR-SET-05) offers releases, never dev builds.

### 11.1 CI/CD pipeline – runs on every commit

**CICD-01 (M) – Single workflow** `.github/workflows/pipeline.yml`, triggered on:

- `push` to **any branch** (every commit);
- `push` of tags matching `v*`;
- `pull_request` to `main`;
- `workflow_dispatch` (manual run).

**CICD-02 (M) – Jobs and order** (a job runs only when the jobs it depends on pass):

| \#  | Job            | Runs on                                        | Steps                                                                                                                                                                                                                                                                                                                       | Needs                |
|-----|----------------|------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------|
| 1   | `quality`      | every trigger                                  | Install (`npm ci`, cached), lint, format check, typecheck (web, shared, backend)                                                                                                                                                                                                                                            | –                    |
| 2   | `unit`         | every trigger                                  | Vitest unit + component tests with coverage; fail below NFR-MNT-02 thresholds; upload coverage report                                                                                                                                                                                                                       | quality              |
| 3   | `build-web`    | every trigger                                  | Production web build with `VITE_API_URL` from the repository variable for the target environment; check NFR-PERF-02 bundle budget; upload `dist` as an artifact                                                                                                                                                             | quality              |
| 4   | `e2e`          | every trigger                                  | Install Playwright browsers (cached); run E2E-01 … E2E-09 and the axe accessibility suite against the mock API; upload the HTML report, plus traces and screenshots on failure                                                                                                                                              | build-web            |
| 5   | `backend`      | every trigger                                  | Bundle the Apps Script backend; assert the bundle has top-level `doPost`, `doGet`, `onOpen` and trigger handler declarations (C-03); upload the bundle as an artifact (deployment stays manual, OPS-02)                                                                                                                     | unit                 |
| 6   | `android`      | every trigger except `pull_request` from forks | Set up JDK (version required by the Capacitor/Gradle versions in the ADR) and the Android SDK on the runner; `npx cap sync android`; `./gradlew assembleRelease`; sign per AND-04; `apksigner verify`; compute SHA-256; upload `aluthgama-daily-<versionName>.apk` and `.sha256` as a workflow artifact (retention 14 days) | unit, e2e, build-web |
| 7   | `deploy-pages` | push to `main`, and tags                       | Publish the web build to GitHub Pages (environment `github-pages`); on tags also publish `version.json`                                                                                                                                                                                                                     | android              |
| 8   | `release`      | tags `v*` only                                 | Create the GitHub Release `vX.Y.Z` with generated notes from Conventional Commits, and attach the signed APK + checksum                                                                                                                                                                                                     | android              |

**CICD-03 (M) – Fail fast.** Any failed job marks the commit red and blocks the jobs after it. No APK is produced from a commit whose tests fail.

**CICD-04 (M) – Concurrency.** `concurrency: { group: pipeline-${{ github.ref }}, cancel-in-progress: true }` for branch pushes and pull requests, so a newer commit cancels the older run on the same branch. Tag runs and `main` runs are **never** cancelled (`cancel-in-progress` is false for `refs/tags/*` and `refs/heads/main`).

**CICD-05 (M) – Caching.** Cache npm, the Gradle wrapper and dependencies, and Playwright browsers, keyed on lock files. Target pipeline time ≤ 15 minutes for a commit with warm caches.

**CICD-06 (M) – Secrets safety.** Signing secrets are exposed only to the `android` job, never to `pull_request` runs from forks, and never printed. The keystore file is decoded to the runner's temp directory and deleted in an `always()` cleanup step.

**CICD-07 (M) – Branch protection on `main`.** Require pull requests, require `quality`, `unit`, `e2e`, `backend` and `android` to pass, and disallow force pushes. (The Administrator enables this in the repository settings; the runbook lists the exact settings.)

**CICD-08 (S) – Run summary.** Each run writes a job summary with: versionName, versionCode, test totals, coverage %, bundle size, and the APK artifact name and SHA-256.

**CICD-09 (S) – Notifications.** A failed run on `main` or a tag notifies the repository owner (GitHub's default email notification; no extra service).

**CICD-10 (M) – Actions pinning.** Third-party actions are pinned to a full commit SHA with the version in a comment. First-party `actions/*` are pinned to an exact version tag.

Build minutes: GitHub-hosted runners are free for public repositories; a private repository on the Free plan has 2,000 minutes a month, about 130 full pipeline runs at ~15 minutes. Record the choice in the OQ-05 answer.

---

## 12. Testing and quality assurance

### 12.1 Levels

| Level         | Tool                                                                            | Scope                                                                                                                                            | Gate                                                                                                                                      |
|---------------|---------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Unit          | Vitest                                                                          | `packages/shared` (schema, calc, format), backend pure logic (auth, token, upsert decision, weather summariser) with mocked Apps Script services | CI must pass; coverage thresholds per NFR-MNT-02                                                                                          |
| Component     | Vitest + RTL                                                                    | Every component in 10.3, including error/disabled/loading states                                                                                 | CI                                                                                                                                        |
| End-to-end    | Playwright (Pixel 7 emulation) against a mock API server implementing Section 7 | Critical journeys in 12.2                                                                                                                        | CI                                                                                                                                        |
| Accessibility | axe + Playwright                                                                | Every screen S-01 to S-11, light and dark                                                                                                        | Zero serious/critical violations                                                                                                          |
| Integration   | Script against the deployed **test** Apps Script deployment                     | auth, upsert, idempotency, conflict, list, dashboard, weather                                                                                    | Before each release (manual `workflow_dispatch` input `run_integration: true`, which needs the test `/exec` URL as a repository variable) |
| Device        | Manual on the outlet phone                                                      | Install, offline submit, share to WhatsApp, update check                                                                                         | Before each release                                                                                                                       |
| UAT           | Manager + Owner                                                                 | Test cases in 12.3                                                                                                                               | Owner sign-off                                                                                                                            |

### 12.2 Critical end-to-end journeys

- E2E-01: Sign in, enter only the required fields, submit, see Success, share.
- E2E-02: Full report with every field; values persist correctly in the detail view.
- E2E-03: Go offline mid-report, submit, see "waiting to send", go online, sent automatically, no duplicate.
- E2E-04: Same date submitted twice → banner, load saved, replace; version increments.
- E2E-05: Conflict between two devices → conflict screen, both choices behave correctly.
- E2E-06: Manager blocked from editing a 10-day-old report; Owner can.
- E2E-07: Lockout after 5 wrong PINs.
- E2E-08: Draft survives an app reload.
- E2E-09: Dashboard KPIs match hand-calculated values for the seed data plus 5 fixture days.

### 12.3 UAT cases (minimum)

| ID     | Case                                                  | Expected                                                                |
|--------|-------------------------------------------------------|-------------------------------------------------------------------------|
| UAT-01 | Enter "1,900" and "Rs 1900/=" in PickMe               | Both stored as 1900.00                                                  |
| UAT-02 | Total 129,849.85, bills 46                            | Avg bill shows 2,822.82                                                 |
| UAT-03 | Channel split off by Rs 500                           | Warning with the correct difference; submit needs the confirmation tick |
| UAT-04 | Bills 0 with total \> 0                               | Blocking error on bills                                                 |
| UAT-05 | Future date                                           | Blocked                                                                 |
| UAT-06 | WhatsApp text for 3 Nov seed                          | Matches FR-SHR-01 exactly                                               |
| UAT-07 | Airplane mode submit, then reconnect                  | Sent once; appears in the Sheet once                                    |
| UAT-08 | Next morning (after 06:00)                            | Weather columns filled for the previous day                             |
| UAT-09 | Claude reads the Sheet via the Google Drive connector | Reports and Weather readable                                            |
| UAT-10 | Font size at maximum on the phone                     | No clipped text, all actions reachable                                  |

### 12.4 Test environments

- **Mock API** (local and CI).
- **Test deployment**: a separate Apps Script project and a separate Sheet "… – TEST".
- **Production deployment.** The URL for each environment is injected at build time; the APK for the outlet always points to production.

---

## 13. Deployment and operations

**OPS-01 – Runbook** (`docs/runbook.md`), step by step with screenshots placeholders:

- create the bound spreadsheet and Apps Script project with `clasp create --type sheets`, then `clasp push`;
- reload the spreadsheet and use **Admin → Run setup**, then **Admin → Set PINs** (prompts with `SpreadsheetApp.getUi().prompt`, stores only salted hashes, never logs the PIN), then **Admin → Load seed data**;
- deploy the web app ("Execute as: Me", "Who has access: Anyone");
- copy the `/exec` URL into the GitHub variable `VITE_API_URL`;
- set the GitHub secrets;
- tag a release;
- install the APK on the phone (allow "Install unknown apps" for that source);
- sign in.

**OPS-02 – Updating the backend.** Use "Manage deployments → Edit → New version" so the `/exec` URL never changes. Never create a new deployment for production.

**OPS-03 – Rotating PINs.** Use **Admin → Set PINs**. It also increments `TOKEN_VERSION`, so every existing session is signed out.

**OPS-04 – Restore.** Copy the latest backup over the data, or point `SHEET_ID` to the backup copy.

**OPS-05 – User guide** (`docs/user-guide.md`): a one-page guide for the manager, with screenshots of each wizard step.

---

## 14. Risks

| ID   | Risk                                  | Mitigation                                                                                  |
|------|---------------------------------------|---------------------------------------------------------------------------------------------|
| R-01 | Apps Script latency or quota limits   | Idempotent outbox, backoff, LockService, small payloads                                     |
| R-02 | Public `/exec` URL abused             | PIN + token + lockout + server validation + audit log (NFR-SEC-03)                          |
| R-03 | Lost signing key → updates impossible | Keystore backup held offline by the Owner (NFR-SEC-04)                                      |
| R-04 | Manager stops filling optional fields | Required set kept to 5; UAT NFR-USA-01; Owner reviews weekly                                |
| R-05 | Franchisor branding not permitted     | Neutral branding by default (C-06)                                                          |
| R-06 | Weather API changes or outage         | Two sources, never blocks submission, daily backfill                                        |
| R-07 | Phone lost or reset                   | Data is server-side; only unsent outbox items are at risk; the sync chip makes them visible |

---

## 15. SDLC plan

### 15.1 Phases and gates

| Phase               | Output                                                                                                                                         | Gate                                                         |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| 1\. Design          | ADRs (stack versions, chart library, auth, CORS approach), UI prototypes (10.7), API mock server, `docs/test-plan.md`, open-questions log      | Owner approves the design                                    |
| 2\. Build – Core    | Monorepo, shared schema/calc, backend (auth, upsert, list, get, config, setup, seed), wizard, drafts, outbox, Success/Share, History, Settings | Unit + component + E2E-01 to E2E-08 green                    |
| 3\. Build – Insight | Weather enrichment and backfill, dashboard, backups, update check                                                                              | E2E-09 green, integration suite green on the test deployment |
| 4\. Release         | Production backend deployed, seed loaded, PWA live, signed APK v1.0.0 on GitHub Releases, runbook and user guide                               | Device test passed on the outlet phone                       |
| 5\. UAT & hypercare | UAT run with the Manager, fixes as patch releases, 2-week hypercare                                                                            | Owner sign-off                                               |

### 15.2 Branching

Trunk-based development: short-lived feature branches merged to `main` through pull requests. Every commit on every branch runs the full pipeline (Section 11.1) and produces a signed test APK; a pull request can merge only when the pipeline is green (CICD-07). Releases are tags `vX.Y.Z` on `main`.

### 15.3 Definition of Done (per requirement)

- Implemented exactly as specified (or deviation recorded in an ADR and approved)
- Unit/component tests written and passing; coverage thresholds met
- E2E or integration test referencing the requirement ID, where applicable
- Accessibility check passing for affected screens
- Pipeline (Section 11.1) green on the commit, signed APK artifact produced
- Docs updated (user guide, runbook or ADR as relevant)
- Traceability matrix updated

---

## 16. Traceability matrix (maintain in `docs/traceability.md`)

| Requirement               | Tests                                                                                                                                   |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| FR-AUTH-01 … 05           | E2E-01, E2E-07, unit `auth.*`                                                                                                           |
| FR-REP-01 … 11            | E2E-01 … 05, E2E-08, UAT-01 … 05, 07                                                                                                    |
| FR-SHR-01, 02             | UAT-06, unit `format.whatsapp`                                                                                                          |
| FR-HIS-01 … 04            | E2E-04, E2E-06                                                                                                                          |
| FR-DSH-01 … 07            | E2E-09, unit `calc.*`                                                                                                                   |
| FR-SET-01 … 05            | component tests, device test                                                                                                            |
| FR-BE-01 … 06             | integration suite, UAT-08, UAT-09                                                                                                       |
| AND-01 … 06, CICD-01 … 10 | pipeline run on a test commit (APK artifact produced, signed, installs over the previous build), tag run (Release created), device test |
| NFR-\*                    | per Section 9 verification method                                                                                                       |

---

## 17. Open questions (Owner to answer; Claude Code tracks in `docs/open-questions.md`)

| ID    | Question                                                  | Default until answered                              |
|-------|-----------------------------------------------------------|-----------------------------------------------------|
| OQ-01 | Monthly sales target for Aluthgama (Rs)?                  | Blank; dashboard shows "Set a monthly target"       |
| OQ-02 | Outlet phone model and Android version?                   | Support the minimum of the chosen Capacitor version |
| OQ-03 | Edit window for the Manager: is 7 days right?             | 7                                                   |
| OQ-04 | May the app use the Barista name and logo?                | No: neutral / Royal Bliss branding                  |
| OQ-05 | Is a public GitHub repository acceptable (free Pages)?    | Yes, no secrets in the repo                         |
| OQ-06 | Android app ID `lk.royalbliss.aluthgamadaily` acceptable? | Use it                                              |
| OQ-07 | Normal opening and closing hours?                         | 07:00–22:00                                         |
| OQ-08 | Should the Manager see the dashboard?                     | No (Owner only)                                     |
| OQ-09 | Sinhala UI needed?                                        | No, English only in v1                              |

