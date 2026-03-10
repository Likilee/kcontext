# YouTube 메타데이터 분석 및 활용 계획

## 1. 목적

tubelang에서 YouTube 영상 메타데이터를 활용해 아래를 달성한다.

- 한국어 학습에 적합한 영상 선별 정확도 향상
- 검색/탐색 UX를 위한 필터 조건 제공
- 수집 파이프라인의 자동 품질 게이트(quality gate) 도입

핵심 질문은 다음과 같다.

- 메타데이터만으로 `한국 원어민 영상 + 수동 한국어 자막 + 양질의 학습 콘텐츠`를 어느 정도 판별할 수 있는가?
- 어떤 필드를 DB에 저장하면 실제 필터링 가치가 높은가?

## 2. 분석 범위

본 문서는 YouTube 메타데이터 중 아래 필드 중심으로 설계한다.

- 분류/검색: `categories`, `tags`, `language`, `description`
- 자막 품질: `subtitles`, `automatic_captions`
- 참여/기초 품질: `view_count`, `like_count`, `comment_count`, `duration`, `availability`, `age_limit`, `is_live`

샘플 기준 영상(세바시): `jTx_bRXQ-Bw`

- `categories`: `["Education"]`
- `tags`: 12개 (`세바시 강연`, `인문학`, `건강` 등)
- `language`: `ko`
- `description`: 972자, 자막 크레딧 문구 포함
- `subtitles`: `ko`, `zh` 존재

## 3. 필드 의미와 신뢰도

### 3.1 `categories`

- 의미: YouTube의 대분류 카테고리
- 장점: 빠른 1차 분류 필터 가능
- 한계: 매우 거친 분류(정밀 주제 분류에는 부족)
- 권장 용도: 상단 탐색 필터, quality_score 보조 신호

### 3.2 `tags`

- 의미: 업로더가 직접 입력한 키워드 배열
- 장점: 주제성 보완(예: 건강, 심리, 인문학)
- 한계: 누락/마케팅성 키워드/일관성 부족
- 권장 용도: 검색 가중치 보조, 토픽 클러스터링 보조

### 3.3 `language`

- 의미: 영상 기본 언어(또는 추정 언어 코드)
- 장점: 한국어 우선 선별에 유용
- 한계: null/오분류 가능, 다국어 영상에서 부정확할 수 있음
- 권장 용도: 1차 게이트 조건 + 다른 신호와 결합

### 3.4 `description`

- 의미: 크리에이터 자유 서술 영역
- 장점: 자막 출처, 번역/검수, 콘텐츠 맥락 정보 포함 가능
- 한계: 홍보 링크/광고/잡음 많음
- 권장 용도: 키워드 기반 규칙(`자막`, `번역`, `검수`) 및 길이/품질 신호

## 4. 활용 전략

### 4.1 수집 게이트 (ingest gate)

아래 조건을 기본 게이트로 사용한다.

- `availability == "public"`
- `age_limit == 0`
- (`language == "ko"`) 또는 (`subtitles`에 `ko` 존재)
- 수동 자막 우선: `subtitles.ko` 존재 시 우선 수집

참고: `automatic_captions.ko`만 존재하는 경우는 자동 자막 전용 후보로 분리 저장하고 우선순위를 낮춘다.

### 4.2 필터링 기준 (UI/API)

영상 탐색 필터로 아래를 제공한다.

- 언어: `language` (`ko`, `en` 등)
- 카테고리: `categories`
- 토픽 태그: `tags`
- 자막 유형: `manual_ko`, `auto_ko_only`, `multilingual_subtitles`
- 설명문 기반: `has_subtitle_credit`, `description_length_bucket`
- 길이: `duration` 구간 (`3~10분`, `10~20분`, `20분+`)

### 4.3 quality_score v1 (0~100)

### 가점

- `+15`: `language == "ko"`
- `+10`: `subtitles`에 `ko` 존재(수동 한국어 자막)
- `+4`: `automatic_captions`에만 `ko` 존재
- `+5`: 설명문 한글 비율 >= 60%
- `+8`: `category`가 학습 친화(`Education`, `Science & Technology`, `News & Politics`)
- `+5`: `tags` 개수 5~25
- `+5`: `description` 길이 300~2500
- `+7`: 설명문 자막 크레딧 키워드 포함(`한국어 자막`, `번역`, `검수`, `subtitle`)
- `+3`: 조회수 >= 10,000
- `+2`: 좋아요율(좋아요/조회수) 0.5%~10%
- `+10`: 채널 화이트리스트 포함

### 감점

- `-15`: `is_live == true` 또는 `was_live == true`
- `-10`: `duration < 180` (3분 미만)
- `-8`: 제목 저품질 패턴 포함(`shorts`, `하이라이트`, `reaction`, `클립`)
- `-10`: `availability != "public"`

### Hard Gate

- `language != "ko"` 이고 수동 한국어 자막도 없으면 제외
- `age_limit > 0` 제외

### 운영 구간

- `85~100`: 우선 수집
- `70~84`: 수집
- `55~69`: 보류(수동 검토)
- `<55`: 제외

## 5. 저장 스키마 제안

기존 영상 메타 테이블(또는 신규 `video_metadata`)에 아래 컬럼을 권장한다.

- 식별: `video_id`, `channel_id`, `channel_name`, `title`
- 분류/검색: `language`, `categories`(text[]), `tags`(text[]), `description`
- 자막: `manual_subtitle_langs`(text[]), `auto_caption_langs`(text[]), `has_manual_ko_subtitle`(bool), `has_auto_ko_caption`(bool)
- 참여/상태: `view_count`, `like_count`, `comment_count`, `duration_sec`, `availability`, `age_limit`, `is_live`
- 품질: `quality_score`(int), `quality_score_version`(text), `quality_signals`(jsonb)

`quality_signals` 예시 키

- `matched_rules`: 적용된 규칙 ID 배열
- `penalties`: 감점 규칙 ID 배열
- `reasons`: 사람이 읽을 수 있는 근거 메시지

## 6. 파이프라인 반영 포인트 (CLI)

CLI 아키텍처(입력 파일 -> 출력 파일의 순수 함수 체인) 원칙을 유지한다.

- `fetch`: 원본 메타데이터 + 자막 정보 다운로드
- `build`: 정규화된 메타데이터 JSON 생성 + `quality_score` 계산
- `push`: DB 업서트 + 품질 점수/신호 저장

출력 파일 예시

- `data/raw/<video_id>.metadata.json`
- `data/processed/<video_id>.metadata.normalized.json`
- `data/processed/<video_id>.quality.json`

## 7. 한계와 보완 계획

- 메타데이터만으로 `원어민 발화 품질`을 100% 판별할 수 없음
- `tags`, `language`, `description`은 채널 운영 방식에 따라 편차가 큼
- v2에서는 자막 본문 기반 지표를 추가 검토한다.
- 발화 속도 분포(wpm)
- 문장 길이/난이도 지표
- 불용 구간(음악/침묵) 비율

## 8. 단계별 실행안

- Phase 1: v1 규칙으로 점수 계산 및 DB 저장
- Phase 2: 필터 UI 연결(언어/카테고리/자막 유형/점수)
- Phase 3: 운영 데이터 기반 가중치 재보정
- Phase 4: 자막 본문 품질 지표 결합(v2)
