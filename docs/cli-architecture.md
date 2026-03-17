- **ADR 1: Zero Cloud Computing Cost**
    - 데이터 파싱, 포맷 변환 등 연산이 필요한 모든 과정(ETL)은 개발자의 로컬 환경으로 오프로딩한다.
- **ADR 2: Direct DB Connection & Bulk Insert**
    - Supabase REST API 병목을 우회하기 위해, 가공된 CSV 파일을 PostgreSQL TCP 포트(6543)로 직접 연결하여 네이티브 COPY 명령어로 대량 적재한다.
- **ADR 3: Explicit I/O & Stateless Design**
    - 명령어 간 암묵적 폴더 의존성을 배제하고, 명시적인 입력 파일을 받아 명시적인 출력 파일을 생성하는 순수 함수 형태로 설계하여 파이프라이닝을 보장한다.
- **ADR 4: Quality Control First**
    - 자동 생성 자막(ASR) 배제. 수동 자막(Manual CC)만 수집하며, 검색 누락 방지를 위한 텍스트 강제 병합(Sliding Window)을 폐기하고 원본 청크를 1:1 보존한다.
- **ADR 5: Atomic Replace Strategy**
    - 가변적인 타임스탬프 수정으로 인한 유령 청크(Ghost Chunks) 발생을 방지하기 위해, 데이터 갱신 시 UPSERT를 배제하고 단일 트랜잭션 내에서 기존 자막 전체 DELETE 후 COPY 덮어쓰기(전면 교체)를 채택한다.

## 2. Tech Stack

- CLI Framework: Typer
- Target Extractor: yt-dlp
- Data Extractor: youtube-transcript-api
- Database Adapter: psycopg2-binary
- Storage Adapter: supabase-py

## 3. CLI Interface Contract

### 3.1 list (Extract Source)

채널 또는 재생목록 URL에서 대량의 영상 ID를 추출하여 표준 출력(stdout)으로 반환.

- Signature: `cli list <url> [--limit LIMIT] [--youtube-proxy-url URL]`
- Output: 개행 문자(`\\n`)로 구분된 비디오 ID 목록 (진행 상황 및 에러는 stderr 출력)

### 3.2 fetch (Extract Data)

단일 영상의 메타데이터와 수동 자막 원본을 추출하여 단일 Raw JSON 파일로 저장.

- Signature: `cli fetch <video_id> -o <output_raw_json_path> --default-audio-language-code <code> [--youtube-proxy-url URL]`
- 방어 로직: 수동 한국어 자막이 없을 경우 에러 출력 후 스킵.

### 3.3 fetch-list (Batch Extract Data)

영상 ID 목록 파일을 입력받아 각 ID에 대한 Raw JSON을 일괄 생성한다.

- Signature: `cli fetch-list <video_ids_file> -d <output_dir> --default-audio-language-code <code> [--strict] [--youtube-proxy-url URL]`
- 동작 방식: 내부적으로 `fetch`를 반복 호출하며 `--youtube-proxy-url`을 그대로 전달한다.

### 3.4 build (Transform)

Raw JSON을 입력받아 Track A(DB)와 Track B(Storage) 인프라 스키마에 맞게 3개의 아티팩트로 분해 및 변환.

- Signature: `cli build <input_raw_json_path> -d <output_directory_path> --default-audio-language-code <code>`
- Output Artifacts:
    1. `{video_id}_storage.json` (Track B: 전체 자막 CDN 서빙용)
    2. `{video_id}_video.csv` (Track A: 비디오 메타데이터 UPSERT용. `audio_language_code` 포함)
    3. `{video_id}_subtitle.csv` (Track A: 자막 검색 인덱스 원자적 교체용. `()`, `[]`, `（）`, `［］` 문맥 메모를 제거한 검색용 텍스트만 포함하며, 정제 후 빈 문자열이 된 청크는 제외)

### 3.5 push (Load)

빌드된 3개의 아티팩트 파일을 명시적으로 주입받아 대상 인프라로 전송.

- Signature: `cli push -s <storage_json_path> -vc <video_csv_path> -sc <subtitle_csv_path> --default-audio-language-code <code>`
- 동작 방식: 비디오 메타데이터는 UPSERT로 갱신하고, 자막 인덱스는 트랜잭션 기반 Atomic Replace(DELETE 후 COPY) 방식으로 전면 교체.

## 4. YouTube Proxy Policy

- Env var: `KCONTEXT_YOUTUBE_PROXY_URL`
- Env var: `KCONTEXT_YOUTUBE_PROXY_PROVIDER=generic|decodo`
- Decodo env vars: `DECODO_PROXY_SCHEME`, `DECODO_PROXY_HOST`, `DECODO_PROXY_PORT`, `DECODO_PROXY_USERNAME`, `DECODO_PROXY_PASSWORD`
- CLI option: `--youtube-proxy-url`
- 우선순위: CLI option > env var > `decodo` provider env 조합 > 미사용
- 지원 스킴: `http://`, `https://` (torproxy 권장: `http://127.0.0.1:8118`)
- Decodo provider는 generic URL이 없을 때 env 조합으로 `http://user:pass@host:port`를 생성한다.
- 실패 정책: 프록시 사용 중 차단/연결 실패 시 즉시 종료(`exit 1`), direct 연결로 자동 폴백하지 않음

## 5. End-to-End Orchestration (Shell Script)

```bash
#!/bin/bash
TARGET_URL="https://www.youtube.com/@sebasi15M"
WORKSPACE="/tmp/kcontext_pipeline"
mkdir -p "$WORKSPACE"

cli list "$TARGET_URL" --limit 50 | while read ID; do
  cli fetch "$ID" -o "$WORKSPACE/${ID}_raw.json" --default-audio-language-code ko
  if [ ! -f "$WORKSPACE/${ID}_raw.json" ]; then continue; fi

  cli build "$WORKSPACE/${ID}_raw.json" -d "$WORKSPACE" --default-audio-language-code ko

  cli push \
    -s "$WORKSPACE/${ID}_storage.json" \
    -vc "$WORKSPACE/${ID}_video.csv" \
    -sc "$WORKSPACE/${ID}_subtitle.csv" \
    --default-audio-language-code ko
done

rm -rf "$WORKSPACE"
```
