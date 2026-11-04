# Mock API

The real backend core on in-memory storage, served over HTTP (REQUIREMENTS.md Section 7). See ADR-0007.

```sh
npm run mock                         # build and start on http://localhost:8787
npm test -w @aluthgama/mock-api      # contract self-test
```

Test PINs: Manager `111111`, Owner `999999` (mock only). Starts with the two seed reports (8.6).

Test controls (`POST /__mock/<name>`, JSON body): `reset`, `clock` `{ now }` or `{ offsetDays }`, `fail` `{ code, times }` or `{ drop: true }`, `latency` `{ ms }`, `redirect` `{ on }`, `config` `{ KEY: value }`, `state`.
