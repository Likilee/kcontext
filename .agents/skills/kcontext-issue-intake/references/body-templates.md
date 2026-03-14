# Issue Body Templates

Use these headings exactly when creating or rewriting issues via `gh` or plain Markdown.
Write issue titles and body prose in Korean by default, while keeping code, commands, identifiers, labels, and external proper nouns in their original form when clearer.
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
사용자 관점 또는 저장소 관점에서 기대하는 결과를 적습니다.

### Context
왜 필요한지와 관련 문서 또는 이슈를 적습니다.

### In scope
- 항목 1
- 항목 2

### Out of scope
- 항목 1
- 항목 2

### Acceptance criteria
- [ ] 관찰 가능한 결과 1
- [ ] 관찰 가능한 결과 2

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
누가 어떤 영향을 받는지 적습니다.

### Repro steps
1. 단계 1
2. 단계 2
3. 단계 3

### Expected behavior
정상적으로 기대하는 동작을 적습니다.

### Actual behavior
현재 발생하는 잘못된 동작을 적습니다.

### Suspected scope
- 관련 가능성이 높은 파일 또는 시스템 1
- 관련 가능성이 높은 파일 또는 시스템 2

### Acceptance criteria
- [ ] 관찰 가능한 결과 1
- [ ] 관찰 가능한 결과 2

### Verification
- `cd web && pnpm test`
- `make e2e-smoke`

### Dependencies/Links
none

### Logs/Screenshots/Links
none
```
