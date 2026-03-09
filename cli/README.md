# kcontext CLI

YouTube 자막 데이터를 `list -> fetch -> build -> push` 파이프라인으로 적재하는 CLI입니다.

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- `yt-dlp`
- Docker (프록시 우회 필요 시)
- 로컬 또는 원격 Supabase/PostgreSQL 접속 정보

## Setup

```bash
cd cli
uv sync
cp -n .env.example .env
```

`cli/.env`에서 최소 아래 값을 확인하세요.

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- (옵션) `KCONTEXT_YOUTUBE_PROXY_URL`

## Tor Proxy (docker compose)

`cli/docker-compose.proxy.yml`로 torproxy를 실행할 수 있습니다.

```bash
cd cli
./scripts/proxy-up.sh
./scripts/proxy-check.sh
```

중지:

```bash
./scripts/proxy-down.sh
```

기본 프록시 URL은 `http://127.0.0.1:8118` 입니다.

```bash
export KCONTEXT_YOUTUBE_PROXY_URL=http://127.0.0.1:8118
```

## CLI Commands

```bash
# channel/playlist에서 video ID 추출
uv run kcontext list "https://www.youtube.com/@sebasi15/videos" --limit 50

# 프록시 사용
uv run kcontext list "https://www.youtube.com/@sebasi15/videos" \
  --limit 50 \
  --youtube-proxy-url http://127.0.0.1:8118

# 수동 한국어 자막 영상만 추출
uv run kcontext list "https://www.youtube.com/@sebasi15/videos" \
  --manual-ko-only \
  --limit 50 \
  --probe-max-candidates 500

# 단일 fetch
uv run kcontext fetch "VIDEO_ID" -o /tmp/VIDEO_ID_raw.json

# 일괄 fetch
uv run kcontext fetch-list /tmp/video_ids.txt -d /tmp/raw

# build
uv run kcontext build /tmp/VIDEO_ID_raw.json -d /tmp/build

# push
uv run kcontext push \
  -s /tmp/build/VIDEO_ID_storage.json \
  -vc /tmp/build/VIDEO_ID_video.csv \
  -sc /tmp/build/VIDEO_ID_subtitle.csv
```

## Batch Pipeline Script

`cli/scripts/channel-pipeline.sh`는 아래를 자동으로 수행합니다.

1. `list`
2. (옵션) 기존 DB `video.id` 제외
3. `fetch -> build -> push`
4. 목표 개수만큼 성공 시 종료

예시: sebasi 채널에서 신규 50개 적재 (기존 DB ID 스킵 + proxy 사용)

```bash
cd cli
export KCONTEXT_YOUTUBE_PROXY_URL=http://127.0.0.1:8118
./scripts/channel-pipeline.sh \
  --url "https://www.youtube.com/@sebasi15/videos" \
  --target 50 \
  --manual-ko-only \
  --skip-existing
```

출력 산출물:

- `pushed_ids.txt`
- `failed_ids.txt`
- `logs/`
- `raw/`, `build/`

모든 파일은 실행 시 출력되는 `workspace` 디렉터리에 저장됩니다.

## Repeated Operations (Manual)

반복 운영을 위해 루트 스크립트 2개를 사용합니다.

1. 로컬 수집 자동화 (`sources.json` 순회)
2. 원격 증분 동기화 (신규 `video_id`만)

소스 설정 파일 예시:

```bash
cat /Users/kihoon/Documents/Project/dozboon/products/kcontext/cli/config/sources.json
```

로컬 수집:

```bash
cd /Users/kihoon/Documents/Project/dozboon/products/kcontext
./scripts/run-local-ingest.sh \
  --config /Users/kihoon/Documents/Project/dozboon/products/kcontext/cli/config/sources.json \
  --workspace-root /tmp/kcontext_ingest_runs \
  --max-sources 999 \
  --continue-on-error
```

원격 증분 동기화:

```bash
# 루트의 .env.remote-sync 파일 생성/갱신 (anon/service_role 자동 조회)
cd /Users/kihoon/Documents/Project/dozboon/products/kcontext
./scripts/bootstrap-remote-env.sh --project-ref bbapvtmiztyozkmgvfgf

# .env.remote-sync 의 REMOTE_DB_URL 에 DB password를 반영
# REMOTE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require

./scripts/run-remote-sync.sh \
  --state-db /Users/kihoon/Documents/Project/dozboon/products/kcontext/cli/.state/remote_sync.sqlite \
  --batch-size 20 \
  --max-videos 200
```

상태 조회:

```bash
cd /Users/kihoon/Documents/Project/dozboon/products/kcontext
./scripts/run-remote-sync.sh --status
```

## Notes on Proxy Reliability

Tor proxy는 출구 IP가 YouTube에 차단될 수 있습니다. 이 경우 프록시를 써도
`YouTube blocked ...` 오류가 발생할 수 있습니다.

- `./scripts/proxy-down.sh` 후 `./scripts/proxy-up.sh`로 재시도
- 또는 `--no-proxy`/직접 연결 경로로 실행
- 장기적으로는 rotating residential proxy 검토 권장
