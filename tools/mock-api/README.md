# Mock API

In-memory mock of the Apps Script API (REQUIREMENTS.md Section 7). See ADR-0007.

```sh
node tools/mock-api/server.mjs          # http://localhost:8787
npm test --prefix tools/mock-api        # contract self-test
```

Test PINs: Manager `111111`, Owner `999999` (mock only). Starts with the two seed reports (8.6).

Test controls (`POST /__mock/<name>`, JSON body): `reset`, `clock` `{ now }` or `{ offsetDays }`, `fail` `{ code, times }` or `{ drop: true }`, `latency` `{ ms }`, `redirect` `{ on }`, `config` `{ KEY: value }`, `state`.
