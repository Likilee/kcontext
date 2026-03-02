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

**ENFORCED BY**: `@softarc/sheriff-core` — dependency rules are lint-checked via `pnpm lint:arch`.
Violations block commits (lefthook) and CI.

### Barrel Files (BANNED)
- ❌ No `index.ts` re-export files — enforced by Biome `noBarrelFile: error`
- Always import from the specific file: `@/infrastructure/supabase/server`, not `@/infrastructure/supabase`

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
