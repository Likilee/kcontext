---
name: supabase-direct-remote-sync
description: Sync kcontext data from the local Supabase stack to the hosted Supabase project while minimizing Supabase bandwidth. Use when Codex needs to copy local `video` and `subtitle` tables plus `subtitles` bucket objects to the remote project, ask the user for the remote DB password at runtime, choose a sync strategy based on data volume, or recover remote data from local build artifacts without re-fetching YouTube.
---

# Supabase Direct Remote Sync

## Overview

Sync local Supabase data to the remote project with direct Postgres writes for tables and the lowest-bandwidth storage path available.
Prompt for the remote DB password every run. Do not persist it to files or shell history.

## Quick Start

1. Ensure the repo has `.env.remote-sync` with `REMOTE_PROJECT_REF`, `REMOTE_SUPABASE_URL`, and `REMOTE_SUPABASE_SERVICE_ROLE_KEY`.
2. Decide whether to run incremental sync or a full re-sync.
3. Run the wrapper script:

```bash
/Users/kihoon/Documents/Project/dozboon/products/kcontext/.agents/skills/supabase-direct-remote-sync/scripts/run-direct-remote-sync.sh --status
/Users/kihoon/Documents/Project/dozboon/products/kcontext/.agents/skills/supabase-direct-remote-sync/scripts/run-direct-remote-sync.sh --max-videos 200
/Users/kihoon/Documents/Project/dozboon/products/kcontext/.agents/skills/supabase-direct-remote-sync/scripts/run-direct-remote-sync.sh --resync-all --storage-mode s3
```

The wrapper always asks for the remote DB password before it runs a sync or status command.
The default incremental state DB now points at the filtered canonical corpus:
`/Users/kihoon/Documents/Project/dozboon/products/kcontext/cli/.state/direct_remote_sync_filtered.sqlite`.

## Workflow

1. Read `.env.remote-sync`.
2. Ask the user for the remote DB password.
3. Build a transient `REMOTE_DB_URL` in-memory only.
4. Run the direct sync script with one of these storage modes:
   - `auto`: prefer S3 when `REMOTE_S3_ACCESS_KEY_ID` and `REMOTE_S3_SECRET_ACCESS_KEY` are present, otherwise fall back to REST
   - `s3`: require direct S3 upload to the remote bucket
   - `rest`: use the remote Storage REST API with `x-upsert`
5. Let the Python worker choose a DB write strategy based on pending video count and subtitle row count.
6. Report `processed`, `succeeded`, `failed`, `storage_mode`, `db_strategy`, and the latest synced IDs.

Read [strategy.md](references/strategy.md) when choosing between incremental sync, full re-sync, or storage mode.

## Operational Guidance

- Prefer incremental runs that reuse the same state DB.
- In practice, `rest` storage mode can time out on very large runs even when the sync is otherwise healthy.
- Default to `--max-videos 100` to `--max-videos 200` for hosted sync runs unless S3 upload is available.
- If a large run times out, do not reset state. Re-run with the same state DB and a smaller `--max-videos` value until `pending_estimate = 0`.
- Always verify with `--status` after each run when syncing a large backlog.

## Strategy Rules

- Use direct Postgres writes for `video` and `subtitle`.
- Prefer `video` upsert, `subtitle` replace-by-`video_id`, and storage overwrite-by-object-key. This keeps retries idempotent and safe.
- Use state DB tracking for incremental sync. Use `--resync-all` when local data changed and the remote project must be refreshed.
- Prefer S3 upload when remote S3 credentials are available. That avoids the remote Storage REST path and reduces Supabase bandwidth usage.
- Fall back to REST upload when S3 credentials are unavailable or the remote project does not expose S3 credentials yet.
- Stop on fatal DB or storage errors. Re-run with the same state DB after fixing credentials or remote connectivity.

## Files

- Wrapper: [run-direct-remote-sync.sh](scripts/run-direct-remote-sync.sh)
- Worker: [direct_remote_sync.py](scripts/direct_remote_sync.py)
- Reference: [strategy.md](references/strategy.md)

## Notes

- Do not save the prompted DB password into `.env.remote-sync`.
- Do not use this skill for YouTube ingestion. It assumes local data already exists in the local Supabase stack.
- If the user explicitly wants the existing REST-based sync path, use `scripts/run-remote-sync.sh` instead of this skill.
