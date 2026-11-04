# Traceability matrix

Status: **D** designed · **B** built · **T** tested (automated) · **✓** Definition of Done met (needs green pipeline + device/UAT where listed).

| Requirement                               | Where                                                          | Tests                                                                             | Status   |
| ----------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| FR-AUTH-01 first-run setup                | `screens/Setup.tsx`, `lib/session.ts`                          | screens.test (S-01), a11y S-01                                                    | T        |
| FR-AUTH-02 PIN sign-in, token             | `backend/src/auth.ts`, `screens/Pin.tsx`                       | auth.test, E2E-01, lib.test (api)                                                 | T        |
| FR-AUTH-03 lockout                        | `auth.ts` (`recordFailure`)                                    | auth.test, E2E-07, screens.test                                                   | T        |
| FR-AUTH-04 sign out keeps drafts/outbox   | `Settings.tsx`, `lib/session.ts`                               | screens.test (settings), lib.test                                                 | T        |
| FR-AUTH-05 role-aware UI, server-enforced | `ACTION_ROLES`, `core.ts`                                      | core.test (FORBIDDEN), E2E-06                                                     | T        |
| FR-REP-01 wizard + stepper                | `screens/Wizard.tsx`, `Stepper.tsx`                            | components.test, screens.test, E2E-02                                             | T        |
| FR-REP-02 default business date           | `shared/dates.ts`                                              | dates.test                                                                        | T        |
| FR-REP-03 existing report banner          | `Wizard.tsx`                                                   | E2E-04, screens.test                                                              | T        |
| FR-REP-04 live calculations               | `SummaryStrip`                                                 | components.test, E2E-01                                                           | T        |
| FR-REP-05 reconciliation warnings         | `shared/calc.ts` `reportWarnings`                              | calc.test, screens.test, a11y S-05                                                | T        |
| FR-REP-06 blocking validation             | `shared/schema.ts`                                             | schema.test, screens.test                                                         | T        |
| FR-REP-07 draft autosave                  | `Wizard.tsx`, `db.ts`                                          | E2E-08, screens.test                                                              | T        |
| FR-REP-08 submit, idempotency             | `lib/outbox.ts`, `core.ts`                                     | core.test, lib.test, E2E-01, mock.test                                            | T        |
| FR-REP-09 offline outbox, sync chip       | `lib/outbox.ts`, `SyncChip.tsx`                                | E2E-03, lib.test, components.test                                                 | T        |
| FR-REP-10 concurrency, conflict screen    | `core.ts`, `Conflict.tsx`                                      | core.test, E2E-05, screens.test                                                   | T        |
| FR-REP-11 success screen                  | `Success.tsx`                                                  | E2E-01                                                                            | T        |
| FR-SHR-01 WhatsApp format                 | `shared/format.ts`                                             | format.test (UAT-06), E2E-01                                                      | T        |
| FR-SHR-02 share mechanism                 | `lib/platform.ts`                                              | E2E-01 (navigator.share), screens.test (wa.me, clipboard); APK share: device test | T        |
| FR-HIS-01 … 04                            | `History.tsx`, `Detail.tsx`                                    | E2E-02, E2E-04, E2E-06, core.test, screens.test                                   | T        |
| FR-DSH-01 … 07                            | `shared/calc.ts` `dashboardSummary` (built), screen in Phase 3 | calc.test, core.test                                                              | B (calc) |
| FR-SET-01 … 04                            | `Settings.tsx`                                                 | screens.test, a11y S-11                                                           | T        |
| FR-SET-05 update check                    | Phase 3                                                        | —                                                                                 | —        |
| FR-BE-01 setup, menu                      | `backend/src/gas/admin.ts`, `core.ts`                          | core.test (helpers), integration (Phase 3)                                        | B        |
| FR-BE-02 upsert                           | `core.ts`                                                      | core.test                                                                         | T        |
| FR-BE-03 … 05 weather, backup             | Phase 3 (ADR-0008)                                             | —                                                                                 | D        |
| FR-BE-06 health                           | `core.ts` `handleGet`                                          | core.test, mock.test                                                              | T        |
| Section 7 API                             | `shared/api.ts`, `core.ts`, `tools/mock-api`                   | mock.test, core.test                                                              | T        |
| 8.2 V-01 … V-10                           | `shared/schema.ts`                                             | schema.test                                                                       | T        |
| 8.2 V-11                                  | `backend/src/rows.ts`                                          | rows.test                                                                         | T        |
| 8.3 Sheet layout                          | `rows.ts`, `gas/admin.ts`                                      | rows.test; integration (Phase 3)                                                  | B        |
| 8.4 calculations                          | `shared/calc.ts`                                               | calc.test (100 %)                                                                 | T        |
| 8.6 seed                                  | `core.ts` `seed`                                               | core.test                                                                         | T        |
| AND-01 … 05                               | `apps/android`, `capacitor.config.ts`, `scripts/version.mjs`   | pipeline run (job 6); device test                                                 | B        |
| AND-06 version.json                       | `scripts/version-json.mjs`, pipeline job 7                     | tag run                                                                           | B        |
| CICD-01 … 10                              | `.github/workflows/pipeline.yml`, ADR-0011                     | pipeline run on this branch                                                       | B        |
| NFR-PERF-02 bundle budget                 | `scripts/check-bundle.mjs`                                     | build-web job (133 KB of 250 KB)                                                  | T        |
| NFR-REL-01 zero data loss                 | `lib/outbox.ts`                                                | E2E-03, lib.test                                                                  | T        |
| NFR-SEC-01 … 03                           | ADR-0003, ADR-0005                                             | auth.test, core.test                                                              | T        |
| NFR-A11Y-01                               | tokens contrast (`docs/design/build.py`), jsx-a11y lint        | a11y.spec (axe, all Phase 2 screens, light + dark)                                | T        |
| NFR-I18N-01                               | `i18n/en.json`, `react/jsx-no-literals`                        | lint                                                                              | T        |
| NFR-MNT-01/02                             | ESLint, tsc strict, coverage thresholds                        | quality + unit jobs (95 % lines, shared 100 %)                                    | T        |
| NFR-OBS-01 correlation ID                 | `core.ts`, `ErrorState`                                        | core.test                                                                         | T        |
