# ADR-0001: Technology stack and pinned versions

- Status: Accepted (Phase 2)
- Date: 2026-11-04
- Requirements: SRS 0.5, 5.2, NFR-MNT-01, NFR-PERF-02, NFR-COMP-01

## Context

SRS 5.2 fixes the stack. SRS 0.5 requires every dependency pinned to an exact version, using the latest stable version at build time. `.npmrc` sets `save-exact=true`; `package-lock.json` is committed and CI uses `npm ci`.

## Decision

Versions installed on 2026-11-04 (Phase 2).

### Runtime and tooling

| Item                                                              | Version                            | Note                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                                                           | 22 LTS (`.nvmrc`)                  | CI uses `actions/setup-node` with `node-version: 22`                                                                                                                                              |
| npm                                                               | 10.9                               | workspaces (ADR-0009)                                                                                                                                                                             |
| TypeScript                                                        | **6.0.3**                          | Latest is 7.0.2; `typescript-eslint` 8.72.1 supports `<6.1.0`.                                                                                                                                    |
| ESLint                                                            | **9.39.5**                         | Latest is 10.14.0; `eslint-plugin-react` 7.37.5 and `eslint-plugin-jsx-a11y` 6.10.2 do not support ESLint 10 yet. jsx-a11y is needed for NFR-A11Y-01 and `react/jsx-no-literals` for NFR-I18N-01. |
| @eslint/js                                                        | 9.39.5                             |                                                                                                                                                                                                   |
| typescript-eslint                                                 | 8.72.1                             |                                                                                                                                                                                                   |
| eslint-plugin-react-hooks                                         | 7.1.1                              | Only `rules-of-hooks` and `exhaustive-deps`. Its `recommended` set adds React Compiler checks; the app does not use the compiler.                                                                 |
| eslint-plugin-react / jsx-a11y / eslint-config-prettier / globals | 7.37.5 / 6.10.2 / 10.1.8 / 17.14.0 |                                                                                                                                                                                                   |
| prettier                                                          | 3.9.10                             |                                                                                                                                                                                                   |

### Front end (`apps/web`)

| Package                          | Version                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| react, react-dom                 | 19.3.1                                                                                                                |
| vite                             | 8.3.5                                                                                                                 |
| @vitejs/plugin-react             | 6.2.1                                                                                                                 |
| react-hook-form                  | 7.91.0                                                                                                                |
| @hookform/resolvers              | 7.0.2 (installed; the wizard uses a small custom resolver over the shared schema so error messages are rule codes)    |
| zod                              | 4.6.7                                                                                                                 |
| idb                              | 8.0.4                                                                                                                 |
| vite-plugin-pwa / workbox-window | 2.0.0 / 7.4.1                                                                                                         |
| recharts                         | 3.10.1 (Phase 3, ADR-0002)                                                                                            |
| Fonts                            | IBM Plex Sans 400/500/600 and Plex Mono 400/500 WOFF2 from `@fontsource` 5.3.0, copied into `src/design/fonts` (C-07) |

Routing is a small hash router (`src/router.ts`): it works on a GitHub Pages sub-path and inside the APK, and needs no dependency.

### Android (`apps/android`)

| Item                                                 | Version                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| @capacitor/core, cli, android                        | 8.6.0                                                           |
| @capacitor/share, network, app, preferences, browser | 8.0.3, 8.0.1, 8.1.2, 8.0.1, 8.0.5                               |
| JDK                                                  | 21 (Temurin in CI)                                              |
| Android Gradle Plugin / Gradle                       | 8.13.0 / 8.14.3                                                 |
| compileSdk / targetSdk / minSdk                      | 36 / 36 / **24 (Android 7.0)** — this answers the OQ-02 default |

### Backend (`backend`)

| Package                   | Version                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| esbuild                   | 0.28.2 (ADR-0006)                                                                       |
| @types/google-apps-script | 2.0.14                                                                                  |
| @google/clasp             | 3.4.1, installed by the Administrator, not a project dependency (it is never run in CI) |

### Quality

| Package                                           | Version                       |
| ------------------------------------------------- | ----------------------------- |
| vitest, @vitest/coverage-v8                       | 5.1.0                         |
| @testing-library/react, dom, user-event, jest-dom | 16.3.3, 10.4.2, 14.6.8, 7.0.1 |
| jsdom, fake-indexeddb                             | 30.1.3, 6.2.7                 |
| @playwright/test                                  | 1.64.1                        |
| @axe-core/playwright                              | 4.14.0                        |

## Consequences

- TypeScript and ESLint are each one major behind; revisit when the plugins catch up.
- Upgrades are manual and recorded here.
