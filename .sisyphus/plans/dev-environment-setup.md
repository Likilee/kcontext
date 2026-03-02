# Plan: kcontext 개발환경 설정 (Dev Environment Setup)

## Overview
kcontext 프로젝트의 AI-native 개발환경을 그린필드 상태에서 완전 구축한다. 프로젝트 스캐폴딩, 코드 품질 자동화, 디자인 토큰 시스템, Supabase 클라이언트, CLI 파이프라인, AGENTS.md, CI/CD까지 전체 개발 인프라를 세팅한다.

## Context
- **프로젝트**: kcontext — 한국어 학습자를 위한 YouTube 자막 기반 문맥 검색 도구
- **현재 상태**: docs/ + README.md만 존재. 코드 제로.
- **레포**: github.com/Likilee/kcontext (dozboon의 git submodule)
- **참조 문서**: docs/system-design.md, docs/frontend-architecture.md, docs/cli-architecture.md, docs/database-scheme.md, docs/design-system-and-token-guide.md, docs/brand-identity-and-tone-of-voice-guide.md

## Tech Stack (Confirmed)
| Category | Tool |
|----------|------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend/DB | Supabase (PostgreSQL + Object Storage) |
| CLI Pipeline | Python + Typer + yt-dlp + youtube-transcript-api + psycopg2 |
| JS Package Manager | pnpm |
| Python Package Manager | uv |
| Linter/Formatter (JS/TS) | Biome |
| Linter/Formatter (Python) | ruff |
| Test Framework | Vitest |
| Git Hooks | lefthook |
| CI/CD | GitHub Actions |
| Deployment | Vercel (auto-deploy from GitHub) |

## Architecture Decisions
- **레포 레이아웃**: 단일 레포, 디렉토리 분리 — `web/` (Next.js) + `cli/` (Python)
- **설정 파일 위치**: `.gitignore`, `lefthook.yml`, `AGENTS.md`, `biome.json` = 프로젝트 루트. `biome.json`은 `includes`로 `web/` 타겟.
- **pnpm workspace 불필요**: `web/`만 Node.js 관리, `cli/`는 uv 독립 관리.
- **디자인 토큰 SSoT**: `docs/design-system-and-token-guide.md` (Approved Final). 브랜드 가이드의 `#FDE047`은 무시, 토큰 가이드의 `#FACC15` 사용.
- **Supabase 클라이언트**: `@supabase/ssr` 패턴 (Server/Browser 분리). docs의 싱글턴 패턴은 App Router에 맞게 진화.
- **Clean Architecture 경로**: `src/domain/`, `src/application/`, `src/infrastructure/` 는 `web/src/` 내부에 위치.

## Guardrails (from Metis Review)
- ❌ eslint, prettier, stylelint, jest, testing-library, cypress 설치 금지
- ❌ Docker, docker-compose, Makefile 생성 금지
- ❌ Storybook, Chromatic 설정 금지
- ❌ 라이트 테마 토큰 추가 금지 (다크 테마 단일 기준)
- ❌ 토큰 가이드에 없는 임의의 색상/스페이싱/타이포 값 추가 금지
- ❌ placeholder 컴포넌트 대량 생성 금지 (최소한의 루트 페이지만)
- ❌ .env.production, .env.staging 등 환경별 설정 파일 금지
- ❌ husky, lint-staged 설치 금지 (lefthook만 사용)
- ❌ middleware.ts에 인증 로직 금지 (Supabase 클라이언트 유틸리티만)
- ❌ create-next-app 기본 보일러플레이트(spinning logo 등) 남겨두기 금지

---

## Tasks

<!-- TASKS_START -->

### Task 0: Git Hygiene — .gitignore 생성 및 기존 docs 커밋

**Priority**: 🔴 Critical (모든 후속 태스크의 전제조건)
**Depends on**: None
**Estimated effort**: 5분

**Why**: 현재 .gitignore가 없고, docs/가 커밋되어 있지만 이후 스캐폴딩에서 생성되는 node_modules/, .next/, __pycache__/ 등이 트래킹되는 것을 방지해야 한다.

**Steps**:
1. 프로젝트 루트에 `.gitignore` 생성. 아래 내용 포함:
   ```gitignore
   # Dependencies
   node_modules/
   .pnpm-store/

   # Next.js
   .next/
   out/

   # Python
   __pycache__/
   *.pyc
   *.pyo
   .venv/
   .python-version
   dist/
   *.egg-info/

   # Environment
   .env
   .env.local
   .env.*.local

   # OS
   .DS_Store
   Thumbs.db

   # IDE
   .vscode/
   .idea/
   *.swp
   *.swo

   # Sisyphus (planning artifacts)
   .sisyphus/drafts/

   # Vercel
   .vercel/

   # Test
   coverage/
   ```
2. `.sisyphus/drafts/` 디렉토리가 gitignore에 포함됨을 확인 (drafts는 임시, plans는 커밋 대상).
3. `git add .gitignore && git commit -m "chore: add .gitignore"` 실행.

**QA / Acceptance Criteria**:
```bash
test -f .gitignore && echo "PASS: .gitignore exists"
git status --porcelain | grep -q "node_modules" && echo "FAIL" || echo "PASS: node_modules not tracked"
```

---

### Task 1: Next.js 프로젝트 스캐폴딩 (web/)

**Priority**: 🔴 Critical
**Depends on**: Task 0
**Estimated effort**: 10분

**Why**: Frontend 앱의 기본 뼈대. 이후 Biome, Tailwind 토큰, Vitest 등 모든 web/ 관련 태스크의 기반.

**Steps**:
1. 프로젝트 루트에서 실행:
   ```bash
   pnpm create next-app web --app --tailwind --src-dir --use-pnpm --typescript --no-eslint --no-import-alias
   ```
   - `--no-eslint`: Biome 사용하므로 ESLint 제외
   - `--src-dir`: `web/src/` 구조 사용 (Clean Architecture 레이어 배치용)
   - `--no-import-alias`: 이후 수동으로 `@/` alias를 `tsconfig.json`에서 설정

2. 생성된 `web/` 디렉토리 진입 후 보일러플레이트 정리:
   - `web/src/app/page.tsx` — create-next-app 기본 콘텐츠(spinning logo, "Get started" 등) 전부 제거. 아래로 교체:
     ```tsx
     export default function HomePage() {
       return (
         <main>
           <h1>kcontext</h1>
           <p>Real Korean, Right in Context.</p>
         </main>
       );
     }
     ```
   - `web/src/app/layout.tsx` — 기본 구조 유지하되, metadata를 프로젝트에 맞게 수정:
     ```tsx
     import type { Metadata } from "next";
     import "./globals.css";

     export const metadata: Metadata = {
       title: "kcontext",
       description: "Real Korean, Right in Context.",
     };

     export default function RootLayout({
       children,
     }: Readonly<{
       children: React.ReactNode;
     }>) {
       return (
         <html lang="en" className="dark">
           <body>{children}</body>
         </html>
       );
     }
     ```
     - 폰트 import는 Task 6 (디자인 토큰)에서 처리. 여기선 제거.
     - `className="dark"` 추가 — 다크 테마 단일 기준.
   - `web/src/app/globals.css` — create-next-app 기본 스타일 전부 제거. Tailwind 디렉티브만 남김:
     ```css
     @import "tailwindcss";
     ```
   - `web/public/` 내 기본 이미지 파일들 (next.svg, vercel.svg, file.svg, globe.svg, window.svg 등) 모두 삭제.
   - `web/src/app/favicon.ico` 유지 (추후 교체).

3. `web/tsconfig.json`에 strict+ 옵션 추가:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "noImplicitOverride": true,
       "forceConsistentCasingInFileNames": true,
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```
   - `create-next-app`이 생성한 기존 설정은 유지하고, 위 옵션들을 **병합**한다.
   - `noUncheckedIndexedAccess` — 자막 배열 인덱스 접근 시 undefined 체크 강제.

4. 빌드 검증:
   ```bash
   cd web && pnpm run build
   ```

**QA / Acceptance Criteria**:
```bash
cd web && pnpm next --version  # exits 0, outputs version
cd web && pnpm run build       # exits 0, "Compiled successfully"
cd web && pnpm tsc --noEmit    # exits 0
# 보일러플레이트 제거 확인:
! grep -q "Get started" web/src/app/page.tsx && echo "PASS: boilerplate removed"
! ls web/public/next.svg 2>/dev/null && echo "PASS: default images removed"
```

---

### Task 2: Clean Architecture 디렉토리 구조 생성

**Priority**: 🟡 High
**Depends on**: Task 1
**Estimated effort**: 5분

**Why**: docs/frontend-architecture.md에 정의된 4-Layer 구조를 물리적 디렉토리로 반영. AI agent가 새 파일을 생성할 때 어디에 놓아야 하는지 명확한 가이드라인 제공.

**Steps**:
1. `web/src/` 아래에 Clean Architecture 레이어별 디렉토리 생성:
   ```
   web/src/
   ├── app/                  # (이미 존재) Next.js App Router — 라우팅, 레이아웃, 서버 액션
   ├── domain/               # 순수 비즈니스 모델 (외부 의존성 없음)
   │   └── models/
   │       └── .gitkeep
   ├── application/          # 유스케이스, 포트(인터페이스)
   │   └── ports/
   │       └── .gitkeep
   ├── infrastructure/       # 어댑터, 외부 서비스 연동 (Supabase, YouTube API)
   │   └── adapters/
   │       └── .gitkeep
   ├── components/           # UI 컴포넌트 (프레젠테이션 레이어)
   │   └── .gitkeep
   └── lib/                  # 공유 유틸리티, 헬퍼 함수
       └── .gitkeep
   ```
2. 각 레이어 디렉토리에 `.gitkeep` 파일 생성 (빈 디렉토리 git 트래킹용).
3. `web/src/domain/models/` 에 docs/frontend-architecture.md의 도메인 모델 타입 파일 생성:
   ```typescript
   // web/src/domain/models/subtitle.ts
   export interface VideoMeta {
     videoId: string;
     title: string;
     channelName: string;
   }

   export interface SearchResult extends VideoMeta {
     startTime: number;
     matchedText: string;
   }

   export interface SubtitleChunk {
     startTime: number;
     text: string;
   }
   ```
4. `web/src/application/ports/` 에 리포지토리 인터페이스 생성:
   ```typescript
   // web/src/application/ports/subtitle-repository.ts
   import type { SearchResult, SubtitleChunk } from "@/domain/models/subtitle";

   export interface SubtitleRepository {
     searchByKeyword(keyword: string): Promise<SearchResult[]>;
     getFullTranscript(videoId: string): Promise<SubtitleChunk[]>;
   }
   ```

**Naming Convention**: 파일명은 `kebab-case.ts`. 타입/인터페이스명은 `PascalCase`. 이 규칙을 AGENTS.md에 명시.

**QA / Acceptance Criteria**:
```bash
# 디렉토리 구조 확인
test -d web/src/domain/models && echo "PASS"
test -d web/src/application/ports && echo "PASS"
test -d web/src/infrastructure/adapters && echo "PASS"
test -d web/src/components && echo "PASS"
test -d web/src/lib && echo "PASS"
# 타입 파일 컴파일 확인
cd web && pnpm tsc --noEmit  # exits 0
```

---

### Task 3: CLI Pipeline 스캐폴딩 (cli/)

**Priority**: 🟡 High
**Depends on**: Task 0
**Estimated effort**: 10분

**Why**: docs/cli-architecture.md에 정의된 Python CLI 데이터 파이프라인의 프로젝트 구조를 구축. `uv`로 의존성을 관리하고, 4개 명령어(list, fetch, build, push)의 진입점을 준비한다.

**Steps**:
1. 프로젝트 루트에서 uv로 Python 프로젝트 초기화:
   ```bash
   uv init cli --package
   ```
   - `--package`로 설치 가능한 패키지 구조 생성

2. `cli/pyproject.toml`을 아래 내용으로 교체 (uv init이 생성한 기본 내용 대체):
   ```toml
   [project]
   name = "kcontext-cli"
   version = "0.1.0"
   description = "kcontext data pipeline CLI - fetch, build, push YouTube subtitle data"
   readme = "README.md"
   requires-python = ">=3.12"
   dependencies = [
       "typer>=0.15.0",
       "yt-dlp>=2024.0.0",
       "youtube-transcript-api>=1.0.0",
       "psycopg2-binary>=2.9.0",
       "supabase>=2.0.0",
   ]

   [project.scripts]
   kcontext = "kcontext_cli.main:app"

   [tool.ruff]
   target-version = "py312"
   line-length = 100

   [tool.ruff.lint]
   select = ["E", "F", "I", "N", "UP", "B", "SIM", "TCH"]

   [tool.ruff.format]
   quote-style = "double"

   [build-system]
   requires = ["hatchling"]
   build-backend = "hatchling.build"
   ```
   - `requires-python = ">=3.12"` — 3.12+ 안정 지원 보장
   - `ruff` 설정을 pyproject.toml 내부에 인라인 (별도 파일 불필요)
   - `[project.scripts]` — `kcontext` 명령어로 CLI 실행 가능

3. CLI 소스 디렉토리 구조 생성:
   ```
   cli/src/kcontext_cli/
   ├── __init__.py          # 빈 파일
   ├── main.py              # Typer 앱 진입점
   └── commands/
       ├── __init__.py      # 빈 파일
       ├── list_cmd.py      # cli list <url> [--limit]
       ├── fetch.py         # cli fetch <video_id> -o <path>
       ├── build.py         # cli build <input> -d <output_dir>
       └── push.py          # cli push -s <storage> -vc <video> -sc <subtitle>
   ```

4. `cli/src/kcontext_cli/main.py` 생성 — Typer 앱 뼈대:
   ```python
   """kcontext CLI - YouTube subtitle data pipeline."""

   import typer

   from kcontext_cli.commands import list_cmd, fetch, build, push

   app = typer.Typer(
       name="kcontext",
       help="kcontext data pipeline: fetch, build, push YouTube subtitle data to Supabase.",
       no_args_is_help=True,
   )

   app.command(name="list")(list_cmd.list_videos)
   app.command(name="fetch")(fetch.fetch_subtitle)
   app.command(name="build")(build.build_artifacts)
   app.command(name="push")(push.push_data)

   if __name__ == "__main__":
       app()
   ```

5. 각 명령어 파일에 최소 스텁 함수 생성. 예시 (`list_cmd.py`):
   ```python
   """Extract video IDs from a YouTube channel or playlist URL."""

   import typer


   def list_videos(
       url: str = typer.Argument(help="YouTube channel or playlist URL"),
       limit: int = typer.Option(50, help="Maximum number of video IDs to extract"),
   ) -> None:
       """Extract video IDs from a YouTube channel or playlist URL."""
       typer.echo(f"Listing videos from {url} (limit: {limit})", err=True)
       raise typer.Exit(code=1)  # Not implemented yet
   ```
   - 나머지 명령어도 docs/cli-architecture.md의 Signature를 참조하여 동일 패턴으로 스텁 생성.

6. 의존성 설치 및 검증:
   ```bash
   cd cli && uv sync
   uv run kcontext --help
   ```

**QA / Acceptance Criteria**:
```bash
cd cli && uv run python -c "import typer; print('ok')"  # exits 0
cd cli && uv run kcontext --help                         # exits 0, 도움말 출력
cd cli && uv run ruff check .                            # exits 0
cd cli && uv run ruff format --check .                   # exits 0
```

---

### Task 4: Biome 설정 (코드 품질 도구)

**Priority**: 🟡 High
**Depends on**: Task 1
**Estimated effort**: 5분

**Why**: AI agent가 생성한 코드의 일관성과 품질을 자동 보장. Biome은 lint + format 통합 도구로, ESLint+Prettier 조합 대비 10-100x 빠른 피드백을 제공한다.

**Steps**:
1. 프로젝트 **루트**에 Biome 설치 (web/ 내부가 아닌 루트에서 관리):
   ```bash
   cd web && pnpm add -D @biomejs/biome
   ```

2. 프로젝트 **루트**에 `biome.json` 생성:
   ```json
   {
     "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
     "vcs": {
       "enabled": true,
       "clientKind": "git",
       "useIgnoreFile": true
     },
     "organizeImports": {
       "enabled": true
     },
     "formatter": {
       "enabled": true,
       "indentStyle": "space",
       "indentWidth": 2,
       "lineWidth": 100
     },
     "linter": {
       "enabled": true,
       "rules": {
         "recommended": true,
         "correctness": {
           "noUnusedImports": "error",
           "noUnusedVariables": "warn",
           "useExhaustiveDependencies": "warn"
         },
         "style": {
           "noNonNullAssertion": "warn",
           "useConst": "error",
           "useImportType": "error"
         },
         "suspicious": {
           "noExplicitAny": "warn"
         }
       }
     },
     "javascript": {
       "formatter": {
         "quoteStyle": "double",
         "trailingCommas": "all"
       }
     },
     "files": {
       "include": ["web/src/**/*.ts", "web/src/**/*.tsx"],
       "ignore": ["node_modules", ".next", "dist", "coverage"]
     }
   }
   ```
   - `files.include`로 `web/src/`만 타겟 (cli/ Python 코드 제외)
   - `useImportType: "error"` — `import type`을 강제하여 번들 사이즈 최적화
   - `noUnusedImports: "error"` — AI agent가 생성한 미사용 import 자동 감지

3. `web/package.json`에 Biome 스크립트 추가:
   ```json
   {
     "scripts": {
       "lint": "biome check --config-path=.. src/",
       "lint:fix": "biome check --config-path=.. --write src/",
       "format": "biome format --config-path=.. --write src/"
     }
   }
   ```
   - `--config-path=..` — 루트의 `biome.json` 참조

4. 기존 생성된 코드에 대해 Biome 실행하여 포맷 적용:
   ```bash
   cd web && pnpm lint:fix
   ```

5. 만약 ESLint 관련 패키지가 `web/package.json`의 devDependencies에 존재하면 제거:
   ```bash
   cd web && pnpm remove eslint eslint-config-next @eslint/eslintrc 2>/dev/null || true
   ```
   `.eslintrc*` 파일이 존재하면 삭제.

**QA / Acceptance Criteria**:
```bash
cd web && pnpm lint             # exits 0
test -f biome.json && echo "PASS: biome.json at root"
! test -f web/.eslintrc* && echo "PASS: no eslint config"
! pnpm list eslint --depth=0 2>/dev/null | grep -q eslint && echo "PASS: eslint not installed"
```

---

### Task 5: lefthook 설정 (Git Hooks 자동화)

**Priority**: 🟡 High
**Depends on**: Task 4 (Biome), Task 3 (ruff in CLI)
**Estimated effort**: 5분

**Why**: commit 시점에 자동으로 lint/format을 실행하여, 코드 품질 위반이 레포에 유입되는 것을 원천 차단. AI agent가 생성한 코드도 커밋 전에 자동 검증된다.

**Steps**:
1. lefthook 설치 (Homebrew로 시스템 레벨 설치 확인, 없으면 설치):
   ```bash
   which lefthook || brew install lefthook
   ```

2. 프로젝트 루트에 `lefthook.yml` 생성:
   ```yaml
   pre-commit:
     parallel: true
     commands:
       biome-check:
         glob: "web/src/**/*.{ts,tsx}"
         run: npx --prefix web biome check --config-path=. {staged_files}
       ruff-check:
         glob: "cli/**/*.py"
         run: cd cli && uv run ruff check .
       ruff-format:
         glob: "cli/**/*.py"
         run: cd cli && uv run ruff format --check .
   ```
   - `parallel: true` — Biome(TS)와 ruff(Python) 동시 실행
   - staged 파일만 검사 (전체 코드베이스 아닌 변경분만)
   - Biome은 루트의 `biome.json` 참조

3. lefthook 활성화:
   ```bash
   lefthook install
   ```

4. 검증 — 더미 커밋으로 hooks 동작 확인:
   ```bash
   lefthook run pre-commit
   ```

**QA / Acceptance Criteria**:
```bash
test -f lefthook.yml && echo "PASS: lefthook.yml exists"
test -f .git/hooks/pre-commit && echo "PASS: hook installed"
lefthook run pre-commit  # exits 0
```

---

### Task 6: 디자인 토큰 시스템 구축 (Tailwind CSS)

**Priority**: 🟡 High
**Depends on**: Task 1
**Estimated effort**: 15분

**Why**: docs/design-system-and-token-guide.md (Approved Final)에 정의된 3-tier 토큰 시스템을 Tailwind CSS에 구현. 모든 UI 스타일링의 SSoT(Single Source of Truth). AI agent가 임의의 px 값을 하드코딩하는 것을 구조적으로 방지한다.

**SSoT**: `docs/design-system-and-token-guide.md` — 이 문서의 값만 사용. `docs/brand-identity-and-tone-of-voice-guide.md`의 `#FDE047`은 무시하고 토큰 가이드의 `#FACC15` (color-yellow-400) 사용.

**Steps**:

1. 폰트 패키지 설치:
   ```bash
   cd web && pnpm add pretendard @fontsource-variable/inter
   ```
   - `pretendard` — 한국어 자막 전용 폰트 (Google Fonts 미지원이므로 npm 패키지 사용)
   - `@fontsource-variable/inter` — UI/영문 폰트 (variable font로 성능 최적화)

2. `web/src/app/layout.tsx`에 폰트 로딩 추가:
   ```tsx
   import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
   import "@fontsource-variable/inter";
   import "./globals.css";
   ```
   - `next/font` 대신 CSS import 방식 — Pretendard는 next/font/local 설정이 복잡하므로 CSS import로 단순화.

3. `web/src/app/globals.css`에 3-tier 디자인 토큰 구현:
   ```css
   @import "tailwindcss";

   /*
    * ==========================================================
    * Level 1: Primitive Tokens (원시 계층)
    * SSoT: docs/design-system-and-token-guide.md Section 2
    * 주의: 이 값들을 컴포넌트에서 직접 참조 금지.
    *       반드시 Semantic Token을 통해 사용할 것.
    * ==========================================================
    */
   @theme {
     /* Color Palette */
     --color-gray-000: #FFFFFF;
     --color-gray-050: #F9FAFB;
     --color-gray-100: #F3F4F6;
     --color-gray-400: #9CA3AF;
     --color-gray-500: #6B7280;
     --color-gray-700: #374151;
     --color-gray-800: #1F2937;
     --color-gray-900: #111827;
     --color-gray-1000: #000000;
     --color-yellow-400: #FACC15;
     --color-yellow-500: #EAB308;
     --color-blue-600: #2563EB;

     /* Typography Scale */
     --font-family-sans: "Inter Variable", "Inter", sans-serif;
     --font-family-kr: "Pretendard Variable", "Pretendard", sans-serif;
     --font-size-13: 13px;
     --font-size-16: 16px;
     --font-size-18: 18px;
     --font-size-20: 20px;
     --font-size-28: 28px;
     --line-height-tight: 1.4;
     --line-height-relaxed: 1.5;

     /* Spacing & Radius (4px Grid) */
     --spacing-04: 4px;
     --spacing-08: 8px;
     --spacing-12: 12px;
     --spacing-16: 16px;
     --spacing-24: 24px;
     --spacing-32: 32px;
     --spacing-48: 48px;
     --radius-04: 4px;
     --radius-08: 8px;
     --radius-pill: 9999px;

     /* Motion */
     --duration-instant: 0ms;
     --duration-fast: 100ms;
     --duration-base: 200ms;
   }

   /*
    * ==========================================================
    * Level 2: Semantic Tokens (의미론적 계층)
    * SSoT: docs/design-system-and-token-guide.md Section 3
    * 테마 변경 시 이 매핑만 전환.
    * ==========================================================
    */
   :root {
     /* Background */
     --bg-base: var(--color-gray-900);
     --bg-surface: var(--color-gray-800);
     --bg-surface-hover: var(--color-gray-700);

     /* Text & Icon */
     --text-primary: var(--color-gray-050);
     --text-secondary: var(--color-gray-400);
     --text-disabled: var(--color-gray-500);
     --text-inverse: var(--color-gray-1000);

     /* Border */
     --border-subtle: var(--color-gray-800);
     --border-default: var(--color-gray-700);
     --border-focus: var(--color-yellow-500);

     /* Brand & Action */
     --brand-highlight: var(--color-yellow-400);
     --action-primary: var(--color-yellow-500);
     --action-link: var(--color-blue-600);

     /* Layout Spacing */
     --space-layout-screen: var(--spacing-16);
     --space-layout-section: var(--spacing-48);

     /* Container Inset */
     --space-inset-base: var(--spacing-16);
     --space-inset-squish-x: var(--spacing-16);
     --space-inset-squish-y: var(--spacing-12);

     /* Item & Inline Gap */
     --space-gap-group: var(--spacing-24);
     --space-gap-item: var(--spacing-08);
     --space-gap-micro: var(--spacing-04);
   }

   @media (min-width: 1024px) {
     :root {
       --space-layout-screen: var(--spacing-24);
     }
   }

   /*
    * ==========================================================
    * Base Styles
    * ==========================================================
    */
   body {
     background-color: var(--bg-base);
     color: var(--text-primary);
     font-family: var(--font-family-sans);
   }
   ```
   - Tailwind CSS v4의 `@theme` 디렉티브로 Primitive 토큰 등록 → 유틸리티 클래스 자동 생성
   - Semantic 토큰은 CSS custom properties로 `:root`에 선언 → `var()` 참조
   - 반응형 `--space-layout-screen` — 데스크탑에서 24px로 확장

4. 프로젝트 내에서 `globals.css`의 토큰 주석에 "직접 참조 금지" 경고를 명시하여, AI agent가 Primitive 토큰을 컴포넌트에서 직접 사용하는 것을 방지.

5. 빌드 검증:
   ```bash
   cd web && pnpm run build
   ```

**QA / Acceptance Criteria**:
```bash
cd web && pnpm run build   # exits 0 (Tailwind이 커스텀 토큰으로 정상 컴파일)
cd web && pnpm tsc --noEmit  # exits 0
# 토큰 값 존재 확인:
grep -q "bg-base" web/src/app/globals.css && echo "PASS: semantic tokens defined"
grep -q "color-yellow-400" web/src/app/globals.css && echo "PASS: primitive tokens defined"
grep -q "Pretendard" web/src/app/globals.css && echo "PASS: Korean font registered"
```

---

### Task 7: Supabase 클라이언트 설정

**Priority**: 🟡 High
**Depends on**: Task 2 (디렉토리 구조)
**Estimated effort**: 10분

**Why**: docs/frontend-architecture.md의 Clean Architecture 경계를 준수하면서, App Router에 최적화된 Supabase 연결을 설정. Server Component와 Client Component에서 각각 올바른 클라이언트를 사용하도록 구조화한다.

**Architecture Note**: docs에서는 `@/lib/supabase-client`에 싱글턴을 두지만, Next.js App Router + `@supabase/ssr` 패턴에서는 Server/Browser 분리가 필수. Clean Architecture 원칙에 따라 Supabase 클라이언트는 `infrastructure/` 레이어에 배치한다.

**Steps**:

1. Supabase 패키지 설치:
   ```bash
   cd web && pnpm add @supabase/supabase-js @supabase/ssr
   ```

2. 환경변수 템플릿 생성 — 프로젝트 루트에 `.env.local.example`:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

   # Supabase Storage CDN (Track B: subtitle JSON files)
   NEXT_PUBLIC_CDN_URL=https://your-project.supabase.co/storage/v1/object/public
   ```
   - `NEXT_PUBLIC_` 접두사 — 브라우저에서 접근 가능 (Supabase anon key는 RLS로 보호되므로 안전)
   - **실제 키는 절대 커밋하지 않음** — `.gitignore`에 `.env.local` 포함 확인

3. Server Client 생성 — `web/src/infrastructure/supabase/server.ts`:
   ```typescript
   import { createServerClient } from "@supabase/ssr";
   import { cookies } from "next/headers";

   export async function createSupabaseServerClient() {
     const cookieStore = await cookies();

     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         cookies: {
           getAll() {
             return cookieStore.getAll();
           },
           setAll(cookiesToSet) {
             for (const { name, value, options } of cookiesToSet) {
               cookieStore.set(name, value, options);
             }
           },
         },
       },
     );
   }
   ```

4. Browser Client 생성 — `web/src/infrastructure/supabase/client.ts`:
   ```typescript
   import { createBrowserClient } from "@supabase/ssr";

   export function createSupabaseBrowserClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
     );
   }
   ```

5. 타입 안전성을 위한 환경변수 검증 유틸리티 — `web/src/lib/env.ts`:
   ```typescript
   export function getEnvVar(name: string): string {
     const value = process.env[name];
     if (!value) {
       throw new Error(`Missing environment variable: ${name}`);
     }
     return value;
   }
   ```

6. `web/src/infrastructure/supabase/` 디렉토리에 `index.ts` barrel export 생성:
   ```typescript
   // web/src/infrastructure/supabase/index.ts
   export { createSupabaseBrowserClient } from "./client";
   export { createSupabaseServerClient } from "./server";
   ```

7. TypeScript 컴파일 검증:
   ```bash
   cd web && pnpm tsc --noEmit
   ```

**QA / Acceptance Criteria**:
```bash
test -f .env.local.example && echo "PASS: env template exists"
test -f web/src/infrastructure/supabase/server.ts && echo "PASS: server client"
test -f web/src/infrastructure/supabase/client.ts && echo "PASS: browser client"
cd web && pnpm tsc --noEmit  # exits 0
# .env.local이 커밋되지 않도록 확인:
grep -q ".env.local" .gitignore && echo "PASS: env excluded from git"
```

---

### Task 8: Vitest 설정 (테스트 프레임워크)

**Priority**: 🟡 High
**Depends on**: Task 1, Task 2
**Estimated effort**: 10분

**Why**: AI agent가 코드를 생성한 후 자동으로 테스트를 실행하는 피드백 루프의 핵심. Vitest는 Vite 네이티브로 ESM 퍼스트, HMR 테스트를 지원하며 Jest 호환 API를 제공한다. 현 단계에서는 프레임워크 설정 + smoke test 1개만. 피처 테스트는 피처 구현 시 작성.

**Steps**:

1. Vitest 및 관련 패키지 설치:
   ```bash
   cd web && pnpm add -D vitest @vitejs/plugin-react jsdom
   ```
   - `@vitejs/plugin-react` — JSX/TSX 변환 지원 (React 컴포넌트 테스트 시 필요)
   - `jsdom` — Vitest의 `environment: "jsdom"` 설정에 필요한 DOM 환경 구현체

2. `web/vitest.config.ts` 생성:
   ```typescript
   import react from "@vitejs/plugin-react";
   import { resolve } from "node:path";
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     plugins: [react()],
     resolve: {
       alias: {
         "@": resolve(__dirname, "./src"),
       },
     },
     test: {
       globals: true,
       environment: "jsdom",
       include: ["src/**/*.{test,spec}.{ts,tsx}"],
       exclude: ["node_modules", ".next"],
       coverage: {
         provider: "v8",
         include: ["src/**/*.{ts,tsx}"],
         exclude: ["src/**/*.d.ts", "src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
       },
     },
   });
   ```
   - `globals: true` — `describe`, `it`, `expect` 전역 사용 (import 불필요)
   - `environment: "jsdom"` — DOM API 테스트 환경
   - `@` alias — tsconfig.json과 동일한 path alias

3. `web/tsconfig.json`에 Vitest 타입 추가 (globals 사용을 위해):
   - `compilerOptions.types` 배열에 `"vitest/globals"` 추가

4. `web/package.json`에 테스트 스크립트 추가:
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

5. Smoke test 생성 — `web/src/domain/models/subtitle.test.ts`:
   ```typescript
   import type { SearchResult, SubtitleChunk, VideoMeta } from "./subtitle";

   describe("Domain Models", () => {
     it("should define VideoMeta shape", () => {
       const meta: VideoMeta = {
         videoId: "abc123",
         title: "Test Video",
         channelName: "Test Channel",
       };
       expect(meta.videoId).toBe("abc123");
     });

     it("should define SearchResult extending VideoMeta", () => {
       const result: SearchResult = {
         videoId: "abc123",
         title: "Test Video",
         channelName: "Test Channel",
         startTime: 12.5,
         matchedText: "안녕하세요",
       };
       expect(result.startTime).toBe(12.5);
       expect(result.matchedText).toBe("안녕하세요");
     });

     it("should define SubtitleChunk shape", () => {
       const chunk: SubtitleChunk = {
         startTime: 0,
         text: "테스트 자막",
       };
       expect(chunk.text).toBe("테스트 자막");
     });
   });
   ```
   - 도메인 모델의 타입 형태(shape)만 검증하는 최소 smoke test
   - 피처 로직이 없으므로 순수 타입 인스턴스화만 테스트

6. 실행 검증:
   ```bash
   cd web && pnpm test
   ```

**QA / Acceptance Criteria**:
```bash
cd web && pnpm vitest run         # exits 0, 3 tests pass
test -f web/vitest.config.ts && echo "PASS: vitest config exists"
test -f web/src/domain/models/subtitle.test.ts && echo "PASS: smoke test exists"
```

---

### Task 9: AGENTS.md 작성 (AI Agent 지침서)

**Priority**: 🔴 Critical
**Depends on**: Task 0-8 (전체 구조 완성 후 작성)
**Estimated effort**: 15분

**Why**: AI agent(Sisyphus, Hephaestus 등)가 이 프로젝트에서 코드를 자율적으로 구현할 때 참조하는 핵심 컨텍스트 문서. 아키텍처 규칙, 코딩 컨벤션, 금지 패턴, 디자인 시스템 제약을 인코딩하여 agent가 일관된 고품질 코드를 생성하도록 보장한다.

**Scope Constraint**: 50-200줄. 컨벤션과 제약만. 피처 구현 디테일은 docs/에 위임.

**Steps**:

1. 프로젝트 루트에 `AGENTS.md` 생성. 아래 섹션 구조를 따른다:

```markdown
# AGENTS.md — kcontext AI Agent Guidelines

## Project Overview
- **Product**: kcontext — 한국어 학습자를 위한 YouTube 자막 기반 문맥 검색 도구
- **Tagline**: Real Korean, Right in Context.
- **Repo Layout**: `web/` (Next.js Frontend) + `cli/` (Python Data Pipeline)
- **Detailed Specs**: See `docs/` directory for system design, architecture, database schema, design system

## Architecture Rules

### Clean Architecture (Frontend — web/src/)
Dependencies flow INWARD only: UI → Application → Domain. NEVER the reverse.

| Layer | Path | Can Import From | Cannot Import From |
|-------|------|-----------------|-------------------|
| Domain | `src/domain/` | Nothing (pure TS types) | Everything else |
| Application | `src/application/` | `domain/` only | `infrastructure/`, `app/`, `components/` |
| Infrastructure | `src/infrastructure/` | `domain/`, `application/` | `app/`, `components/` |
| UI (Components) | `src/components/` | `domain/`, `application/`, `lib/` | `infrastructure/` directly |
| App (Next.js) | `src/app/` | All layers via DI | Direct `infrastructure/` import OK in server components |
| Lib (Utilities) | `src/lib/` | `domain/` only | `infrastructure/`, `app/` |

**CRITICAL**: UI components MUST NOT import from `@supabase/*` directly.
Always go through `application/ports/` interfaces.

### Data Pipeline (CLI — cli/)
- Stateless, pure-function design (ADR 3 from docs/cli-architecture.md)
- Each command: explicit input file → explicit output file
- No implicit folder dependencies between commands

## File Conventions
- **TypeScript files**: `kebab-case.ts` / `kebab-case.tsx`
- **Python files**: `snake_case.py`
- **Type/Interface names**: `PascalCase`
- **Function/variable names**: `camelCase` (TS) / `snake_case` (Python)
- **Component files**: `kebab-case.tsx` with `PascalCase` export
- **Test files**: `*.test.ts` / `*.test.tsx` co-located with source

## Design System Rules (STRICT)
SSoT: `docs/design-system-and-token-guide.md`

### Token Hierarchy (3-tier)
1. **Primitive Tokens** → CSS custom properties in `globals.css` `@theme` block
2. **Semantic Tokens** → CSS custom properties in `:root` block, referencing primitives
3. **Component usage** → Tailwind utilities referencing semantic tokens

### FORBIDDEN
- ❌ Arbitrary pixel values (e.g., `p-[13px]`, `text-[17px]`)
- ❌ Direct primitive token usage in components (use semantic tokens)
- ❌ Light theme implementation (dark-only: `docs/design-system-and-token-guide.md` Section 2)
- ❌ Colors not in the token guide palette
- ❌ Fade animations on subtitle text swap (must be instant, 0ms)
- ❌ Dynamic text color changes for soft focus effect

### Typography
- UI/English: `font-family: var(--font-family-sans)` → Inter
- Subtitle/Korean: `font-family: var(--font-family-kr)` → Pretendard
- Subtitle viewer text: `type-subtitle-chunk` (20px, medium, relaxed line-height)

## Coding Conventions

### TypeScript (web/)
- **Strict mode**: `noUncheckedIndexedAccess` enabled — always check array index results
- **Imports**: Use `import type` for type-only imports (enforced by Biome)
- **Linter**: Biome only. No ESLint.
- **Formatter**: Biome only. No Prettier.
- **Quotes**: Double quotes
- **Trailing commas**: Always

### Python (cli/)
- **Linter/Formatter**: ruff (configured in `cli/pyproject.toml`)
- **Type hints**: Required for all function signatures
- **Quotes**: Double quotes
- **Line length**: 100

## Supabase Integration
- **Server Components**: Use `createSupabaseServerClient()` from `@/infrastructure/supabase/server`
- **Client Components**: Use `createSupabaseBrowserClient()` from `@/infrastructure/supabase/client`
- **NEVER**: Import `@supabase/supabase-js` or `@supabase/ssr` directly in components or app/ files
- **Env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CDN_URL`

## Testing
- **Framework**: Vitest only. No Jest, no testing-library at this stage.
- **Test location**: Co-located with source (`*.test.ts` next to `*.ts`)
- **Run**: `cd web && pnpm test`

## Commands Reference
```bash
# Web (Next.js)
cd web && pnpm dev          # Dev server
cd web && pnpm build        # Production build
cd web && pnpm test         # Run tests
cd web && pnpm lint         # Biome lint
cd web && pnpm lint:fix     # Biome auto-fix

# CLI (Python)
cd cli && uv run kcontext --help    # CLI help
cd cli && uv run ruff check .       # Python lint
cd cli && uv run ruff format .      # Python format
```
```

2. AGENTS.md가 200줄 이하인지 확인. 초과 시 상세 내용을 docs/로 링크.

**QA / Acceptance Criteria**:
```bash
test -f AGENTS.md && echo "PASS: AGENTS.md exists"
LINE_COUNT=$(wc -l < AGENTS.md)
[ "$LINE_COUNT" -ge 50 ] && [ "$LINE_COUNT" -le 250 ] && echo "PASS: line count $LINE_COUNT in range"
# 핵심 섹션 존재 확인:
grep -q "Architecture Rules" AGENTS.md && echo "PASS: architecture section"
grep -q "Design System Rules" AGENTS.md && echo "PASS: design system section"
grep -q "FORBIDDEN" AGENTS.md && echo "PASS: forbidden patterns"
grep -q "Clean Architecture" AGENTS.md && echo "PASS: clean arch rules"
```

---

### Task 10: CI/CD 설정 (GitHub Actions)

**Priority**: 🟢 Medium
**Depends on**: Task 4 (Biome), Task 8 (Vitest), Task 3 (ruff)
**Estimated effort**: 10분

**Why**: PR 시 자동으로 lint/test를 실행하여 코드 품질을 게이트키핑. AI agent가 생성한 코드도 CI 파이프라인을 통과해야만 병합 가능. Vercel은 GitHub 앱을 통해 자동으로 프리뷰 배포하므로, CI에서는 배포를 다루지 않는다.

**Steps**:

1. GitHub Actions 워크플로우 디렉토리 생성:
   ```bash
   mkdir -p .github/workflows
   ```

2. `.github/workflows/ci.yml` 생성:
   ```yaml
   name: CI

   on:
     pull_request:
       branches: [main]
     push:
       branches: [main]

   jobs:
     lint-and-test-web:
       name: "Web: Lint & Test"
       runs-on: ubuntu-latest
       defaults:
         run:
           working-directory: web
       steps:
         - uses: actions/checkout@v4

         - uses: pnpm/action-setup@v4
           with:
             version: 10

         - uses: actions/setup-node@v4
           with:
             node-version: "22"
             cache: "pnpm"
             cache-dependency-path: web/pnpm-lock.yaml

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Biome check
           run: pnpm lint

         - name: TypeScript type check
           run: pnpm tsc --noEmit

         - name: Run tests
           run: pnpm test

         - name: Build
           run: pnpm build

     lint-cli:
       name: "CLI: Lint"
       runs-on: ubuntu-latest
       defaults:
         run:
           working-directory: cli
       steps:
         - uses: actions/checkout@v4

         - uses: astral-sh/setup-uv@v5

         - uses: actions/setup-python@v5
           with:
             python-version: "3.12"

         - name: Install dependencies
           run: uv sync

         - name: Ruff lint
           run: uv run ruff check .

         - name: Ruff format check
           run: uv run ruff format --check .
   ```
   - **Node 22** — CI에서는 LTS 안정 버전 사용 (로컬의 v24는 실험적)
   - **Python 3.12** — CI에서도 안정 버전
   - **두 개의 독립 job** — web과 cli를 병렬 실행 (시간 절약)
   - **pnpm 캐싱** — `actions/setup-node`의 cache 기능 + `pnpm-lock.yaml` 기반
   - **uv 캐싱** — `astral-sh/setup-uv`가 자동 캐싱 제공
   - **배포 없음** — Vercel이 자동 처리. CI는 검증만.

3. PR 시 lint가 실패하면 병합을 차단하려면, GitHub repo settings에서 branch protection rule 설정 필요 (코드 밖 설정이므로 플랜에 노트만 기록):
   > **Note (수동 설정)**: GitHub repo → Settings → Branches → Branch protection rules → `main` → "Require status checks to pass" → `lint-and-test-web`, `lint-cli` 선택

**QA / Acceptance Criteria**:
```bash
test -f .github/workflows/ci.yml && echo "PASS: CI workflow exists"
# YAML 문법 검증 (기본적):
head -1 .github/workflows/ci.yml | grep -q "name:" && echo "PASS: valid YAML header"
# 핵심 job 존재 확인:
grep -q "lint-and-test-web" .github/workflows/ci.yml && echo "PASS: web job defined"
grep -q "lint-cli" .github/workflows/ci.yml && echo "PASS: cli job defined"
# 배포 스텝 없음 확인:
! grep -q "deploy" .github/workflows/ci.yml && echo "PASS: no deploy step"
```

---

### Task 11: 최종 정리 및 커밋

**Priority**: 🟢 Medium
**Depends on**: Task 0-10 (모든 태스크 완료 후)
**Estimated effort**: 5분

**Why**: 모든 스캐폴딩을 하나의 깨끗한 커밋으로 정리하고, .editorconfig으로 IDE 간 일관성을 보장한다.

**Steps**:

1. `.editorconfig` 생성 (프로젝트 루트):
   ```ini
   root = true

   [*]
   indent_style = space
   indent_size = 2
   end_of_line = lf
   charset = utf-8
   trim_trailing_whitespace = true
   insert_final_newline = true

   [*.py]
   indent_size = 4

   [*.md]
   trim_trailing_whitespace = false
   ```

2. Final Verification Wave 실행 (본 플랜의 마지막 섹션 참조) — 모든 검증 명령이 exit 0 통과.

3. 전체 변경사항 커밋:
   ```bash
   git add -A
   git commit -m "chore: initialize project dev environment

   - Next.js (App Router) + TypeScript scaffolding in web/
   - Python CLI pipeline scaffolding in cli/ (uv + Typer)
   - Clean Architecture directory structure (domain/application/infrastructure)
   - Biome linter/formatter + lefthook git hooks
   - 3-tier design token system (Tailwind CSS v4)
   - Supabase client setup (@supabase/ssr, server/browser split)
   - Vitest test framework + smoke test
   - AGENTS.md for AI agent guidelines
   - GitHub Actions CI (lint + test for web and cli)
   - .gitignore, .editorconfig"
   ```

4. (선택) push:
   ```bash
   git push origin main
   ```

**QA / Acceptance Criteria**:
```bash
git log --oneline -1 | grep -q "initialize project dev environment" && echo "PASS: commit created"
git status --porcelain | wc -l | xargs test 0 -eq && echo "PASS: working tree clean"
```

---

<!-- TASKS_END -->

## Final Verification Wave

모든 태스크 완료 후 아래 검증 명령을 순서대로 실행:

```bash
# 1. Git 상태 확인
git status

# 2. Next.js 빌드 검증
cd web && pnpm run build && cd ..

# 3. TypeScript 타입 체크
cd web && pnpm tsc --noEmit && cd ..

# 4. Biome 린트 검증
biome check web/src/

# 5. Vitest 실행
cd web && pnpm vitest run && cd ..

# 6. Python CLI 검증
cd cli && uv run python -c "import typer; print('ok')" && cd ..

# 7. Python 린트 검증
cd cli && uv run ruff check . && cd ..

# 8. lefthook 실행
lefthook run pre-commit

# 9. AGENTS.md 존재 및 크기 확인
test -f AGENTS.md && wc -l AGENTS.md

# 10. CI 워크플로우 존재 확인
test -f .github/workflows/ci.yml && echo "CI config exists"
```

**모든 명령이 exit 0으로 통과해야 플랜 완료.**
