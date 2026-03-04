# 프론트엔드 클린 아키텍처 (2026-03 업데이트)

## 1. 의존성 원칙

의존성은 항상 내부로 향합니다.

- UI(`web/src/components`, `web/src/app`) -> Application(`web/src/application`) -> Domain(`web/src/domain`)
- Infrastructure(`web/src/infrastructure`)는 Application Port를 구현합니다.
- UI는 Supabase SDK를 직접 import하지 않습니다.

## 2. App Router 엔트리 분리

이번 UI 이식에서 화면 엔트리를 아래처럼 분리합니다.

- Home: `web/src/app/page.tsx`
- Search/Player: `web/src/app/search/page.tsx`

`/`에서 검색을 실행하면 `/search?q=`로 이동하며, 검색/재생/자막 동기화는 `/search`에서만 처리합니다.

## 3. 계층 책임

### Domain

- `SearchResult`, `SubtitleChunk` 등 핵심 타입 정의.
- 외부 라이브러리 의존성 없음.

### Application

- `useSearch` 훅으로 검색 상태/선택 상태를 관리.
- UI는 훅이 제공하는 `results`, `selectedResult`, `search()`를 사용.

### Infrastructure

- `SupabaseSubtitleRepository`가 `SubtitleRepository` 포트를 구현.
- RPC(`search_subtitles`)와 CDN transcript fetch를 담당.
- snake_case 응답을 camelCase 도메인 모델로 변환.

### UI/App

- `TopNavigation`, `SearchBar`, `PlayerControls` 등 프레젠테이션/입력 이벤트 처리.
- `search/page.tsx`에서 키보드 인터랙션과 플레이어 동기화 흐름을 조합.

## 4. shadcn UI 적용 기준

이번 이식에서는 기존 ad-hoc 버튼/입력 구현 대신 `components/ui` 계층을 기준으로 재구성합니다.

- `ui/button.tsx`
- `ui/input.tsx`
- `ui/card.tsx`
- `ui/utils.ts` (`cn` helper)

모든 화면 컴포넌트는 이 공통 UI 블록을 조합해 스타일 일관성을 유지합니다.

## 5. 현재 구현 파일 참조

- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/app/page.tsx`
- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/app/search/page.tsx`
- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/application/hooks/use-search.ts`
- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/application/ports/subtitle-repository.ts`
- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/infrastructure/adapters/supabase-subtitle-repository.ts`
- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/components/ui/button.tsx`
- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/components/ui/input.tsx`
- `/Users/kihoon/Documents/Project/dozboon/products/kcontext/web/src/components/ui/card.tsx`
