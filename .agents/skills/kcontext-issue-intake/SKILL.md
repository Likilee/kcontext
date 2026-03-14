---
name: kcontext-issue-intake
description: Structure rough work requests into kcontext GitHub issues that follow the repo's issue-first workflow, label taxonomy, and Task/Bug requirements. Use when Codex needs to create a new task or bug issue, split a large request into a tracking issue plus smaller executable issues, rewrite an underspecified issue so it becomes `status:ready`, or open/update a repo issue via `gh` with correct `area/type/priority/status` labels.
---

# Kcontext Issue Intake

## Overview

Turn vague requests into executable GitHub issues for this repo.
Prefer the repo's issue-first workflow over ad hoc notes or long chat-only planning.

Read `docs/github-issue-first-workflow.md` when label semantics or readiness rules are unclear.

## Workflow

1. Decide whether the request is a `Task`, a `Bug`, or a larger `tracking issue`.
2. Choose one `type`, one `priority`, one or two `area` labels, and a `status`.
3. Draft the issue body with the exact headings from [body-templates.md](references/body-templates.md).
4. Split oversized requests into a parent tracking issue plus smaller child issues.
5. Create the issue with the bundled script or update an existing issue with `gh issue edit`.

## Decide The Issue Shape

- Use `Task` for features, refactors, chores, and docs work.
- Use `Bug` for reproducible behavior mismatches or regressions.
- Use a tracking issue only when the request is larger than roughly `0.5~1.5 day` of work.
- Tracking issues still use the Task body structure, but keep `Status = none` and move executable work into child issues.

## Choose Labels

- `type`: choose exactly one of `feature`, `bug`, `refactor`, `chore`, `docs`
- `priority`: choose exactly one of `p0`, `p1`, `p2`
- `area`: choose `web`, `cli`, `supabase`, `ci`, or `docs`; use one area by default and at most two when the work truly crosses boundaries
- `status`: choose `ready` only when acceptance criteria, verification, and dependencies are already explicit; choose `blocked` only with a concrete blocker comment; otherwise use `none`

## Write The Body

- Write issue titles and bodies in Korean by default.
- Keep code, commands, identifiers, labels, and external proper nouns in their original form when that is clearer.
- Keep `Acceptance criteria` observable and outcome-based.
- Keep `Verification` concrete; prefer actual repo commands such as `cd web && pnpm test`, `cd web && pnpm lint`, `cd cli && uv run ruff check .`, or `make e2e-smoke`.
- Write `Dependencies/Links` as `none` when there are no dependencies.
- Use the exact heading names from [body-templates.md](references/body-templates.md) so the repo workflow can parse the issue consistently. Keep the structural headings in English and write the actual content in Korean by default.

## Create The Issue

Preferred CLI path:

1. Copy the relevant body template into a temp file.
2. Fill in the body.
3. Run the bundled script.

```bash
cp .agents/skills/kcontext-issue-intake/references/body-templates.md /tmp/kcontext-issue-templates.md
```

For actual creation, use:

```bash
bash .agents/skills/kcontext-issue-intake/scripts/create-issue.sh \
  --kind task \
  --title "Search API 권한 흐름 정리" \
  --type refactor \
  --priority p1 \
  --area web \
  --status ready \
  --body-file /tmp/task-issue.md
```

For bugs, set `--kind bug --type bug`.
Use `--dry-run` first when you want to inspect the final title, labels, and body before opening the issue.

## Update Existing Issues

- Rewrite underspecified issues so they can become `status:ready`.
- If the work is too large, convert the original issue into a tracking issue and open smaller child issues.
- Preserve the original user intent; do not silently narrow scope unless the issue explicitly becomes a tracking issue.
- When moving an issue to `blocked`, leave the status change to normal `gh` commands or the triage skill so the blocker comment is not skipped.

## Hand Off To Execution

When a new issue is truly `status:ready`, prefer handing it off into a fresh Codex thread instead of continuing in a planning-heavy thread.

- Start the new thread with `[Issue #123] <issue title>`.
- Use the execution skill's kickoff helper to keep the thread title pattern, branch, and PR linkage aligned.
- Keep the issue body as the source of truth rather than copying the whole contract into chat.
