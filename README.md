# Aluthgama Daily Report

Daily sales reporting app for the Barista outlet in Aluthgama, run by Royal Bliss (Pvt) Ltd. The outlet manager enters the day's figures on an Android phone; every report is stored in a Google Sheet for the Owner (and Claude) to analyse.

The full specification is [`REQUIREMENTS.md`](REQUIREMENTS.md) (SRS v1.1).

## Status

**Phase 1 – Design**, waiting for Owner approval. See [`CHANGELOG.md`](CHANGELOG.md).

| Phase 1 output | Where |
|----------------|-------|
| UI prototypes (390 px, light and dark), token sheet | [`docs/design/index.html`](docs/design/index.html) (rebuild: `python3 docs/design/build.py`) |
| Component inventory | [`docs/design/components.md`](docs/design/components.md) |
| Architecture decisions | [`docs/adr/`](docs/adr/) |
| Mock API server | [`tools/mock-api/`](tools/mock-api/) (`node tools/mock-api/server.mjs`, test: `npm test --prefix tools/mock-api`) |
| Test plan | [`docs/test-plan.md`](docs/test-plan.md) |
| Open questions for the Owner | [`docs/open-questions.md`](docs/open-questions.md) |
| Traceability | [`docs/traceability.md`](docs/traceability.md) |
