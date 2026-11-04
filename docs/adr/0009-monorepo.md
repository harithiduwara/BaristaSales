# ADR-0009: Monorepo tooling

- Status: Accepted (Phase 2)
- Date: 2026-11-04
- Requirements: 5.3, CICD-02, CICD-05

## Context

Section 5.3 fixes the folders. One zod schema must be shared by the web app, the backend and (from Phase 2) the mock API.

## Decision

- **npm workspaces** (root `package.json` `workspaces: ["apps/web", "packages/shared", "backend", "tools/mock-api"]`). No Nx, Turborepo or pnpm: the project is small and npm is already on every machine and runner.
- `packages/shared` is consumed as TypeScript source (no separate build) through a workspace dependency `"@aluthgama/shared": "0.0.0"` and TypeScript project references. Vite and esbuild compile it as part of each consumer.
- Root scripts: `lint`, `format:check`, `typecheck`, `test`, `test:e2e`, `build:web`, `build:backend`.
- The version in the root `package.json` is the app's semantic version (AND-05).

## Consequences

- One lock file, one `npm ci` in CI, simple caching keyed on `package-lock.json` (CICD-05).
