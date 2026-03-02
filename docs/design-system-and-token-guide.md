# kcontext 디자인 시스템 및 토큰 가이드 (Design System & Token Guide)

**Document Status:** Approved (Final)
**Product Name:** kcontext

본 문서는 kcontext의 브랜드 철학을 시각적으로 구현하고, 프론트엔드 시스템의 확장성과 반응형 레이아웃 유지보수성을 극대화하기 위해 디자인 토큰(Design Tokens) 기반의 시스템 위계를 정의합니다. 모든 UI 요소의 스타일링은 임의의 수치 입력을 원천 차단하고 아래 정의된 3단계 토큰의 흐름만을 엄격하게 따릅니다.

## 1. Token Hierarchy (토큰 위계 정의)

본 시스템은 결합도(Coupling)를 낮추고 일관성을 유지하기 위해 3단계의 분리 구조를 가집니다.

1. **Primitive Tokens (원시 계층)**: 절대적인 시각적 수치(HEX 색상값, 픽셀, 폰트 패밀리). 개발 시 UI 컴포넌트 코드 레벨에서 이 값들을 직접 참조하는 것을 엄격히 금지합니다.
2. **Semantic Tokens (의미론적 계층)**: 원시 토큰을 참조하여 UI 요소의 '역할(Role)'과 '맥락(Context)'을 부여한 토큰. 테마(Dark/Light) 변경이나 반응형 브레이크포인트(Breakpoint) 적용 시 이 계층의 매핑만 전환됩니다.
3. **Component Tokens (컴포넌트 조립 규칙)**: 의미론적 토큰을 조합하여 특정 UI 컴포넌트의 최종 형태와 내부 규칙을 조립(Composition)하는 명세입니다.

---

## 2. Level 1: Primitive Tokens (원시 계층)

어학 영상 시청 시 눈의 피로도를 최소화하고, 검색어 하이라이트에 시선을 완벽히 집중시키기 위해 다크 테마(Dark Theme)를 단일 기준으로 설계합니다.

### 2.1. Color Palette (색상 원시값)

- color-gray-000: #FFFFFF
- color-gray-050: #F9FAFB
- color-gray-100: #F3F4F6
- color-gray-400: #9CA3AF
- color-gray-500: #6B7280
- color-gray-700: #374151
- color-gray-800: #1F2937
- color-gray-900: #111827
- color-gray-1000: #000000
- color-yellow-400: #FACC15
- color-yellow-500: #EAB308
- color-blue-600: #2563EB

### 2.2. Typography Scale (타이포그래피 원시값)

- font-family-sans: 'Inter', sans-serif
- font-family-kr: 'Pretendard', sans-serif
- font-weight-regular: 400
- font-weight-medium: 500
- font-weight-bold: 700
- font-size-13: 13px
- font-size-16: 16px
- font-size-18: 18px
- font-size-20: 20px
- font-size-28: 28px
- line-height-tight: 1.4
- line-height-relaxed: 1.5

### 2.3. Spacing & Radius Scale (공간 원시값 - 4px Grid)

- space-04: 4px
- space-08: 8px
- space-12: 12px
- space-16: 16px
- space-24: 24px
- space-32: 32px
- space-48: 48px
- radius-04: 4px
- radius-08: 8px
- radius-pill: 9999px

---

## 3. Level 2: Semantic Tokens (의미론적 계층)

### 3.1. Color Semantics (색상 의미론)

**Background (배경: 깊이와 계층 표현)**

- bg-base: color-gray-900 (앱 최하단 캔버스 배경)
- bg-surface: color-gray-800 (검색창, 카드 등 한 층 떠오른 표면)
- bg-surface-hover: color-gray-700 (표면 영역 상호작용 피드백)

**Text & Icon (텍스트 및 아이콘)**

- text-primary: color-gray-050 (본문, 자막, 주요 제목)
- text-secondary: color-gray-400 (부가 설명, 채널명, 타임스탬프)
- text-disabled: color-gray-500 (비활성화 상태, 플레이스홀더)
- text-inverse: color-gray-1000 (밝은 하이라이트 배경 위의 강제 흑백 반전 텍스트)

**Border (테두리 및 구분선)**

- border-subtle: color-gray-800 (섹션 간 부드러운 구분선)
- border-default: color-gray-700 (카드, 버튼 기본 테두리)
- border-focus: color-yellow-500 (입력 활성화 상태의 외곽선)

**Brand & Action (브랜드 및 상호작용)**

- brand-highlight: color-yellow-400 (검색어 정적 하이라이트 배경)
- action-primary: color-yellow-500 (핵심 CTA 버튼 배경)
- action-link: color-blue-600 (텍스트 링크)

### 3.2. Typography Semantics (타이포그래피 의미론)

- type-hero: font-family-kr / font-size-28 / font-weight-bold / line-height-tight (메인 히어로 카피)
- type-subtitle-chunk: font-family-kr / font-size-20 / font-weight-medium / line-height-relaxed (네이티브 자막 뷰어 전용. 주변 시야 인지용으로 스케일업)
- type-heading: font-family-kr / font-size-18 / font-weight-bold / line-height-tight (섹션 제목, 모달 타이틀)
- type-body: font-family-sans / font-size-16 / font-weight-regular / line-height-relaxed (일반 UI 텍스트, 검색창)
- type-caption: font-family-sans / font-size-13 / font-weight-regular / line-height-tight (메타데이터)

### 3.3. Spacing Semantics (여백 의미론)

반응형 레이아웃 시 원시 값 매핑만 브레이크포인트에 따라 유동적으로 변경됩니다.

**Layout Spacing (화면 및 섹션 여백)**

- space-layout-screen: space-16 (모바일 기준 화면 좌우 안전 여백. 데스크탑 브레이크포인트에서 space-24 확장)
- space-layout-section: space-48 (독립된 콘텐츠 블록 간의 수직 간격)

**Container Inset (컴포넌트 내부 여백)**

- space-inset-base: space-16 (카드, 모달 등 정보 블록의 사방 기본 여백)
- space-inset-squish: X축 space-16, Y축 space-12 (검색창, 기본 버튼 등 좌우가 넓은 상호작용 요소의 여백)

**Item & Inline Gap (요소 간 간격)**

- space-gap-group: space-24 (영상 플레이어와 자막 뷰어 등 연관된 메인 묶음 간 간격)
- space-gap-item: space-08 (리스트 내 카드 사이, 추천 검색어 칩 간 나열 간격)
- space-gap-micro: space-04 (버튼 텍스트와 아이콘 사이, 정적 하이라이트 내부 여백 등 강하게 결합되는 최소 간격)

---

## 4. Level 3: Component Token Mapping (컴포넌트 조립 규칙)

하드코딩된 픽셀 수치를 배제하고 오직 Semantic 토큰만을 조합하여 UI를 구성합니다.

### 4.1. Global Search Bar (메인 검색창)

- Container: bg-surface + radius-pill + 내부 패딩(space-inset-squish)
- Inner Layout: 아이콘과 텍스트 입력부 사이 간격(space-gap-micro)
- Text Input: type-body + text-primary
- Placeholder: type-body + text-disabled
- State (Focus): border-focus 토큰을 외곽선(Ring)으로 1px 적용.

### 4.2. Native Chunk Viewer (자막 뷰어 패널)

- Layout Rule: 플레이어 하단에 부착. 상단 플레이어와의 세로 간격은 space-gap-group 확보.
- Base Text: type-subtitle-chunk + text-primary (어절 단위 줄바꿈 word-break: keep-all 강제)
- Static Highlight (검색어 매칭 텍스트):
    - 래퍼(Wrapper): brand-highlight 배경색 + radius-04 + 내부 패딩(X축: space-gap-micro, Y축: 0)
    - 텍스트: text-inverse (완전한 검은색으로 명도 대비 강제)

### 4.3. My Bookmarks Card (단어장 스냅샷 카드)

- Screen Layout: 리스트 래퍼(Wrapper) 좌우에 space-layout-screen 여백 적용.
- Container: bg-surface + radius-08 + 사방 패딩(space-inset-base)
- List Layout: 카드와 카드 사이의 수직 나열 간격(space-gap-item)

### 4.4. Primary CTA Button (핵심 액션 버튼)

- Container: action-primary + radius-08 + 내부 패딩(space-inset-squish 기반 스케일업)
- Text: type-body + font-weight-bold + text-inverse

### 4.5. Player Controls (어학 컨트롤러)

- Style: 시각적 간섭을 줄이기 위해 선형(Outline) 아이콘 사용.
- Color: 기본 text-secondary, 호버/활성 시 text-primary.
- Layout: 버튼 간 나열 간격(space-gap-item).
- Replay Button: 타 버튼 대비 1.2배 크기(Scale) 적용 및 중앙 정렬.
- Touch Target: 모바일 환경을 고려하여 모든 컨트롤 버튼 주변으로 최소 48px * 48px의 투명 터치 영역(Hit Area) 강제 확보.

---

## 5. Motion & Interaction Tokens (모션 및 인터랙션)

시각적 인지 부하(Cognitive Load)를 줄이기 위해 화면 내 애니메이션은 철저히 통제됩니다.

- motion-duration-instant (0ms): 자막 텍스트 교체 시 적용. 완벽한 싱크를 신뢰하게 만들기 위해 페이드인/아웃을 절대 금지하고 즉각적(Instant)으로 텍스트를 스왑(Swap) 처리합니다.
- motion-duration-fast (100ms): 버튼 터치 다운 시의 물리적 스케일 축소(Scale: 0.96) 피드백. 햅틱 반응을 시각적으로 대체합니다.
- motion-duration-base (200ms): 모달 팝업 진입, 토스트 알림 등 상태 변화를 부드럽게 안내할 때만 제한적으로 사용합니다.