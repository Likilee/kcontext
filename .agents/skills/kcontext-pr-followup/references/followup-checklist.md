# Follow-Up Checklist

## Before Editing

- Confirm the PR number and linked issue.
- Confirm the PR `next_actor` is `codex_followup`.
- Confirm whether the PR is already `CONFLICTING` or `DIRTY` against the base branch.
- Confirm which human review comments are actually actionable.
- Separate scope expansion from valid follow-up work.
- Check whether the latest human input is really a contract change rather than a code change.

## During Fixes

- Address `CHANGES_REQUESTED` first.
- If the branch conflicts with `main`, merge the base branch in and resolve conflicts before smaller cleanups.
- Handle unresolved review threads before polishing.
- Treat any GitHub input without a Codex marker as human input, even when authored by `Likilee`.
- Keep architecture and design-system rules intact even if a reviewer suggestion points the other way.
- Preserve the branch and issue linkage.

## Verification

- Re-run the checks that directly answer the review concern.
- Keep verification aligned with the linked issue and PR summary.
- Call out any feedback that could not be applied and explain why.

## Response Style

Use a short response that maps:

- what changed
- what was verified
- which feedback is still open, if any

Use `[codex-followup]` for normal follow-up replies and `[codex-contract-sync]` when the main action was mutating issue/PR text.
