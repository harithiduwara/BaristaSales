# Changelog

All notable changes are listed here. Format based on Keep a Changelog; versions follow SemVer (tags `vX.Y.Z`).

## [Unreleased]

### Added (Phase 2 – Build core)

- Monorepo with npm workspaces, strict TypeScript, ESLint (jsx-a11y, no hard-coded UI text), Prettier.
- `packages/shared`: report schema (V-01…V-10), calculations, formatting and WhatsApp summary, API types; 100 % test coverage.
- Apps Script backend: PIN sign-in with signed tokens and lockout, report upsert with lock, idempotency and version checks, list/get/config/dashboard data, health check, Admin menu (setup, PINs, seed), formula-injection guard, single-file bundle.
- Mock API now runs the real backend core.
- Web app: setup, PIN, home, 5-step wizard with drafts, warnings and review, success and WhatsApp share, conflict screen, history, report detail, settings (unsent reports, sync log, targets, theme); offline outbox.
- Capacitor Android project (app ID `lk.royalbliss.aluthgamadaily`, portrait, release signing from CI secrets, icons from one SVG).
- CI/CD pipeline (`.github/workflows/pipeline.yml`), runbook, ADR-0011 and ADR-0012.
- Tests: 180 unit/component tests, E2E-01…E2E-08 and an axe suite in light and dark.

### Added (Phase 1 – Design)

- Phase 1 design: SRS as `REQUIREMENTS.md`; ADRs 0001–0010; open-questions log (OQ-01…19); test plan; traceability matrix.
- UI prototypes for S-02, S-03, S-04 (step 1), S-05, S-06, S-07 and S-10 at 390 px in light and dark, design tokens with WCAG AA contrast checks, component inventory (10.7).
- Mock API server implementing Section 7, with self-tests.
