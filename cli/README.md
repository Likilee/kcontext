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

## Notes on Proxy Reliability

Tor proxy는 출구 IP가 YouTube에 차단될 수 있습니다. 이 경우 프록시를 써도
`YouTube blocked ...` 오류가 발생할 수 있습니다.

- `./scripts/proxy-down.sh` 후 `./scripts/proxy-up.sh`로 재시도
- 또는 `--no-proxy`/직접 연결 경로로 실행
- 장기적으로는 rotating residential proxy 검토 권장
