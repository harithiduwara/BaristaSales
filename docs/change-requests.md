# Change requests

Requirements added after SRS v1.1. Each one is approved by the Owner, has IDs like the SRS, and is traced in `docs/traceability.md`.

## CR-01: Claude's take after each report

- Requested: 2026-11-05 by the Owner ("I need to get info from Claude when submitted from the APK").
- Status: Built, waiting for the Owner to add an Anthropic API key (runbook §1.7).
- Design: ADR-0013.

| ID       | Priority | Requirement                                                                                                                                                                                                                                                                  |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AI-01 | M        | After a report is saved on the server, the Success screen shows "Claude's take": a short analysis (at most about 120 words) of the day compared with recent days, what stands out, and one suggestion for the next trading day.                                              |
| FR-AI-02 | M        | The report never depends on Claude. Submitting, sharing and the WhatsApp text work the same whether Claude answers, is slow, fails or is not set up. While a report is waiting to send, the card says Claude's take appears once it is sent, and loads by itself when it is. |
| FR-AI-03 | M        | The backend calls Claude, never the app. The API key lives only in Script Properties (`ANTHROPIC_API_KEY`), set from Admin → Set Claude API key.                                                                                                                             |
| FR-AI-04 | M        | One call per report version: the answer is stored in a new `Insights` sheet tab (businessDate, reportVersion, generatedAt, model, text) and reused. A failed call is not retried for 2 minutes. Failures are written to the Audit tab as `ai_error`.                         |
| FR-AI-05 | S        | The report detail screen has "Ask Claude about this day" for any saved report.                                                                                                                                                                                               |
| FR-AI-06 | M        | Claude receives only the report figures, the 14 days before it, the weather and month-to-date figures. Staff-written text is passed as data and Claude is told not to follow instructions in it. No customer personal data is collected (8.5), so none is sent.              |
| FR-AI-07 | S        | The model is set in the Config tab (`CLAUDE_MODEL`, default `claude-opus-5-5`), so the Owner can change it without a new release.                                                                                                                                            |

API action added to Section 7.3: `report.insight` — roles Manager/Owner — payload `{ businessDate }` — returns `{ status: ready | noReport | notConfigured | unavailable, insight | null }`.
