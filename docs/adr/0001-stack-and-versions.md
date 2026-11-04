# ADR-0001: Technology stack and pinned versions

- Status: Proposed (Phase 1)
- Date: 2026-11-04
- Requirements: SRS 0.5, 5.2, NFR-MNT-01, NFR-PERF-02

## Context

SRS 5.2 fixes the stack. SRS 0.5 requires every dependency pinned to an exact version (no `^` or `~`), using the latest stable version at build time, recorded here.

Versions below were read from the npm registry on 2026-11-04. Phase 2 re-checks them on the day the monorepo is created, and updates this ADR if any moved.

## Decision

### Runtime and tooling

| Item | Version | Note |
|------|---------|------|
| Node.js (local + CI) | 22.x LTS (22.23.4 at time of writing) | `.nvmrc` and `actions/setup-node` use the same major |
| npm | 10.9.x | npm workspaces (ADR-0009) |
| TypeScript | **6.0.3** | Latest is 7.0.2, but `typescript-eslint` 8.72.1 supports `<6.1.0`. NFR-MNT-01 needs type-aware linting, so we take the newest TypeScript the linter supports. Revisit when `typescript-eslint` supports 7.x. |

### Front end (`apps/web`)

| Package | Version |
|---------|---------|
| react, react-dom | 19.3.1 |
| vite | 8.3.5 |
| @vitejs/plugin-react | 6.2.1 |
| react-hook-form | 7.91.0 |
| @hookform/resolvers | 7.0.2 |
| zod | 4.6.7 |
| idb | 8.0.4 |
| vite-plugin-pwa | 2.0.0 (Workbox 7.4.x) |
| recharts | 3.10.1 (ADR-0002) |
| @fontsource/ibm-plex-sans, @fontsource/ibm-plex-mono | 5.3.0 (self-hosted WOFF2, C-07) |

Routing: a small hand-written router over `history` state (five routes, no nested data loading). This avoids a router dependency in the initial bundle (NFR-PERF-02). If routing grows, revisit.

### Android (`apps/android`)

| Package | Version |
|---------|---------|
| @capacitor/core, @capacitor/cli, @capacitor/android | 8.6.0 |
| @capacitor/share | 8.0.3 |
| @capacitor/network | 8.0.1 |
| @capacitor/app | 8.1.2 |
| @capacitor/preferences | 8.0.1 |
| @capacitor/browser | 8.0.5 |

JDK and Android SDK levels come from the Gradle files that `npx cap add android` generates for Capacitor 8 (expected: JDK 21, minSdk 24). Phase 2 records the exact values here once the project is generated.

### Backend (`backend`)

| Package | Version |
|---------|---------|
| @google/clasp | 3.4.1 (run locally by the Administrator, not in CI) |
| esbuild | 0.28.2 (ADR-0006) |
| @types/google-apps-script | latest at Phase 2 |

### Quality

| Package | Version |
|---------|---------|
| vitest, @vitest/coverage-v8 | 5.1.0 |
| @testing-library/react | 16.3.3 |
| @playwright/test | 1.64.1 |
| @axe-core/playwright | 4.14.0 |
| eslint | 10.14.0 |
| typescript-eslint | 8.72.1 |
| prettier | 3.9.10 |

## Consequences

- `package-lock.json` is committed; CI uses `npm ci`.
- Renovate/Dependabot are not added (the SRS does not ask for them); upgrades are manual and recorded here.
- Pinning TypeScript below the latest major is a known, deliberate lag.
