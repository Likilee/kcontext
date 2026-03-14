---
name: kcontext-pr-followup
description: Turn GitHub PR review feedback on kcontext pull requests into concrete follow-up work. Use when Codex needs to inspect review decisions, review bodies, and unresolved review threads on an open PR, translate that feedback into an implementation checklist, make the requested code changes, re-run verification, and prepare a concise response or status update for the PR.
---

# Kcontext Pr Followup

## Overview

Use this skill after feedback already exists on a PR.
Treat review comments as the source of follow-up scope unless they conflict with the linked issue or repo rules.

Read [followup-checklist.md](references/followup-checklist.md) before editing code.

## Quick Start

Collect actionable feedback:

```bash
bash .agents/skills/kcontext-pr-followup/scripts/pr-feedback-report.sh --pr 123
```

The report highlights latest reviews and unresolved review threads so you can build a concrete fix list.

## Follow-Up Workflow

1. Pull the feedback report.
2. Separate actionable requests from non-blocking comments or acknowledgements.
3. Update code only where the feedback is valid and in scope.
4. Re-run the relevant verification from the issue and PR.
5. Prepare a concise response summary that maps fixes back to review points.

If the follow-up requires env-backed verification from a Codex worktree, run this first:

```bash
./scripts/bootstrap-worktree-env.sh --symlink
```

Use `docs/codex-worktree-bootstrap.md` when the worktree is missing repo-local env files.

## Prioritize Feedback

- Address `CHANGES_REQUESTED` reviews first.
- Address unresolved review threads before stale or already resolved threads.
- If a reviewer suggestion conflicts with repo architecture or design-system rules, explain that conflict instead of applying it blindly.
- If feedback expands scope materially, move that change back into the issue workflow first.

## Close The Loop

- Re-run the checks that prove the reviewer concern is addressed.
- Keep the PR summary and issue link accurate if scope changed.
- Reply in Korean by default with a short mapping from feedback item to change and verification.
- Do not mark work done if unresolved threads still point at a real risk.
