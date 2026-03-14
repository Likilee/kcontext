# Execution Checklist

## Before Coding

- Start a fresh thread with `[Issue #<number>] <issue title>` when possible.
- Confirm the issue is `status:ready`.
- Confirm the issue is not `status:blocked`.
- Confirm `Acceptance criteria`, `Verification`, and `Dependencies/Links` are present.
- If the issue is a tracking issue, work from a child issue instead.

## During Implementation

- Keep the issue scope fixed unless the issue is updated.
- Re-check the issue after any meaningful clarification from the user.
- Preserve branch naming as `codex/<issue-number>-slug`.

## PR Linking

- Full completion: `Closes #123`
- Partial delivery: `Refs #123`

## Blocked Comment Template

```md
Blocked because:
- <why work cannot continue>

Need:
- <decision, credential, or dependency>

Next action:
- <who needs to do what>
```
