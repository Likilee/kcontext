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

Inspect one PR in detail:

```bash
bash .agents/skills/kcontext-pr-review/scripts/pr-review-report.sh --pr 123
```

You can also target another repository with `--repo owner/name`.

## Review Workflow

1. Check that the PR links a representative issue with `Closes #...` or `Refs #...`.
2. Check whether the linked issue itself looks executable and in scope.
3. Inspect checks, review state, linked issues, changed files, and unresolved review threads.
4. Review the code and tests with repo-specific architecture rules in mind.
5. Respond with findings first in Korean by default. If there are no findings, say that explicitly and note any residual risk.

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

## Leaving A GitHub Review

If the user wants you to submit a GitHub review after analysis:

- Approve: `gh pr review 123 --approve -b "Looks good."`
- Comment: `gh pr review 123 --comment -F /tmp/review.md`
- Request changes: `gh pr review 123 --request-changes -F /tmp/review.md`

Prefer `--comment` or `--request-changes` unless the PR is clearly ready.
Write the review body in Korean by default, while keeping code snippets, commands, identifiers, and quoted external text in their original form when clearer.
