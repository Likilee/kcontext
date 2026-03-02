# Learnings — Task 1+2: Next.js Scaffolding + Clean Architecture

## create-next-app 동작 (2026-03-02)

- `pnpm create next-app web --app --tailwind --src-dir --use-pnpm --typescript --no-eslint --no-import-alias` 실행 시 "Would you like to use React Compiler?" 인터랙티브 프롬프트가 뜸 → `echo "N" |` 파이프로 해결
- 최종 설치 단계에서 `Maximum call stack size exceeded` 에러 발생 (git init 관련) — 하지만 파일은 정상 생성됨. 이미 git repo 안에서 실행했기 때문
- `--no-import-alias` 옵션에도 불구하고 `@/*` paths가 tsconfig.json에 자동 추가됨 (Next.js 16.1.6 기준)
- ESLint는 `--no-eslint` 플래그로 완전히 제외됨

## Next.js 16.1.6 기본 설치 구성

- `globals.css` 기본 내용에 `:root`, `@theme inline`, body 스타일 포함 → 교체 필요
- `layout.tsx`에 Geist 폰트 import 포함 → 교체 필요
- `public/` 내 SVG: next.svg, vercel.svg, file.svg, globe.svg, window.svg

## tsconfig.json 주의사항

- create-next-app이 이미 `"paths": { "@/*": ["./src/*"] }` 추가함
- `noUncheckedIndexedAccess`, `noImplicitOverride`는 별도 추가 필요

## Clean Architecture 구조

- `components/`, `lib/`, `infrastructure/adapters/`는 초기 빈 디렉토리 → `.gitkeep` 필요
- `domain/models/subtitle.ts` → `application/ports/subtitle-repository.ts` 단방향 의존

## 빌드/타입 검증 결과

- `pnpm run build` → ✓ 성공 (Next.js 16.1.6 Turbopack)
- `pnpm tsc --noEmit` → ✓ 에러 없음

## Task 3: Python CLI Pipeline 스캐폴딩 (2026-03-02)

### uv init --package 동작 방식
- `uv init cli --package`는 `cli/src/cli/` 구조를 생성 (패키지명 = 디렉토리명)
- 패키지명이 다를 경우 (`kcontext_cli`) 수동으로 디렉토리 재구성 필요
- 생성된 `cli/src/cli/` 삭제 후 `cli/src/kcontext_cli/` 수동 생성

### uv의 기본 빌드 백엔드
- 최신 uv (0.8.17)는 `uv_build`를 기본 빌드 백엔드로 사용
- hatchling 사용 시 pyproject.toml에서 명시적으로 `build-backend = "hatchling.build"` 설정 필요

### ruff는 별도 dev dependency
- `uv run ruff`는 ruff가 의존성에 없으면 실패
- `uv add --dev ruff`로 dev dependency로 추가 필요

### line-length 100 주의
- f-string 내 여러 변수 사용 시 100자 초과 주의
- 긴 f-string은 여러 echo 호출로 분리하거나 중간 변수 사용

### 성공 패턴
- `[project.scripts]` 엔트리포인트: `kcontext = "kcontext_cli.main:app"`
- `app.command(name="list")(list_cmd.list_videos)` 패턴으로 명령어 등록

## Task: 3-tier Design Token System + Font Install

### pnpm + Node 24 OOM Issue with Large Packages
- `pretendard` is 97MB package (lots of font files)
- pnpm 10.30.3 + Node 24.4.0 crashes with OOM in worker thread during integrity checksum computation
  - Stack trace: `TypedArrayPrototypeJoin` → `OneShotDigest` (crypto hash of large array)
  - This is a known pnpm v10 + Node 24 incompatibility
- **Workaround**: 
  1. Install package via `npm install` in a `/tmp` directory (npm works fine)
  2. Copy files to pnpm virtual store: `node_modules/.pnpm/PACKAGE@VERSION/node_modules/PACKAGE/`
  3. Create top-level symlink: `node_modules/PACKAGE -> .pnpm/.../PACKAGE`
  4. Update `pnpm-lock.yaml` manually with package entries + snapshots
  5. Update `node_modules/.modules.yaml` hoistedDependencies
  6. Use `pnpm install --prefer-offline` to validate without re-running integrity checks

### Tailwind CSS v4 @theme
- `@theme { ... }` block goes inside the CSS file (no `tailwind.config.ts` needed)
- Primitive tokens defined in `@theme`, semantic tokens in `:root`
- `@fontsource-variable/inter` resolves `node_modules/@fontsource-variable/inter/index.css` on bare import

### Font CSS Files
- `pretendard` v1.3.9 does NOT have `.min.css` variants
- The correct file is `dist/web/variable/pretendardvariable-dynamic-subset.css` (no `.min`)
- `@fontsource-variable/inter` bare import resolves to `index.css`

### pnpm Lockfile Manual Edit
- Use Python to edit YAML files to avoid `\n` literal escaping issues with the Edit tool
- lockfile entries need both `packages:` section AND `snapshots:` section

## Vitest Setup (2026-03-02)

### pnpm OOM Issue
- `pnpm add` with `vitest` crashes with OOM in a worker thread (Node 24 + pnpm 10.30.3 incompatibility)
- The crash is in `TypedArrayPrototypeJoin` → `Hash::OneShotDigest` in pnpm's lockfile computation worker
- `NODE_OPTIONS="--max-old-space-size=8192"` does NOT fix this (OOM in worker thread, not main thread)
- **Workaround**: Use `bun add -d vitest @vitejs/plugin-react jsdom` followed by `bun install`
- bun deletes `pnpm-lock.yaml` and creates `bun.lock`, but pnpm can still run `vitest run` via installed binaries

### Vitest Config
- `vitest.config.ts` at web root with `globals: true`, `environment: "jsdom"`, `@vitejs/plugin-react` plugin
- `tsconfig.json` needs `"types": ["vitest/globals"]` for globals type support
- Package runner: `NODE_OPTIONS="--max-old-space-size=8192" pnpm vitest run` works correctly
- 3 tests pass in ~400ms

### Biome Compliance
- Test files must use `import type` for interface-only imports (Biome `useImportType: "error"` rule)
- `globals: true` means `describe`, `it`, `expect` don't need explicit imports

## Task: Supabase Client Setup (2026-03-02)

### pnpm OOM - Critical Pattern (Node 24.4.0 + pnpm 10.30.3)
- `pnpm add @supabase/supabase-js @supabase/ssr` crashes with same OOM in worker thread
- The crash happens even when the store is empty/pruned
- The OOM is NOT fixed by `NODE_OPTIONS="--max-old-space-size=8192"` (worker thread has its own heap)
- `PNPM_WORKER_THREADS=false` does NOT help either
- **Root cause**: pnpm's cafs (content-addressable filesystem) worker crashes at `Hash::OneShotDigest` → `TypedArrayPrototypeJoin`
- **Workaround that works**:
  1. `pnpm store prune` first (clear old corrupted cache)
  2. Delete `node_modules` and `pnpm-lock.yaml`
  3. Run `NODE_OPTIONS=...  pnpm install --store-dir /tmp/pnpm-fresh-store` → downloads to .pnpm virtual store, but crashes before creating top-level symlinks
  4. Fall back to `npm install --legacy-peer-deps` which works perfectly
  5. npm installs flat into node_modules (no symlinks) — TypeScript, next, react all resolve correctly

### npm as pnpm fallback
- `npm install` works when pnpm crashes with OOM during package download/hashing
- After npm install, `pnpm tsc --noEmit` and `pnpm exec tsc --noEmit` both work (pnpm finds tsc via node_modules/.bin)
- `pnpm tsc --noEmit` exits 0 even without a pnpm-lock.yaml (pnpm just runs the binary)

### @supabase/ssr TypeScript Gotcha
- `setAll(cookiesToSet)` parameter needs explicit type annotation with `strict: true`
- Type: `{ name: string; value: string; options: CookieOptions }[]`
- Must import `CookieOptions` from `@supabase/ssr`: `import { type CookieOptions, createServerClient } from "@supabase/ssr"`

### @supabase/ssr version
- Latest stable: `@supabase/ssr@0.8.0` (but task template used `0.5.2` - npm installs latest)
- `@supabase/supabase-js@2.98.0` (latest)

### File locations
- `web/src/infrastructure/supabase/server.ts` - async server client with cookies()
- `web/src/infrastructure/supabase/client.ts` - browser client
- `web/src/infrastructure/supabase/index.ts` - barrel export
- `web/src/lib/env.ts` - getEnvVar() utility
- `.env.local.example` at project root (NOT in web/)
