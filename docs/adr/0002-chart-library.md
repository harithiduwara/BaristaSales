# ADR-0002: Chart library

- Status: Accepted (design); built in Phase 3
- Date: 2026-11-04
- Requirements: FR-DSH-02, FR-DSH-04, FR-DSH-05, FR-DSH-06, NFR-PERF-02, NFR-A11Y-01, FR-SET-04

## Context

The dashboard needs: bars with a moving-average line and dashed reference lines (FR-DSH-02, FR-DSH-06), stacked bars (FR-DSH-04) and scatter plots (FR-DSH-05). The SRS suggests Recharts or Chart.js. Charts must be lazy-loaded on the dashboard route only (NFR-PERF-02), follow the light/dark theme (FR-SET-04), and meet WCAG 2.1 AA (NFR-A11Y-01).

|                                      | Recharts 3.10.1                                                         | Chart.js 4.6.1                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Rendering                            | SVG, React components                                                   | Canvas, imperative                                                               |
| Theming                              | CSS custom properties work directly in SVG `fill`/`stroke`              | Colours must be resolved from CSS in JS and the chart re-created on theme change |
| Accessibility                        | SVG nodes, can carry `role`/`aria-label`; text scales with OS font size | Canvas is one opaque bitmap; needs a separate fallback                           |
| Composed bar + line + reference line | Built in (`ComposedChart`, `ReferenceLine`)                             | Built in (mixed chart + annotation plugin, an extra dependency)                  |
| Size (gzipped, typical use)          | Larger (~95–110 KB incl. d3 parts)                                      | Smaller (~60–70 KB tree-shaken)                                                  |

## Decision

Use **Recharts**, loaded only by the dashboard route through `React.lazy`.

Every chart is paired with a visually hidden data table (and a "Show as table" toggle) so the data is never available by colour or shape alone.

## Consequences

- The size cost does not count against the 250 KB initial budget because the dashboard chunk is lazy (checked in CI by `build-web`).
- Theme changes need no chart re-creation.
- If the dashboard chunk proves too slow on the outlet phone, Chart.js is the fallback; switching is contained in `apps/web/src/features/dashboard/charts/`.
