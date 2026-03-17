---
name: kcontext-issue-triage
description: Triage and maintain the kcontext GitHub issue queue without a board. Use when Codex needs to review backlog issues, report what is ready or blocked, normalize `area/type/priority/status` labels, move an issue between `ready`, `blocked`, and backlog, or identify issues that are missing acceptance criteria, verification steps, or dependencies before implementation starts.
---

# Kcontext Issue Triage

## Overview

Use this skill to keep the queue healthy enough that execution can start from `status:ready` issues without extra discovery turns.
Prefer it when the user asks for triage, queue review, ready work, blockers, or label cleanup.

Read `docs/github-issue-first-workflow.md` and [triage-rules.md](references/triage-rules.md) for the canonical rules.

## Quick Start

Run the queue report:

```bash
bash .agents/skills/kcontext-issue-triage/scripts/queue-report.sh
```

Update an issue's status:

```bash
bash .agents/skills/kcontext-issue-triage/scripts/set-issue-status.sh --issue 123 --status ready
```

When moving an issue to `blocked`, provide `--comment-file /tmp/blocker.md`.

## Decide The State

- `ready`: the issue is executable now
- `blocked`: the next action depends on an external decision, missing credential, or unresolved dependency
- `none`: backlog, tracking issue, or under-specified work that still needs refinement

## Triage Checklist

- Normalize labels so each executable issue has exactly one `type`, one `priority`, one or two `area` labels, and at most one `status`.
- Remove `status:ready` from tracking issues.
- Do not mark an issue ready unless `Acceptance criteria`, `Verification`, and `Dependencies/Links` are present.
- Remove or re-check `status:ready` when newer human PR/issue feedback makes the current issue body stale.
- Require a blocker comment whenever `status:blocked` is added.
- Report gaps clearly when an issue stays in backlog with no status label.

## Reporting

- Use the queue report script for ready, blocked, p0, p1, and backlog slices.
- Summaries should call out what is actionable now, what is blocked, and what still needs issue refinement.
- Prefer specific next actions over generic “needs more detail” statements.
