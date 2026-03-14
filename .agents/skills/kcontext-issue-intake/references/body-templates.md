# Issue Body Templates

Use these headings exactly when creating or rewriting issues via `gh` or plain Markdown.
Write issue titles and body prose in Korean by default, while keeping code, commands, identifiers, labels, and external proper nouns in their original form when clearer.
The repo workflow parses `유형/Type`, `우선순위/Priority`, `영역/Area`, and `상태/Status` from these headings.

## Task

```md
### 유형
feature

### 우선순위
p1

### 영역
web

### 상태
ready

### 목표
사용자 관점 또는 저장소 관점에서 기대하는 결과를 적습니다.

### 배경
왜 필요한지와 관련 문서 또는 이슈를 적습니다.

### 범위 포함
- 항목 1
- 항목 2

### 범위 제외
- 항목 1
- 항목 2

### 완료 기준
- [ ] 관찰 가능한 결과 1
- [ ] 관찰 가능한 결과 2

### 검증
- `cd web && pnpm lint`
- `cd web && pnpm test`

### 의존성/링크
none

### 트래킹 체크리스트 (선택)
- [ ] #123
```

Use `상태 = none` for backlog or tracking issues.

## Bug

```md
### 유형
bug

### 우선순위
p1

### 영역
web

### 상태
ready

### 사용자 영향
누가 어떤 영향을 받는지 적습니다.

### 재현 절차
1. 단계 1
2. 단계 2
3. 단계 3

### 기대 동작
정상적으로 기대하는 동작을 적습니다.

### 실제 동작
현재 발생하는 잘못된 동작을 적습니다.

### 의심 범위
- 관련 가능성이 높은 파일 또는 시스템 1
- 관련 가능성이 높은 파일 또는 시스템 2

### 완료 기준
- [ ] 관찰 가능한 결과 1
- [ ] 관찰 가능한 결과 2

### 검증
- `cd web && pnpm test`
- `make e2e-smoke`

### 의존성/링크
none

### 로그/스크린샷/링크
none
```
