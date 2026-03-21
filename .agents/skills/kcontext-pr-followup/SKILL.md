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

The report highlights only the human inputs that landed after the last Codex action on the current head, plus unresolved human review threads and linked issue comments.

## Follow-Up Workflow

1. Pull `pr-action-state.sh` and `pr-feedback-report.sh`.
2. Work only on PRs whose `next_actor` is `codex_followup`.
3. Separate actionable human requests from Codex-authored comments, acknowledgements, or stale input.
4. If the PR is in conflict with the base branch, resolve the conflict first before reviewing smaller follow-up items.
5. If the latest human input changes the contract, sync the issue and PR before touching code.
6. Update code only where the feedback is valid and in scope.
7. Re-run the relevant verification from the issue and PR.
8. Prepare a concise response summary that maps fixes back to review points.

If the follow-up requires env-backed verification from a Codex worktree, run this first:

```bash
./scripts/bootstrap-worktree-env.sh --symlink
```

Use `docs/codex-worktree-bootstrap.md` when the worktree is missing repo-local env files.

## Prioritize Feedback

- Address `CHANGES_REQUESTED` reviews first.
- If the PR is `CONFLICTING` or `DIRTY`, resolve the base-branch conflict before polishing or adding another review round.
- Address unresolved review threads before stale or already resolved threads.
- Treat human GitHub input without a Codex marker as the higher-priority signal, even if it comes from the same `Likilee` account.
- If a reviewer suggestion conflicts with repo architecture or design-system rules, explain that conflict instead of applying it blindly.
- If feedback expands scope materially, move that change back into the issue workflow first.

When resolving conflicts:

- Prefer `git fetch origin` + `git merge --no-edit origin/main` over rebase so you can push without force.
- Resolve only the conflict scope needed to make the PR mergeable and keep the linked issue scope intact.
- Re-run the verification that covers the conflicted areas before pushing.

## Close The Loop

- Re-run the checks that prove the reviewer concern is addressed.
- Keep the PR summary and issue link accurate if scope changed.
- Reply in Korean by default with a short mapping from feedback item to change and verification.
- Use `[codex-followup]` plus `<!-- codex:automation=kcontext-pr-follow-up kind=followup head=<sha> state=done -->` on normal follow-up replies.
- Use `[codex-contract-sync]` plus `<!-- codex:automation=kcontext-pr-follow-up kind=contract-sync head=<sha> source=<url> -->` when you mutate issue or PR text because human feedback changed the contract.
- Do not mark work done if unresolved threads still point at a real risk.
