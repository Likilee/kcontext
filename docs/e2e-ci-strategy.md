# Web E2E / CI Strategy

## Goal
- Keep pull-request checks deterministic and fast.
- Keep real-data regressions visible without blocking day-to-day PR flow.

## Test Lanes
- `Smoke E2E (required on PR)`
  - Uses isolated Supabase stack: `testing/supabase-e2e`.
  - Runs deterministic seed reset for DB + Storage every run.
  - Command: `make e2e-smoke`
- `CLI integration E2E (non-blocking)`
  - Uses checked-in raw fixtures and exercises CLI `build -> push` plus web E2E.
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
- Trigger workflows
  - `.github/workflows/pr-main.yml`
    - Pull request trigger for `main`
    - Calls reusable lane workflows for pre-commit parity, web quality, CLI quality, and smoke E2E
  - `.github/workflows/push-main.yml`
    - Push trigger for `main`
    - Calls the same reusable lane workflows as PR
  - `.github/workflows/e2e-real-nightly.yml`
    - Nightly + manual trigger for fixture-backed CLI integration E2E
- Reusable lane workflows
  - `.github/workflows/reusable-precommit-parity.yml`
  - `.github/workflows/reusable-web-quality.yml`
  - `.github/workflows/reusable-cli-quality.yml`
  - `.github/workflows/reusable-web-e2e-smoke.yml`
  - `.github/workflows/reusable-web-e2e-real.yml`
- Shared GitHub Actions
  - `.github/actions/setup-web/action.yml`
  - `.github/actions/setup-cli/action.yml`
  - `.github/actions/setup-supabase/action.yml`
- CI shell helpers
  - `scripts/ci/run-precommit-parity.sh`
    - Resolves changed files and runs `lefthook pre-commit` parity outside the workflow YAML

## Retry and Parallelism
- Smoke E2E uses `workers=1`.
- CI retries are set to `1` in Playwright config for infra noise tolerance.
- Failures keep trace/video/screenshot artifacts for diagnosis.

## Local Hook Policy
- `pre-commit`
  - Runs changed-file checks for Biome, Sheriff, and Ruff before commit.
- `pre-push`
  - Runs the local CI gate: web lint, architecture check, type check, unit tests, build, and CLI Ruff checks.
- `commit-msg`
  - Runs commitlint locally.

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

# Run fixture-backed CLI integration test
make e2e-real

# Refresh checked-in CLI integration fixtures from the source Supabase DB
./scripts/refresh-cli-integration-fixtures.sh

# Tear down isolated E2E stack and volumes
make e2e-down
```
