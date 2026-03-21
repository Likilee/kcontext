# CLI Test Guide

이 문서는 `cli` 앱이 설계 의도(명시적 I/O, 수동 한글 자막 우선, Atomic Replace)에 맞게 동작하는지 개발자가 직접 검증하는 절차를 정의한다.

## 1) 테스트 목표

- 명령 계약 검증: `list -> fetch -> build -> push`
- 산출물 스키마 검증: `*_storage.json`, `*_video.csv`, `*_subtitle.csv`
- 적재 동작 검증:
  - `video`는 UPSERT
  - `subtitle`은 video 단위 DELETE 후 COPY (중복/유령 청크 방지)
- 실패 방어 검증:
  - 잘못된 입력/파일 누락/외부 도구 미설치 시 비정상 종료(`exit 1`)

## 2) 사전 준비

프로젝트 루트에서 실행:

```bash
cd /Users/kihoon/Documents/Project/dozboon/products/kcontext
```

의존성/환경:

```bash
# Python deps 동기화
cd cli && uv sync

# yt-dlp 설치 확인 (없으면 설치)
yt-dlp --version

# 로컬 Supabase 실행 (push 검증 시 필요)
cd ../supabase && supabase start
```

CLI 환경 변수 준비:

```bash
cd ../cli
cp -n .env.example .env
```

`cli/.env`의 local Supabase storage/admin key는 아래 값으로 채운다.
`SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY` 중 하나를 사용하면 된다.

```bash
cd ../supabase
supabase status --output json | python3 -c "import sys,json; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])"
cd ../cli
```

IP 차단 환경에서 torproxy를 쓰려면(옵션):

```bash
# torproxy 실행
docker run -d --name torproxy -p 8118:8118 -p 9050:9050 dperson/torproxy

# Tor bootstrap 대기 후 프록시 준비 확인
sleep 10
curl -s -x http://127.0.0.1:8118 https://httpbin.org/ip
```

프록시를 CLI에 적용하는 방법:

```bash
# 방법 1) 환경변수 (권장)
export KCONTEXT_YOUTUBE_PROXY_URL=http://127.0.0.1:8118

uv run tubelang list "https://www.youtube.com/@sebasi15/videos" --limit 3 > /tmp/kcontext_manual/video_ids.txt
VIDEO_ID="$(head -n 1 /tmp/kcontext_manual/video_ids.txt)"
uv run tubelang fetch "$VIDEO_ID" -o "/tmp/kcontext_manual/${VIDEO_ID}_raw.json" \
  --default-audio-language-code ko
uv run tubelang fetch-list /tmp/kcontext_manual/video_ids.txt -d /tmp/kcontext_manual \
  --default-audio-language-code ko
```

```bash
# 방법 2) 명령 옵션 (환경변수보다 우선)
uv run tubelang list "https://www.youtube.com/@sebasi15/videos" --limit 3 \
  --youtube-proxy-url http://127.0.0.1:8118
```

## 3) Baseline 자동 테스트

먼저 코드 기본 상태가 깨끗한지 확인한다.

```bash
cd /Users/kihoon/Documents/Project/dozboon/products/kcontext/cli
uv run ruff check .
uv run pytest -q
```

통과 기준:

- `ruff`: `All checks passed!`
- `pytest`: 전체 테스트 통과

## 4) 수동 E2E 테스트 (실데이터)

### Step A. list

```bash
cd /Users/kihoon/Documents/Project/dozboon/products/kcontext/cli
mkdir -p /tmp/kcontext_manual
uv run tubelang list "https://www.youtube.com/@sebasi15/videos" --limit 3 > /tmp/kcontext_manual/video_ids.txt
cat /tmp/kcontext_manual/video_ids.txt
```

통과 기준:

- `video_ids.txt`에 줄바꿈으로 분리된 영상 ID가 1개 이상 존재
- ID 개수는 `--limit` 이하

수동 한국어 자막 있는 영상만 받고 싶으면:

```bash
uv run tubelang list "https://www.youtube.com/@sebasi15/videos" \
  --limit 3 \
  --manual-ko-only \
  --probe-max-candidates 30 > /tmp/kcontext_manual/video_ids.txt
```

### Step B. fetch

```bash
VIDEO_ID="$(head -n 1 /tmp/kcontext_manual/video_ids.txt)"
uv run tubelang fetch "$VIDEO_ID" -o "/tmp/kcontext_manual/${VIDEO_ID}_raw.json" \
  --default-audio-language-code ko
```

통과 기준:

- 파일 생성: `/tmp/kcontext_manual/${VIDEO_ID}_raw.json`
- JSON 필수 키 존재: `video_id`, `title`, `channel_name`, `published_at`, `transcript`
- `transcript`가 비어있지 않음

빠른 검증:

```bash
python3 - <<'PY'
import json, os
vid = os.popen("head -n 1 /tmp/kcontext_manual/video_ids.txt").read().strip()
p = f"/tmp/kcontext_manual/{vid}_raw.json"
data = json.load(open(p, encoding="utf-8"))
print("keys_ok:", all(k in data for k in ["video_id","title","channel_name","published_at","transcript"]))
print("transcript_len:", len(data["transcript"]))
PY
```

여러 ID를 한 번에 가져오려면:

```bash
uv run tubelang fetch-list /tmp/kcontext_manual/video_ids.txt -d /tmp/kcontext_manual \
  --default-audio-language-code ko
```

옵션:

- `--strict`: 하나라도 실패하면 즉시 종료(`exit 1`)

### Step C. build

```bash
uv run tubelang build "/tmp/kcontext_manual/${VIDEO_ID}_raw.json" -d /tmp/kcontext_manual \
  --default-audio-language-code ko
ls -1 /tmp/kcontext_manual/${VIDEO_ID}_*
```

통과 기준:

- 아래 3개 파일 생성:
  - `${VIDEO_ID}_storage.json`
  - `${VIDEO_ID}_video.csv`
  - `${VIDEO_ID}_subtitle.csv`
- `storage.json` 아이템 키가 `start_time`, `duration`, `text`
- CSV 확장자지만 실제 구분자는 탭(`\t`)임

### Step D. push

```bash
uv run tubelang push \
  -s "/tmp/kcontext_manual/${VIDEO_ID}_storage.json" \
  -vc "/tmp/kcontext_manual/${VIDEO_ID}_video.csv" \
  -sc "/tmp/kcontext_manual/${VIDEO_ID}_subtitle.csv" \
  --default-audio-language-code ko
```

통과 기준:

- CLI 종료 코드 `0`
- stderr에 `Successfully pushed data for ${VIDEO_ID}` 출력

## 5) push 결과 검증 (DB + Storage)

Storage 공개 경로 확인:

```bash
curl -s "http://127.0.0.1:54321/storage/v1/object/public/subtitles/${VIDEO_ID}.json" | head
```

통과 기준:

- JSON 응답이 반환됨

DB 확인:

```bash
VID="$VIDEO_ID" uv run python - <<'PY'
import os
import psycopg2

vid = os.environ["VID"]
conn = psycopg2.connect(
    host="127.0.0.1",
    port=54322,
    user="postgres",
    password="postgres",
    dbname="postgres",
)
with conn, conn.cursor() as cur:
    cur.execute("SELECT id, title, channel_name FROM video WHERE id = %s", (vid,))
    print("video_row:", cur.fetchone())
    cur.execute("SELECT COUNT(*) FROM subtitle WHERE video_id = %s", (vid,))
    print("subtitle_count:", cur.fetchone()[0])
conn.close()
PY
```

통과 기준:

- `video_row`가 `None`이 아님
- `subtitle_count`가 `1` 이상

## 6) 회귀 방지 핵심 시나리오 (Atomic Replace)

목적: 동일 `video_id` 재업로드 시 자막이 누적되지 않고 교체되는지 확인.

```bash
VIDEO_ID="$(head -n 1 /tmp/kcontext_manual/video_ids.txt)"
```

### 1차 업로드

```bash
uv run tubelang push \
  -s "/tmp/kcontext_manual/${VIDEO_ID}_storage.json" \
  -vc "/tmp/kcontext_manual/${VIDEO_ID}_video.csv" \
  -sc "/tmp/kcontext_manual/${VIDEO_ID}_subtitle.csv" \
  --default-audio-language-code ko
```

### 2차 업로드 전 자막 행 수를 줄인 파일 준비

```bash
python3 - <<'PY'
import os, pathlib
vid = os.popen("head -n 1 /tmp/kcontext_manual/video_ids.txt").read().strip()
src = pathlib.Path(f"/tmp/kcontext_manual/{vid}_subtitle.csv")
dst = pathlib.Path(f"/tmp/kcontext_manual/{vid}_subtitle_one_row.csv")
first = src.read_text(encoding="utf-8").splitlines()[0]
dst.write_text(first + "\n", encoding="utf-8")
print(dst)
PY
```

### 2차 업로드

```bash
uv run tubelang push \
  -s "/tmp/kcontext_manual/${VIDEO_ID}_storage.json" \
  -vc "/tmp/kcontext_manual/${VIDEO_ID}_video.csv" \
  -sc "/tmp/kcontext_manual/${VIDEO_ID}_subtitle_one_row.csv" \
  --default-audio-language-code ko
```

검증:

```bash
VID="$VIDEO_ID" uv run python - <<'PY'
import os, psycopg2
vid = os.environ["VID"]
conn = psycopg2.connect(host="127.0.0.1", port=54322, user="postgres", password="postgres", dbname="postgres")
with conn, conn.cursor() as cur:
    cur.execute("SELECT COUNT(*) FROM subtitle WHERE video_id = %s", (vid,))
    print(cur.fetchone()[0])
conn.close()
PY
```

통과 기준:

- 결과가 `1`이어야 함
- `1 + 기존 개수`처럼 누적되면 실패 (Atomic Replace 깨짐)

## 7) 실패 시나리오 체크

아래는 반드시 실패(`exit 1`)해야 정상인 케이스다.

### Case A. list 잘못된 URL

```bash
uv run tubelang list "not-a-url"
echo $?
```

### Case B. fetch 잘못된 video_id

```bash
uv run tubelang fetch "invalid_id" -o /tmp/kcontext_manual/invalid_raw.json \
  --default-audio-language-code ko
echo $?
```

### Case C. build 입력 파일 없음

```bash
uv run tubelang build /tmp/kcontext_manual/not-found.json -d /tmp/kcontext_manual \
  --default-audio-language-code ko
echo $?
```

### Case D. push 입력 파일 없음

```bash
uv run tubelang push -s /tmp/nope_storage.json -vc /tmp/nope_video.csv -sc /tmp/nope_subtitle.csv \
  --default-audio-language-code ko
echo $?
```

### Case E. 지원하지 않는 프록시 스킴

```bash
uv run tubelang list "https://www.youtube.com/@sebasi15/videos" \
  --youtube-proxy-url "socks5://127.0.0.1:9050"
echo $?
```

통과 기준:

- 각 케이스에서 종료 코드 `1`
- 출력에 `Error:` 포함

## 8) 완료 기준 (Release Gate)

아래를 모두 만족하면 "계획대로 동작"으로 판정한다.

- Baseline 자동 테스트 통과 (`ruff`, `pytest`)
- 실데이터 E2E 1회 성공 (`list -> fetch -> build -> push`)
- DB/Storage 검증 성공
- Atomic Replace 시나리오 성공
- 실패 시나리오가 의도대로 실패
