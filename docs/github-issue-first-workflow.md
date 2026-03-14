# GitHub Issue-First Workflow

`kcontext`는 비사소한 작업을 GitHub Issue에서 시작하는 운영 방식을 사용합니다.  
보드는 두지 않고 `labels + open/closed + assignee + linked PR + issue comments`를 상태 표현의 기본으로 사용합니다.

## 1. 기본 원칙

- 기능, 버그, 리팩터링, 설정 변경처럼 비사소한 작업은 모두 이슈에서 시작합니다.
- 아주 작은 수정만 예외입니다.
  - 기준: `15~30분 이하`, 단일 파일의 사소한 문구/주석/링크 수정
- 일반 작업 이슈의 목표 크기는 `0.5~1.5일`입니다.
- 더 큰 작업은 `tracking issue`로 만들고 실제 구현은 하위 이슈로 분리합니다.
- `tracking issue`는 `status:ready`를 붙이지 않습니다.
- 진행 중 상태는 별도 라벨로 만들지 않습니다.
  - `assignee` 또는 연결된 `open PR`이 있으면 진행 중으로 봅니다.
- GitHub 협업 기본 언어는 한국어입니다.
  - 이슈 제목/본문, PR 제목/본문, PR 리뷰, 후속 코멘트는 기본적으로 한국어로 작성합니다.
  - 코드, 명령어, 식별자, API 이름, 외부 문서의 고유 표현은 원문을 유지합니다.
  - 외부 도구 출력이나 기존 영어 문맥을 인용해야 할 때는 필요한 부분만 인용하고, 핵심 설명은 한국어로 적습니다.

## 2. 라벨 체계

### Area

- `area:web`
- `area:cli`
- `area:supabase`
- `area:ci`
- `area:docs`

### Type

- `type:feature`
- `type:bug`
- `type:refactor`
- `type:chore`
- `type:docs`

### Priority

- `priority:p0`
- `priority:p1`
- `priority:p2`

### Status

- `status:ready`
- `status:blocked`

## 3. 라벨 적용 규칙

- 실행 가능한 이슈는 `type` 1개, `priority` 1개를 반드시 가집니다.
- `area`는 기본 1개, 필요할 때만 최대 2개까지 붙입니다.
- `status`는 최대 1개만 사용합니다.
- `open`인데 `status:ready`가 없으면 backlog 또는 미정리 상태로 간주합니다.
- `status:blocked`를 붙일 때는 코멘트에 아래 3가지를 함께 남깁니다.
  - 막힌 이유
  - 필요한 결정 또는 입력
  - 다음 액션

## 4. Codex 착수 조건

Codex가 바로 집을 수 있는 이슈는 아래를 모두 만족해야 합니다.

- `status:ready`가 있다.
- `status:blocked`가 없다.
- `Acceptance criteria`가 명확하다.
- `Verification`에 실제 확인 방법이 있다.
- `Dependencies/Links`가 비어 있지 않다.

질문이 많이 필요한 문제는 먼저 이슈를 정리하고, 준비가 되면 `status:ready`를 붙입니다.

## 5. 이슈 템플릿

레포는 두 개의 폼만 사용합니다.

- `Task`
  - 기능, 리팩터링, chores, docs 작업
  - tracking issue도 이 템플릿을 사용하되 `Status = none`으로 둡니다.
- `Bug`
  - 재현 가능한 오동작, 회귀, 기대 동작 불일치

폼에서 고른 `Type / Priority / Area / Status` 값은 GitHub Actions가 실제 라벨로 동기화합니다.

## 6. PR 연결 규칙

- 완결 PR: `Closes #123`
- 부분 PR: `Refs #123`
- PR은 대표 이슈 하나에 반드시 연결합니다.
- 브랜치 이름은 `codex/<issue-number>-short-slug`를 사용합니다.
- PR 템플릿의 서술 문장은 기본적으로 한국어로 작성합니다.

`.github/pull_request_template.md`를 기본 템플릿으로 사용합니다.

## 7. Saved Search 추천

Saved Search는 GitHub 개인 설정이므로 레포에서 자동 생성하지 않습니다. 아래 쿼리를 각자 저장해서 사용합니다.

- Ready Queue
  - `is:issue is:open label:"status:ready" -label:"status:blocked"`
- Blocked
  - `is:issue is:open label:"status:blocked"`
- Bug Queue
  - `is:issue is:open label:"type:bug" -label:"status:blocked"`
- My Work
  - `is:issue is:open assignee:@me`
- Priority P0
  - `is:issue is:open label:"priority:p0"`
- Priority P1
  - `is:issue is:open label:"priority:p1"`

## 8. 라벨 동기화

레포가 관리하는 라벨 정의는 `.github/managed-labels.tsv`에 있습니다.

```bash
./scripts/sync-github-labels.sh
```

또는:

```bash
make github-labels-sync
```

필요하면 다른 저장소에도 적용할 수 있습니다.

```bash
./scripts/sync-github-labels.sh --repo owner/name
```

드라이런:

```bash
./scripts/sync-github-labels.sh --dry-run
```
