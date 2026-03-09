# Web E2E / CI Strategy

## Goal
- Keep pull-request checks deterministic and fast.
- Keep real-data regressions visible without blocking day-to-day PR flow.

## Test Lanes
- `Smoke E2E (required on PR)`
  - Uses isolated Supabase stack: `testing/supabase-e2e`.
  - Runs deterministic seed reset for DB + Storage every run.
  - Command: `make e2e-smoke`
- `Real-data integration E2E (non-blocking)`
  - Uses real YouTube data flow via CLI pipeline.
  - Scheduled nightly and runnable manually.
  - Command: `make e2e-real`

## Isolation Design
- E2E stack is separate from developer stack by:
  - Distinct `project_id` (`kcontext_e2e`)
  - Distinct API/DB/Studio ports (`55421/55422/55423`)
  - Dedicated Supabase workdir (`testing/supabase-e2e`)
- `e2e-reset` does all of:
  - `supabase db reset` in E2E workdir
  - Storage object clear for `subtitles` bucket
  - Deterministic seed upload from `testing/supabase-e2e/supabase/storage-seed`
  - Seed verification (`test_%` videos count check)

## CI Workflows
- `.github/workflows/ci.yml`
  - `precommit-parity`: runs lefthook pre-commit on changed files
  - `lint-and-test-web`: lint, arch check, type check, unit tests, build
  - `web-e2e-smoke`: isolated smoke E2E with artifact upload
  - `lint-cli`: Ruff checks
- `.github/workflows/e2e-real-nightly.yml`
  - Nightly + manual real-data integration run
  - Uploads Playwright artifacts

## Retry and Parallelism
- Smoke E2E uses `workers=1`.
- CI retries are set to `1` in Playwright config for infra noise tolerance.
- Failures keep trace/video/screenshot artifacts for diagnosis.

## Commit Lint Policy
- Commit lint is enforced locally via `lefthook` `commit-msg`.
- CI does not enforce commit lint.
- Conventional Commit type is required; Korean subject text is allowed.

## Local Commands
```bash
# Start isolated E2E stack
make e2e-up

# Reset DB + Storage deterministic fixtures
make e2e-reset

# Run smoke E2E
make e2e-smoke

# Run real-data integration test
make e2e-real

# Tear down isolated E2E stack and volumes
make e2e-down
```
