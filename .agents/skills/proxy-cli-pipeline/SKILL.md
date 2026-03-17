---
name: proxy-cli-pipeline
description: Execute the kcontext CLI ingestion pipeline with a YouTube proxy, including proxy lifecycle management and channel pipeline execution. Use when the user asks to run list, fetch, build, and push with proxy (`proxy-up.sh`, `proxy-check.sh`, `channel-pipeline.sh`, `proxy-down.sh`), or asks to batch ingest a YouTube channel or playlist safely through Tor proxy.
---

# Proxy CLI Pipeline

Run the kcontext batch ingestion pipeline via proxy with deterministic steps:
1. Start proxy
2. Verify proxy connectivity
3. Run channel pipeline
4. Stop proxy

Use the bundled wrapper script instead of manually chaining commands.

## Preconditions

- Run from the kcontext repository workspace.
- Ensure `cli/` dependencies are ready (`uv sync` already completed in `cli/`).
- Ensure Docker is running (required by `cli/scripts/proxy-up.sh`).
- Ensure DB/Supabase env is configured in `cli/.env` for `kcontext push`.
- If running inside a Codex worktree, bootstrap local env files first:

```bash
./scripts/bootstrap-worktree-env.sh --symlink
```

Read `docs/codex-worktree-bootstrap.md` if the worktree does not already expose `cli/.env`.

## Execute

Run:

```bash
bash skills/proxy-cli-pipeline/scripts/run-channel-pipeline-via-proxy.sh --url "https://www.youtube.com/@sebasi15/videos" --target 50 --manual-ko-only --skip-existing
```

The wrapper delegates options directly to `cli/scripts/channel-pipeline.sh`.
Load full option list from [`references/channel-pipeline-options.md`](references/channel-pipeline-options.md) when needed.

## Behavior

- Default proxy URL follows `KCONTEXT_YOUTUBE_PROXY_URL` and falls back to `http://127.0.0.1:8118`.
- Always execute `proxy-down.sh` on exit (success or failure) using shell `trap`.
- Preserve `channel-pipeline.sh` exit code so callers can detect partial/failure states.

## Troubleshooting

- If proxy startup fails: run `cd cli && ./scripts/proxy-up.sh` and inspect Docker daemon status.
- If YouTube blocking persists: rerun or change proxy endpoint via `KCONTEXT_YOUTUBE_PROXY_URL` / `--proxy-url`.
- If `push` fails: verify DB credentials and Supabase service role key in `cli/.env`.
