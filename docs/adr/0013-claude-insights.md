# ADR-0013: Claude insights (CR-01)

- Status: Accepted
- Date: 2026-11-05
- Requirements: FR-AI-01 … 07, NFR-SEC-01, NFR-PERF-03, 8.5

## Context

The Owner wants Claude's analysis on the phone after each report. Apps Script cannot run the Anthropic SDK, so the call is plain HTTPS through `UrlFetchApp`. The app and its bundle are public (ADR-0005), so no key can live in the app.

## Decision

- **Where:** a separate action `report.insight`, called by the app after `report.upsert` succeeds. It is not part of the upsert, so a slow model never holds the write lock or pushes `report.upsert` past its 6-second budget (NFR-PERF-03).
- **Request** (`backend/src/gas/claude.ts`): `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2026-10-21`, `anthropic-beta: server-side-fallback-2026-07-01`; body `model` (Config `CLAUDE_MODEL`, default `claude-opus-5-5`), `max_tokens: 4000`, `output_config.effort: "low"` (a short summary does not need deep reasoning), `fallbacks: "default"` (if the model declines, the API retries on a suitable fallback model in the same call), a fixed system prompt and the day's data as JSON.
- **Response:** the text blocks are joined; `stop_reason: "refusal"` is treated as "unavailable".
- **Errors:** 401/403 mean the key is wrong (shown as "not set up"); 408, 409, 429, 5xx and 529 (overloaded) are retried once, waiting for `retry-after` up to 8 s; anything else is "unavailable". The phone waits up to 60 s.
- **Cost control:** one stored answer per report version; failures are remembered for 2 minutes.
- **Prompt injection:** the system prompt names the staff-written fields and says to treat them as data.
- **Tests:** the backend uses an `Ai` port; unit tests, the mock API and E2E use a deterministic stub, so no test calls the real API or spends money.

## Consequences

- Needs an Anthropic API account and key (separate from a claude.ai subscription), billed per use. At `claude-opus-5-5` prices ($4 / $20 per million input/output tokens) one insight is roughly 3,000 input and up to ~1,500 output tokens: about **Rs 10–15 (US$0.03–0.05) per report, about Rs 400 a month** for one report a day. Setting `CLAUDE_MODEL` to `claude-haiku-5-5` in the Config tab would cut that to a small fraction, with shorter, simpler analysis; that is the Owner's choice.
- The report figures (no personal data) are sent to Anthropic.
- If the key is missing or the API is down, everything else works as before.
