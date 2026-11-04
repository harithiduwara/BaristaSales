# ADR-0011: CI pipeline choices

- Status: Accepted (Phase 2)
- Date: 2026-11-04
- Requirements: CICD-01 … 10, AND-04 … 06, NFR-SEC-04

## Context

Section 11.1 fixes the jobs, their order, caching, concurrency and secret handling. It leaves open which actions to use, how releases are created, and what happens before the signing secrets exist.

## Decision

- **First-party actions only**, pinned to exact tags (CICD-10): `actions/checkout@v7.0.1`, `setup-node@v7.1.0`, `setup-java@v6.1.0`, `cache@v6.1.0`, `upload-artifact@v7.0.2`, `download-artifact@v8.0.2`, `configure-pages@v6.0.0`, `upload-pages-artifact@v5.0.0`, `deploy-pages@v5.0.1`. No third-party action is needed, so there is nothing to pin by SHA.
- **Android SDK** comes from the GitHub-hosted Ubuntu image (`$ANDROID_HOME`); JDK 21 from `setup-java` with its Gradle cache.
- **Releases** use the `gh` CLI that is on the runner (`gh release create`), with notes grouped from Conventional Commits by `scripts/release-notes.mjs`.
- **Versions** come from `scripts/version.mjs` (AND-05). A tag whose number differs from `package.json` fails the build.
- **Missing signing secrets fail the `android` job** with a message naming the four secrets. No unsigned or debug APK is ever produced or uploaded (NFR-SEC-04). Until the Administrator adds the secrets, every pipeline run is red at job 6.
- **The E2E job builds its own copy** of the web app in `e2e` mode (pointing at the mock API) rather than reusing the production `web-dist` artifact, which points at the real backend.
- **Integration suite** (`workflow_dispatch` with `run_integration`) is added in Phase 3 together with the test deployment.

## Consequences

- Branch protection (CICD-07) must list the job names `1 quality`, `2 unit`, `4 e2e`, `5 backend`, `6 android` (see the runbook).
