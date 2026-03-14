---
name: kcontext-issue-execution
description: Execute kcontext implementation work from a GitHub issue using the repo's issue-first rules. Use when Codex needs to start from an issue number or issue URL, confirm that the issue is truly `status:ready`, create the canonical `codex/123-short-slug` branch, carry acceptance criteria and verification through implementation, prepare a linked PR with `Closes` or `Refs`, or stop and escalate because the issue is underspecified or blocked.
---

# Kcontext Issue Execution

## Overview

Use this skill after the issue already exists and the user wants actual implementation work.
Do not use it to invent new work items from scratch; use the intake skill for that.

Read `docs/github-issue-first-workflow.md` and [execution-checklist.md](references/execution-checklist.md) when you need the exact repo rules.

## Preflight

Before editing code, confirm all of the following:

- The issue has `status:ready`.
- The issue does not have `status:blocked`.
- `Acceptance criteria` are concrete.
- `Verification` names actual checks or commands.
- `Dependencies/Links` are explicit.

If any of these are missing, stop and refine the issue first instead of coding against an ambiguous request.

## Start The Branch

Generate the canonical branch name from the issue:

```bash
bash .agents/skills/kcontext-issue-execution/scripts/start-issue-branch.sh --issue 123
```

Use `--create` only when it is safe to create or switch branches in the current worktree.
Add `--base main --create` when you want the branch created from `origin/main`.
When the issue title is mostly Korean, pass `--slug short-ascii-slug` to keep the branch name readable.

## Execute From The Issue

- Treat the issue body as the working contract.
- Implement only the in-scope work unless the issue is explicitly expanded.
- Verify against the named acceptance criteria, not your own inferred scope.
- Keep the issue number visible in local notes, commits, and PR context.

## Link The PR

- Use `Closes #<issue>` only when the PR fully resolves the issue.
- Use `Refs #<issue>` for partial steps.
- Keep PR verification aligned with the issue's `Verification` section.
- Use the repo PR template at `.github/pull_request_template.md`.

## Handle Blockers

- If the issue becomes blocked, stop implementation.
- Leave a concrete blocker note using the template in [execution-checklist.md](references/execution-checklist.md).
- Switch the issue to `status:blocked` with normal `gh` commands or the triage skill.
- Do not silently continue on assumptions that should live back in the issue.
