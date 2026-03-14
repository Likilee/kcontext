# Codex Worktree Bootstrap

This repository keeps runtime env files out of git, so a fresh Codex worktree
does not automatically inherit the local setup from the canonical checkout.

Use `scripts/bootstrap-worktree-env.sh` as the Codex worktree setup script to
pull those local-only files into each worktree before an automation starts.

## What it bootstraps

- `.env.local`
- `.env.remote-sync`
- `.env.decodo`
- `web/.env.local`
- `cli/.env`
- `.codex/config.toml`

Missing files are skipped so the same script works for web-only and CLI-only
tasks.

## Recommended mode

Run the script in `--symlink` mode so secrets stay in one place and every
worktree sees the same current values.

By default the script keeps any existing target file in place. Add `--force`
only when you want to refresh a previously bootstrapped file.

```bash
./scripts/bootstrap-worktree-env.sh --symlink
```

If you need a fully copied snapshot instead of links, use:

```bash
./scripts/bootstrap-worktree-env.sh --copy
```

## How it finds the source checkout

The script resolves the shared git common dir and then reads `core.worktree`
from that git dir. That lets it find the canonical local checkout even though
this repository lives inside a superproject and Codex worktrees live under
`~/.codex/worktrees/...`.

## Codex app setup

Set the worktree setup script for this project to:

```bash
./scripts/bootstrap-worktree-env.sh --symlink
```

Recommended maintenance setup script:

```bash
./scripts/bootstrap-worktree-env.sh --symlink --force
```

The maintenance variant refreshes links if a file was replaced manually inside a
worktree.

## Manual usage

Dry-run from inside a worktree:

```bash
./scripts/bootstrap-worktree-env.sh --dry-run
```

Replace existing files inside a worktree:

```bash
./scripts/bootstrap-worktree-env.sh --symlink --force
```

Override the detected source or target path:

```bash
./scripts/bootstrap-worktree-env.sh \
  --source-root /path/to/main/checkout \
  --target-root /path/to/worktree \
  --symlink --force
```

## Notes

- This is meant for local Codex worktrees on the same machine.
- It does not solve cloud sandbox env injection by itself.
- `.codex/config.toml` is included so repo-local MCP settings can follow the
  worktree when present.
