# Triage Rules

## Ready

Mark an issue `ready` only when:

- It has exactly one `type`
- It has exactly one `priority`
- It has one or two `area` labels
- It has no `status:blocked`
- It has concrete `Acceptance criteria`
- It has a usable `Verification` section
- It has explicit `Dependencies/Links`
- Its issue body is still aligned with the latest clarified human GitHub input

## Blocked

Mark an issue `blocked` only when work cannot continue without an external decision, missing credential, or unresolved dependency.
Always add a blocker comment.

Suggested blocker comment:

```md
Blocked because:
- <why work cannot continue>

Need:
- <decision, credential, or dependency>

Next action:
- <who needs to do what>
```

## Backlog / No Status

Leave `status` unset when:

- The issue is only an idea or rough request
- The issue is a tracking issue
- Acceptance criteria or verification still need work

## Useful Queries

- Ready: `label:"status:ready" -label:"status:blocked"`
- Blocked: `label:"status:blocked"`
- P0: `label:"priority:p0"`
- P1: `label:"priority:p1"`
- Backlog: `-label:"status:ready" -label:"status:blocked"`
