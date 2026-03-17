---
name: kcontext-pr-review
description: Review open kcontext pull requests with repo-specific GitHub and code-quality checks. Use when Codex needs to inspect the open PR queue, analyze a specific PR's linked issue, checks, diff scope, review state, or unresolved review threads, produce findings-first review notes, or submit an approval, comment, or request-changes review through `gh`.
---

# Kcontext Pr Review

## Overview

Use this skill when the task is to assess a PR rather than implement it.
Start with GitHub metadata and only move into local code review once the PR contract looks healthy.

Read [review-checklist.md](references/review-checklist.md) for repo-specific review priorities.

## Quick Start

List the open PR queue:

```bash
bash .agents/skills/kcontext-pr-review/scripts/open-pr-queue.sh
```

Classify one PR's next actor:

```bash
bash .agents/skills/kcontext-pr-review/scripts/pr-action-state.sh --pr 123 --format summary
```

Inspect one PR in detail:

```bash
bash .agents/skills/kcontext-pr-review/scripts/pr-review-report.sh --pr 123
```

You can also target another repository with `--repo owner/name`.

## Review Workflow

1. Use `pr-action-state.sh` first and only review PRs whose `next_actor` is `codex_review`.
2. Check that the PR links a representative issue with `Closes #...` or `Refs #...`.
3. Check whether the linked issue still matches the latest human GitHub feedback.
4. Inspect checks, review state, linked issues, changed files, and unresolved human review threads.
5. Review the code and tests with repo-specific architecture rules in mind.
6. Respond with findings first in Korean by default. If there are no findings, say that explicitly and note any residual risk.

If review or spot-checking in a Codex worktree needs env-backed commands such as local API checks, transcript fetches, sync flows, or E2E verification, bootstrap env first:

```bash
./scripts/bootstrap-worktree-env.sh --symlink
```

Use `docs/codex-worktree-bootstrap.md` if the expected `.env` files are absent.

## What To Look For

- Missing or incorrect linked issue references
- Scope drift beyond the linked issue
- CI failures or suspicious missing verification
- Clean Architecture violations in `web/src`
- Direct Supabase imports in UI
- Barrel files
- Token/design-system violations in frontend changes
- Missing tests around behavior changes
- Review threads that still imply unresolved risk
- Human feedback that changes the issue or PR contract
- Re-review loops on the same head commit

## Leaving A GitHub Review

If the user wants you to submit a GitHub review after analysis:

- Approve: `gh pr review 123 --approve -b "Looks good."`
- Comment: `gh pr review 123 --comment -F /tmp/review.md`
- Request changes: `gh pr review 123 --request-changes -F /tmp/review.md`

Prefer `--comment` or `--request-changes` unless the PR is clearly ready.
Write the review body in Korean by default, while keeping code snippets, commands, identifiers, and quoted external text in their original form when clearer.
Every Codex-authored review must include a visible `[codex-review]` prefix and a hidden marker like `<!-- codex:automation=kcontext-pr-review kind=review head=<sha> state=done -->`.
