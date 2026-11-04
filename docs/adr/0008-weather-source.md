# ADR-0008: Weather source and metric definitions

- Status: Accepted (design); built in Phase 3
- Date: 2026-11-04
- Requirements: FR-BE-03, FR-BE-04, Section 8.3 (Weather), A-02, R-06

## Context

The SRS fixes Open-Meteo, the variables, location, time zone, the forecast-then-archive source order and the reject rule. It does not define how each stored metric is computed, or when to prefer the archive.

## Decision

**Request.** For a date D: `GET https://api.open-meteo.com/v1/forecast?latitude={LATITUDE}&longitude={LONGITUDE}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation&timezone=Asia%2FColombo&start_date=D&end_date=D`.

If that request fails, or the response is rejected (fewer than 24 hourly values, or any null temperature), call `https://archive-api.open-meteo.com/v1/archive` with the same parameters. If both fail, leave the date without a row; the next 06:00 backfill tries again.

**Metrics** (trading hours `h` with `TRADE_START_HOUR ≤ h < TRADE_END_HOUR`, OQ-14):

| Column               | Definition                                              |
| -------------------- | ------------------------------------------------------- |
| `avgTempTrading`     | mean of `temperature_2m` over trading hours, 1 dp       |
| `maxTemp`, `minTemp` | max/min `temperature_2m` over all 24 hours              |
| `maxFeelsLike`       | max `apparent_temperature` over all 24 hours            |
| `avgHumidityTrading` | mean `relative_humidity_2m` over trading hours, whole % |
| `rainTradingMm`      | sum of `precipitation` over trading hours, 1 dp         |
| `rainHoursTrading`   | count of trading hours with `precipitation ≥ 0.1`       |
| `rainDayMm`          | sum of `precipitation` over all 24 hours, 1 dp          |
| `source`             | `forecast` or `archive`                                 |
| `fetchedAt`          | ISO time, Asia/Colombo                                  |

Only past dates are fetched (never today), so a stored row is final. A row is never overwritten by a later fetch.

The summariser is a pure function in `backend/src/weather/summarise.ts` with unit tests on fixed Open-Meteo responses.

## Consequences

- Hourly precipitation from Open-Meteo is the sum over the preceding hour; "rain during trading" therefore counts the hours ending 08:00 to 22:00 as labelled by the API. This is documented in the runbook so the Owner reads the numbers correctly.
- No API key is needed. Open-Meteo's free tier is for non-commercial use; the Owner should confirm whether a commercial plan is needed for a business (added to the runbook as a check, not a blocker).
