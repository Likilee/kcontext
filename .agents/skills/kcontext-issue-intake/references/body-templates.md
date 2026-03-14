# Issue Body Templates

Use these headings exactly when creating or rewriting issues via `gh` or plain Markdown.
The repo workflow parses `Type`, `Priority`, `Area`, and `Status` from these headings.

## Task

```md
### Type
feature

### Priority
p1

### Area
web

### Status
ready

### Goal
Describe the user-facing or repo-facing outcome.

### Context
Explain why the work matters and link any related docs or issues.

### In scope
- Item 1
- Item 2

### Out of scope
- Item 1
- Item 2

### Acceptance criteria
- [ ] Observable outcome 1
- [ ] Observable outcome 2

### Verification
- `cd web && pnpm lint`
- `cd web && pnpm test`

### Dependencies/Links
none

### Tracking checklist (optional)
- [ ] #123
```

Use `Status = none` for backlog or tracking issues.

## Bug

```md
### Type
bug

### Priority
p1

### Area
web

### Status
ready

### User impact
Describe who is affected and how.

### Repro steps
1. Step 1
2. Step 2
3. Step 3

### Expected behavior
Describe the correct behavior.

### Actual behavior
Describe the current incorrect behavior.

### Suspected scope
- Likely file or system 1
- Likely file or system 2

### Acceptance criteria
- [ ] Observable outcome 1
- [ ] Observable outcome 2

### Verification
- `cd web && pnpm test`
- `make e2e-smoke`

### Dependencies/Links
none

### Logs/Screenshots/Links
none
```
