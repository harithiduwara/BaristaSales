# Aluthgama Daily Report

Daily sales reporting app for the Barista outlet in Aluthgama, run by Royal Bliss (Pvt) Ltd. The outlet manager enters the day's figures on an Android phone; every report is stored in a Google Sheet for the Owner (and Claude) to analyse.

The full specification is [`REQUIREMENTS.md`](REQUIREMENTS.md) (SRS v1.1).

## Layout

| Path              | What                                     |
| ----------------- | ---------------------------------------- |
| `apps/web`        | React app (PWA and APK)                  |
| `apps/android`    | Capacitor Android project                |
| `packages/shared` | Schema, calculations, formatting         |
| `backend`         | Google Apps Script backend               |
| `tools/mock-api`  | Mock API for development and E2E         |
| `docs`            | ADRs, runbook, test plan, open questions |

## Status

**Phase 2 – Build core**, waiting for Owner approval. Phase 1 (design) was approved. See [`CHANGELOG.md`](CHANGELOG.md).

## Develop

```sh
npm ci
npm run mock      # mock API, http://localhost:8787 (Manager PIN 111111, Owner PIN 999999)
npm run dev       # app, http://localhost:5173
npm test          # unit + component tests
npm run test:e2e  # Playwright journeys + accessibility
```

Deployment and secrets: [`docs/runbook.md`](docs/runbook.md).

| Phase 1 output                                      | Where                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| UI prototypes (390 px, light and dark), token sheet | [`docs/design/index.html`](docs/design/index.html) (rebuild: `python3 docs/design/build.py`)                      |
| Component inventory                                 | [`docs/design/components.md`](docs/design/components.md)                                                          |
| Architecture decisions                              | [`docs/adr/`](docs/adr/)                                                                                          |
| Mock API server                                     | [`tools/mock-api/`](tools/mock-api/) (`node tools/mock-api/server.mjs`, test: `npm test --prefix tools/mock-api`) |
| Test plan                                           | [`docs/test-plan.md`](docs/test-plan.md)                                                                          |
| Open questions for the Owner                        | [`docs/open-questions.md`](docs/open-questions.md)                                                                |
| Traceability                                        | [`docs/traceability.md`](docs/traceability.md)                                                                    |
