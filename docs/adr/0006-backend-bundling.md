# ADR-0006: Backend bundling for Apps Script

- Status: Proposed (Phase 1)
- Date: 2026-11-04
- Requirements: C-03, 5.2, CICD-02 job 5 (`backend`)

## Context

Apps Script has no ES modules and only discovers top-level `function` declarations. The SRS suggests `gas-webpack-plugin` "or an equivalent esbuild footer that emits stubs". The backend must import the shared zod schema from `packages/shared`.

## Decision

- Bundle `backend/src/main.ts` with **esbuild** (`format: "iife"`, `globalName: "Backend"`, `target: "es2020"`, `platform: "neutral"`) into `backend/dist/Code.js`.
- `main.ts` exports every entry point: `doGet`, `doPost`, `onOpen`, `setup`, `setPinsPrompt`, `seed`, `fetchMissingWeatherNow`, `dailyWeatherBackfill`, `weeklyBackup`.
- A build script appends a footer with one stub per export, generated from the export list:

  ```js
  function doPost(e) { return Backend.doPost(e); }
  ```
- `backend/scripts/assert-entrypoints.mjs` checks the built file with a regular expression for each required `function <name>(` at the top level and fails the `backend` CI job if one is missing.
- `appsscript.json` is copied into `dist/` with `runtimeVersion: "V8"`, `timeZone: "Asia/Colombo"`, and the web app settings (`executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`).
- Apps Script services are reached only through a thin adapter (`backend/src/gas/*.ts`) so pure logic can be unit-tested with mocks (12.1).

## Consequences

- One small build tool (esbuild) instead of webpack plus a plugin.
- zod is bundled into the backend (~60 KB); Apps Script has no practical size issue at this size.
- Must check during integration testing that zod 4 runs on the Apps Script V8 runtime; if it does not, record a new ADR.
