# 시스템 설계서

## 1. 인프라 및 핵심 기술 스택 (Zero-Maintenance Architecture)

- **프론트엔드 호스팅:** `Next.js` (또는 React) + `Vercel`
- **백엔드 / DB / 스토리지:** `Supabase` (BaaS - PostgreSQL & Object Storage)
- **비디오 플레이어:** `YouTube IFrame Player API`
- **데이터 파이프라인:** 로컬 환경에서 구동되는 독립형(Standalone) CLI 앱 (Python `Typer` 또는 `Click` 라이브러리 등 활용)

## 2. 투트랙(Two-Track) 데이터 저장소 및 추상화 (Decoupled)

데이터의 용도를 분리하고, DB와 Storage 간의 의존성을 끊어내어 향후 인프라 마이그레이션(예: Cloudflare R2로 이동) 시 DB 대공사를 방지한다.

- **Track A: 검색 인덱스 DB (`search_index` 테이블)**
    - **역할:** 초고속 문장 검색 매칭 및 해당 구간의 시작 시간(`start_time`) 반환.
    - **저장 데이터:** `video_id` (식별자), `start_time`, `search_text`
    - **💡 URL 하드코딩 제거:** DB에 Storage URL 등 인프라 종속적인 데이터를 절대 저장하지 않는다.
- **Track B: 재생용 전체 자막 (Supabase Storage / CDN)**
    - **1:1 매핑 규칙:** 영상과 자막 JSON 파일은 1:1 관계이므로, 파일명을 무조건 **`[video_id].json`*으로 고정하여 업로드한다.
- **프론트엔드 Repository 패턴:**
    - 프론트엔드에 `SubtitleRepository`를 구현하여, DB 조회로 얻은 `video_id`를 기반으로 `https://[CDN_BASE_URL]/subtitles/{video_id}.json` 형태로 URL을 동적으로 조합해 Fetching 한다.

## 3. 로컬 기반 Standalone CLI 파이프라인 (Data Pipeline)

클라우드 서버 컴퓨팅 비용을 '0원'으로 만들기 위해, 데이터 수집 ➔ 전처리 ➔ DB/Storage 업로드 전 과정을 개발자 로컬 PC에서 실행되는 CLI 도구로 구축한다.

- **수집 원칙:** 퀄리티 컨트롤을 위해 **수동 자막(Manual CC)이 존재하는 영상만** 필터링하여 수집한다.
- **CLI 인터페이스 디자인:** GitHub CLI(`gh`)처럼 직관적이고 모듈화된 명령어 구조를 가진다.
    - `$ cli fetch <video_id>` : 수동 자막 확인 후 자막 및 메타데이터 원본 다운로드.
    - `$ cli build <video_id>` : 로컬 자막을 Track A용(병합 텍스트)과 Track B용(원본 JSON) 포맷으로 각각 빌드.
    - `$ cli push <video_id>` : 빌드된 데이터를 Supabase DB와 Storage로 일괄 전송.

## 4. 초고속 한국어 검색 엔진 (Search Engine)

- Supabase PostgreSQL 내부에 공식 지원되는 **`PGroonga` 확장 기능(Extension)** 사용.
- 추가 인프라 비용 없이 N-gram 방식을 통해 띄어쓰기/오탈자에 강한 초고속 한국어 문장(Phrase) 검색 제공.

## 5. 프론트엔드 동기화 로직 (Continuous Sync)

- **전체 데이터 로드:** 화면 진입 시 Repository를 통해 `[video_id].json`을 단번에 Fetching하여 프론트엔드 메모리(State)에 보관.
- **초고속 시간 추적:** `requestAnimationFrame`을 사용하여 60fps로 현재 재생 시간(`currentTime`) 추적.
- **이진 탐색 (Binary Search):** 유저가 영상 타임라인을 자유롭게 탐색(Seek)할 경우, 전체 자막 배열 안에서 현재 시간에 맞는 자막 인덱스를 이진 탐색으로 즉시 찾아내어 렌더링 부하 최소화.

## 6. UI/UX 디자인 원칙 (Native YouTube Sync & Explicit Action)

YouGlish의 본질을 완벽히 살리며, 학습자의 인지 부조화를 막고 직관적인 통제권을 제공한다.

- **네이티브 청크 뷰어 (Exact Chunk Viewer):**
    - 자막을 임의로 문단으로 묶지 않는다. 크리에이터가 의도한 호흡을 100% 존중하여, **실제 유튜브 화면에서 자막(CC)을 켰을 때 나오는 것과 정확히 동일한 청크 단위, 동일한 시점**에 화면 하단 자막을 1:1로 표시하고 교체한다.
- **단일 정적 하이라이트 (Static Highlight):**
    - 소프트 포커스(글자색 변경) 같은 부가적 시각 효과는 전면 배제한다.
    - 현재 노출 중인 자막 청크 내부에 **'사용자가 검색한 키워드'가 포함되어 있을 때만 해당 텍스트에 노란색 배경(형광펜) 하이라이트**를 직관적으로 적용한다.
- **명시적 다시 듣기 (Replay) 버튼:**
    - 유저의 시청 흐름을 강제로 뺏는 오토 루프(Auto-Loop) 기능은 구현하지 않는다.
    - 대신, 플레이어 컨트롤러에 명시적인 **[다시 듣기 ↺] 버튼**을 두어, 유저가 원할 때 언제든 검색된 자막의 시작 시점(`start_time`)으로 돌아갈 수 있게 심플하게 지원한다.