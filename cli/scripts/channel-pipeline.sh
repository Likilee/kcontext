#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Run list -> fetch -> build -> push for a YouTube channel/playlist.

Usage:
  ./scripts/channel-pipeline.sh [options]

Options:
  --url <url>                   YouTube channel/playlist URL
                                (default: https://www.youtube.com/@sebasi15/videos)
  --target <n>                  Number of videos to push (default: 50)
  --workspace <dir>             Workspace directory (default: /tmp/kcontext_pipeline_<timestamp>)
  --proxy-url <url>             Proxy URL for YouTube requests (default: KCONTEXT_YOUTUBE_PROXY_URL env)
  --no-proxy                    Disable proxy usage
  --manual-ko-only              List only videos with manual Korean subtitles (default)
  --no-manual-ko-only           Disable manual-ko prefilter
  --probe-max-candidates <n>    Candidate scan size when manual-ko-only is on (default: 500)
  --skip-existing               Skip video IDs already in DB before processing (default)
  --no-skip-existing            Do not skip existing IDs
  -h, --help                    Show this help
USAGE
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

URL="https://www.youtube.com/@sebasi15/videos"
TARGET=50
WORKSPACE="/tmp/kcontext_pipeline_$(date +%Y%m%d_%H%M%S)"
PROXY_URL="${KCONTEXT_YOUTUBE_PROXY_URL:-}"
USE_PROXY=1
MANUAL_KO_ONLY=1
PROBE_MAX_CANDIDATES=500
SKIP_EXISTING=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      URL="$2"
      shift 2
      ;;
    --target)
      TARGET="$2"
      shift 2
      ;;
    --workspace)
      WORKSPACE="$2"
      shift 2
      ;;
    --proxy-url)
      PROXY_URL="$2"
      USE_PROXY=1
      shift 2
      ;;
    --no-proxy)
      USE_PROXY=0
      PROXY_URL=""
      shift
      ;;
    --manual-ko-only)
      MANUAL_KO_ONLY=1
      shift
      ;;
    --no-manual-ko-only)
      MANUAL_KO_ONLY=0
      shift
      ;;
    --probe-max-candidates)
      PROBE_MAX_CANDIDATES="$2"
      shift 2
      ;;
    --skip-existing)
      SKIP_EXISTING=1
      shift
      ;;
    --no-skip-existing)
      SKIP_EXISTING=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$WORKSPACE/raw" "$WORKSPACE/build" "$WORKSPACE/logs"

echo "workspace: $WORKSPACE"

LIST_CMD=(uv run tubelang list "$URL" --limit "$((TARGET * 4))")
if [[ "$MANUAL_KO_ONLY" -eq 1 ]]; then
  LIST_CMD+=(--manual-ko-only --probe-max-candidates "$PROBE_MAX_CANDIDATES")
fi
if [[ "$USE_PROXY" -eq 1 && -n "$PROXY_URL" ]]; then
  LIST_CMD+=(--youtube-proxy-url "$PROXY_URL")
fi

"${LIST_CMD[@]}" > "$WORKSPACE/candidate_ids.txt"

if [[ "$SKIP_EXISTING" -eq 1 ]]; then
  uv run python - <<'PY' "$WORKSPACE"
import sys
from pathlib import Path

import psycopg2

work = Path(sys.argv[1])
conn = psycopg2.connect(host='127.0.0.1', port=54322, user='postgres', password='postgres', dbname='postgres')
cur = conn.cursor()
cur.execute('select id from video')
existing = {row[0] for row in cur.fetchall()}
cur.close()
conn.close()

seen = set()
out = []
for line in work.joinpath('candidate_ids.txt').read_text(encoding='utf-8').splitlines():
    vid = line.strip()
    if not vid or vid in seen or vid in existing:
        continue
    seen.add(vid)
    out.append(vid)

work.joinpath('todo_ids.txt').write_text('\n'.join(out) + ('\n' if out else ''), encoding='utf-8')
print(f'existing={len(existing)} candidates={len(out)}')
PY
else
  cp "$WORKSPACE/candidate_ids.txt" "$WORKSPACE/todo_ids.txt"
fi

SUCCESS=0
FAILED=0
: > "$WORKSPACE/pushed_ids.txt"
: > "$WORKSPACE/failed_ids.txt"

while IFS= read -r VIDEO_ID; do
  [[ -z "$VIDEO_ID" ]] && continue
  [[ "$SUCCESS" -ge "$TARGET" ]] && break

  echo "[$SUCCESS/$TARGET] $VIDEO_ID"

  FETCH_CMD=(uv run tubelang fetch "$VIDEO_ID" -o "$WORKSPACE/raw/${VIDEO_ID}_raw.json")
  if [[ "$USE_PROXY" -eq 1 && -n "$PROXY_URL" ]]; then
    FETCH_CMD+=(--youtube-proxy-url "$PROXY_URL")
  fi

  if ! "${FETCH_CMD[@]}" > /dev/null 2> "$WORKSPACE/logs/fetch_${VIDEO_ID}.log"; then
    echo "$VIDEO_ID" >> "$WORKSPACE/failed_ids.txt"
    FAILED=$((FAILED + 1))
    continue
  fi

  if ! uv run tubelang build "$WORKSPACE/raw/${VIDEO_ID}_raw.json" -d "$WORKSPACE/build" > /dev/null 2> "$WORKSPACE/logs/build_${VIDEO_ID}.log"; then
    echo "$VIDEO_ID" >> "$WORKSPACE/failed_ids.txt"
    FAILED=$((FAILED + 1))
    continue
  fi

  if ! uv run tubelang push \
    -s "$WORKSPACE/build/${VIDEO_ID}_storage.json" \
    -vc "$WORKSPACE/build/${VIDEO_ID}_video.csv" \
    -sc "$WORKSPACE/build/${VIDEO_ID}_subtitle.csv" \
    > /dev/null 2> "$WORKSPACE/logs/push_${VIDEO_ID}.log"; then
    echo "$VIDEO_ID" >> "$WORKSPACE/failed_ids.txt"
    FAILED=$((FAILED + 1))
    continue
  fi

  echo "$VIDEO_ID" >> "$WORKSPACE/pushed_ids.txt"
  SUCCESS=$((SUCCESS + 1))
done < "$WORKSPACE/todo_ids.txt"

echo "summary: pushed=$SUCCESS failed=$FAILED workspace=$WORKSPACE"
if [[ "$SUCCESS" -lt "$TARGET" ]]; then
  echo "warning: requested target=$TARGET but pushed=$SUCCESS" >&2
  exit 2
fi
