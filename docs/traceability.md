# Traceability matrix

Status: **D** designed (Phase 1) · **B** built · **T** tested · **✓** Done (Definition of Done met).

| Requirement | Design artefact | Tests | Status |
|-------------|-----------------|-------|--------|
| FR-AUTH-01 … 05 | ADR-0003, prototype S-02 | E2E-01, E2E-07, unit auth.* | D |
| FR-REP-01 … 11 | ADR-0010, prototypes S-04, S-05, S-06 | E2E-01 … 05, E2E-08, UAT-01 … 05, 07 | D |
| FR-SHR-01, 02 | prototype S-06 | UAT-06, unit format.whatsapp | D |
| FR-HIS-01 … 04 | prototype S-07 | E2E-04, E2E-06 | D |
| FR-DSH-01 … 07 | ADR-0002, prototype S-10 | E2E-09, unit calc.* | D |
| FR-SET-01 … 05 | — (no prototype required in 10.7) | component tests, device test | — |
| FR-BE-01 … 06 | ADR-0006, ADR-0008 | integration suite, UAT-08, UAT-09 | D |
| Section 7 (API) | ADR-0004, ADR-0007, `tools/mock-api` | mock self-test, integration suite | D |
| AND-01 … 06 | ADR-0001 | pipeline test commit, tag run, device test | — |
| CICD-01 … 10 | ADR-0009 | pipeline run on a test commit, tag run | — |
| NFR-* | ADR-0005 (SEC-03), test-plan §6 | per test-plan §6 | D |
