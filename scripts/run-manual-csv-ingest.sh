#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSV_PATH="$ROOT_DIR/docs/manual_ko_subtitle_videos.csv"
WORKSPACE="$ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_full"
MAX_VIDEOS_PER_RUN=0
FETCH_BACKEND="ytdlp"
PROXY_URL="${KCONTEXT_YOUTUBE_PROXY_URL:-}"
USE_PROXY=1

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --csv <path>                 CSV file to ingest (default: $ROOT_DIR/docs/manual_ko_subtitle_videos.csv)
  --workspace <path>           Resume workspace (default: $ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_full)
  --max-videos-per-run <n>     Max videos to process this run (default: all remaining)
  --fetch-backend <name>       Fetch backend: ytdlp | decodo-scraper (default: ytdlp)
  --proxy-url <url>            Proxy URL for YouTube requests
  --no-proxy                   Disable proxy usage
  -h, --help                   Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv)
      CSV_PATH="$2"
      shift 2
      ;;
    --workspace)
      WORKSPACE="$2"
      shift 2
      ;;
    --max-videos-per-run)
      MAX_VIDEOS_PER_RUN="$2"
      shift 2
      ;;
    --fetch-backend)
      FETCH_BACKEND="$2"
      shift 2
      ;;
    --proxy-url)
      PROXY_URL="$2"
      USE_PROXY=1
      shift 2
      ;;
    --no-proxy)
      PROXY_URL=""
      USE_PROXY=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$CSV_PATH" ]]; then
  echo "Error: CSV file not found: $CSV_PATH" >&2
  exit 1
fi

if ! [[ "$MAX_VIDEOS_PER_RUN" =~ ^[0-9]+$ ]]; then
  echo "Error: --max-videos-per-run must be a non-negative integer." >&2
  exit 1
fi

case "$FETCH_BACKEND" in
  ytdlp|decodo-scraper)
    ;;
  *)
    echo "Error: --fetch-backend must be 'ytdlp' or 'decodo-scraper'." >&2
    exit 1
    ;;
esac

RESOLVED_PROXY_INFO=""
RESOLVED_PROXY_URL=""
SUMMARY_PROXY_URL=""
if [[ "$USE_PROXY" -eq 1 && "$FETCH_BACKEND" == "ytdlp" ]]; then
  RESOLVED_PROXY_INFO="$(
    cd "$ROOT_DIR/cli" && \
      KCONTEXT_INGEST_CLI_PROXY_URL="$PROXY_URL" \
      uv run python - <<'PY'
import os

from kcontext_cli.network.proxy import describe_proxy_target, resolve_youtube_proxy_url

cli_proxy_url = os.getenv("KCONTEXT_INGEST_CLI_PROXY_URL")
if cli_proxy_url == "":
    cli_proxy_url = None

proxy_url = resolve_youtube_proxy_url(cli_proxy_url)
print(proxy_url or "")
print(describe_proxy_target(proxy_url) or "")
PY
  )"
  RESOLVED_PROXY_URL="$(printf '%s\n' "$RESOLVED_PROXY_INFO" | sed -n '1p')"
  SUMMARY_PROXY_URL="$(printf '%s\n' "$RESOLVED_PROXY_INFO" | sed -n '2p')"
fi

PLANNED_IDS="$WORKSPACE/planned_ids.txt"
REMAINING_IDS="$WORKSPACE/remaining_ids.txt"
SUCCEEDED_IDS="$WORKSPACE/succeeded_ids.txt"
FAILED_ATTEMPTS="$WORKSPACE/failed_attempts.tsv"
RUN_SUMMARY="$WORKSPACE/run_summary.json"
RAW_DIR="$WORKSPACE/raw"
BUILD_DIR="$WORKSPACE/build"
LOG_DIR="$WORKSPACE/logs"

mkdir -p "$WORKSPACE" "$RAW_DIR" "$BUILD_DIR" "$LOG_DIR"
touch "$SUCCEEDED_IDS"
if [[ ! -f "$FAILED_ATTEMPTS" ]]; then
  printf "timestamp\tvideo_id\tstage\terror_class\tlog_path\n" > "$FAILED_ATTEMPTS"
fi

PYTHONPATH="$ROOT_DIR/cli/src${PYTHONPATH:+:$PYTHONPATH}" python3 - "$CSV_PATH" "$PLANNED_IDS" <<'PY'
import sys
from pathlib import Path

from kcontext_cli.manual_csv import load_unique_video_ids

csv_path = Path(sys.argv[1])
planned_path = Path(sys.argv[2])

try:
    ordered_ids = load_unique_video_ids(csv_path)
except ValueError as exc:
    raise SystemExit(f"Error: {exc}") from exc

planned_path.write_text(
    "\n".join(ordered_ids) + ("\n" if ordered_ids else ""),
    encoding="utf-8",
)
PY

python3 - "$PLANNED_IDS" "$SUCCEEDED_IDS" "$REMAINING_IDS" <<'PY'
import sys
from pathlib import Path

planned_path = Path(sys.argv[1])
succeeded_path = Path(sys.argv[2])
remaining_path = Path(sys.argv[3])

planned_ids = [line.strip() for line in planned_path.read_text(encoding="utf-8").splitlines() if line.strip()]
succeeded_ids = {
    line.strip()
    for line in succeeded_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
}
remaining = [video_id for video_id in planned_ids if video_id not in succeeded_ids]

remaining_path.write_text(
    "\n".join(remaining) + ("\n" if remaining else ""),
    encoding="utf-8",
)
PY

PLANNED_COUNT="$(sed '/^$/d' "$PLANNED_IDS" | wc -l | tr -d ' ')"
REMAINING_COUNT="$(sed '/^$/d' "$REMAINING_IDS" | wc -l | tr -d ' ')"

if [[ "$REMAINING_COUNT" == "0" ]]; then
python3 - "$RUN_SUMMARY" "$CSV_PATH" "$WORKSPACE" "$PLANNED_IDS" "$SUCCEEDED_IDS" "$FAILED_ATTEMPTS" "$FETCH_BACKEND" <<'PY'
import json
import sys
from pathlib import Path

summary_path = Path(sys.argv[1])
csv_path = sys.argv[2]
workspace = sys.argv[3]
planned_ids = [line.strip() for line in Path(sys.argv[4]).read_text(encoding="utf-8").splitlines() if line.strip()]
succeeded_ids = [line.strip() for line in Path(sys.argv[5]).read_text(encoding="utf-8").splitlines() if line.strip()]
failed_attempts = Path(sys.argv[6]).read_text(encoding="utf-8").splitlines()[1:]

payload = {
    "csv_path": csv_path,
    "workspace": workspace,
    "fetch_backend": sys.argv[7],
    "planned_count": len(planned_ids),
    "succeeded_count": len(set(succeeded_ids)),
    "remaining_count": 0,
    "failed_attempt_count": len([line for line in failed_attempts if line.strip()]),
    "last_run": {
        "processed": 0,
        "succeeded": 0,
        "failed": 0,
        "stop_reason": "completed",
        "proxy_mode": "no_proxy",
        "fetch_backend": sys.argv[7],
    },
}
summary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY
  echo "No remaining videos. planned=${PLANNED_COUNT} succeeded=${PLANNED_COUNT}"
  exit 0
fi

RUN_LIMIT="$REMAINING_COUNT"
if [[ "$MAX_VIDEOS_PER_RUN" -gt 0 && "$MAX_VIDEOS_PER_RUN" -lt "$REMAINING_COUNT" ]]; then
  RUN_LIMIT="$MAX_VIDEOS_PER_RUN"
fi

CURRENT_RUN_IDS="$WORKSPACE/current_run_ids.txt"
head -n "$RUN_LIMIT" "$REMAINING_IDS" > "$CURRENT_RUN_IDS"

append_failure() {
  local timestamp="$1"
  local video_id="$2"
  local stage="$3"
  local error_class="$4"
  local log_path="$5"
  printf "%s\t%s\t%s\t%s\t%s\n" "$timestamp" "$video_id" "$stage" "$error_class" "$log_path" >> "$FAILED_ATTEMPTS"
}

RUN_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RUN_SUCCEEDED=0
RUN_FAILED=0
RUN_PROCESSED=0
STOP_REASON="completed"

if [[ "$FETCH_BACKEND" == "decodo-scraper" ]]; then
  PROXY_MODE="scraper_api"
elif [[ "$USE_PROXY" -eq 1 && -n "$RESOLVED_PROXY_URL" ]]; then
  PROXY_MODE="proxy"
else
  PROXY_MODE="no_proxy"
fi

echo "Starting ingest run: backend=${FETCH_BACKEND} proxy_mode=${PROXY_MODE} run_limit=${RUN_LIMIT} workspace=${WORKSPACE}"
if [[ -n "$SUMMARY_PROXY_URL" ]]; then
  echo "Resolved proxy target: ${SUMMARY_PROXY_URL}"
fi

while IFS= read -r VIDEO_ID; do
  [[ -z "$VIDEO_ID" ]] && continue
  RUN_PROCESSED=$((RUN_PROCESSED + 1))

  FETCH_LOG="$LOG_DIR/fetch_${VIDEO_ID}.log"
  BUILD_LOG="$LOG_DIR/build_${VIDEO_ID}.log"
  PUSH_LOG="$LOG_DIR/push_${VIDEO_ID}.log"

  rm -f "$RAW_DIR/${VIDEO_ID}_raw.json" \
    "$BUILD_DIR/${VIDEO_ID}_storage.json" \
    "$BUILD_DIR/${VIDEO_ID}_video.csv" \
    "$BUILD_DIR/${VIDEO_ID}_subtitle.csv"

  echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch"
  FETCH_CMD=(
    uv run tubelang fetch
    -o "$RAW_DIR/${VIDEO_ID}_raw.json"
    --fetch-backend "$FETCH_BACKEND"
    -- "$VIDEO_ID"
  )
  if [[ "$FETCH_BACKEND" == "ytdlp" && "$USE_PROXY" -eq 1 && -n "$PROXY_URL" ]]; then
    FETCH_CMD+=(--youtube-proxy-url "$PROXY_URL")
  fi

  if ! (cd "$ROOT_DIR/cli" && "${FETCH_CMD[@]}") >"$FETCH_LOG" 2>&1; then
    TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    if [[ "$FETCH_BACKEND" == "decodo-scraper" ]]; then
      if grep -Eiq '\[api_auth_failed\]' "$FETCH_LOG"; then
        append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "api_auth_failed" "$FETCH_LOG"
        RUN_FAILED=$((RUN_FAILED + 1))
        STOP_REASON="api_auth_failed"
        echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed api_auth_failed (log: ${FETCH_LOG})" >&2
        break
      fi
      if grep -Eiq '\[api_budget_exhausted\]|quota|budget|traffic|balance|subscription|upgrade|payment' "$FETCH_LOG"; then
        append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "api_budget_exhausted" "$FETCH_LOG"
        RUN_FAILED=$((RUN_FAILED + 1))
        STOP_REASON="api_budget_exhausted"
        echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed api_budget_exhausted (log: ${FETCH_LOG})" >&2
        break
      fi
      if grep -Eiq '\[api_rate_limited\]' "$FETCH_LOG"; then
        append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "api_rate_limited" "$FETCH_LOG"
        RUN_FAILED=$((RUN_FAILED + 1))
        STOP_REASON="api_rate_limited"
        echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed api_rate_limited (log: ${FETCH_LOG})" >&2
        break
      fi
    fi
    if grep -Eiq '\[rate_limited\]|YouTube blocked|429|Too Many Requests' "$FETCH_LOG"; then
      append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "rate_limited" "$FETCH_LOG"
      RUN_FAILED=$((RUN_FAILED + 1))
      STOP_REASON="rate_limited"
      echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed rate_limited (log: ${FETCH_LOG})" >&2
      break
    fi
    if grep -Eiq '\[proxy_auth_failed\]|Proxy Authentication Required|407' "$FETCH_LOG"; then
      append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "proxy_auth_failed" "$FETCH_LOG"
      RUN_FAILED=$((RUN_FAILED + 1))
      echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed proxy_auth_failed (log: ${FETCH_LOG})" >&2
      continue
    fi
    if grep -Eiq '\[proxy_unreachable\]|connection refused|timed out|name or service not known|temporary failure in name resolution|nodename nor servname provided|proxy connect|tunnel connection failed' "$FETCH_LOG"; then
      append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "proxy_unreachable" "$FETCH_LOG"
      RUN_FAILED=$((RUN_FAILED + 1))
      echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed proxy_unreachable (log: ${FETCH_LOG})" >&2
      continue
    fi
    if grep -Eiq '\[api_unreachable\]' "$FETCH_LOG"; then
      append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "api_unreachable" "$FETCH_LOG"
      RUN_FAILED=$((RUN_FAILED + 1))
      echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed api_unreachable (log: ${FETCH_LOG})" >&2
      continue
    fi
    if grep -Eiq '\[api_unexpected_schema\]' "$FETCH_LOG"; then
      append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "api_unexpected_schema" "$FETCH_LOG"
      RUN_FAILED=$((RUN_FAILED + 1))
      echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed api_unexpected_schema (log: ${FETCH_LOG})" >&2
      continue
    fi
    append_failure "$TIMESTAMP" "$VIDEO_ID" "fetch" "fetch_failed" "$FETCH_LOG"
    RUN_FAILED=$((RUN_FAILED + 1))
    echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: fetch failed fetch_failed (log: ${FETCH_LOG})" >&2
    continue
  fi

  echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: build"
  if ! (cd "$ROOT_DIR/cli" && uv run tubelang build "$RAW_DIR/${VIDEO_ID}_raw.json" -d "$BUILD_DIR") >"$BUILD_LOG" 2>&1; then
    append_failure "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$VIDEO_ID" "build" "build_failed" "$BUILD_LOG"
    RUN_FAILED=$((RUN_FAILED + 1))
    echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: build failed build_failed (log: ${BUILD_LOG})" >&2
    continue
  fi

  echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: push"
  if ! (
    cd "$ROOT_DIR/cli" && \
      uv run tubelang push \
        -s "$BUILD_DIR/${VIDEO_ID}_storage.json" \
        -vc "$BUILD_DIR/${VIDEO_ID}_video.csv" \
        -sc "$BUILD_DIR/${VIDEO_ID}_subtitle.csv"
  ) >"$PUSH_LOG" 2>&1; then
    append_failure "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$VIDEO_ID" "push" "push_failed" "$PUSH_LOG"
    RUN_FAILED=$((RUN_FAILED + 1))
    echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: push failed push_failed (log: ${PUSH_LOG})" >&2
    continue
  fi

  if ! grep -qxF -- "$VIDEO_ID" "$SUCCEEDED_IDS"; then
    printf "%s\n" "$VIDEO_ID" >> "$SUCCEEDED_IDS"
  fi
  RUN_SUCCEEDED=$((RUN_SUCCEEDED + 1))
  echo "[${RUN_PROCESSED}/${RUN_LIMIT}] ${VIDEO_ID}: done"
done < "$CURRENT_RUN_IDS"

python3 - "$PLANNED_IDS" "$SUCCEEDED_IDS" "$REMAINING_IDS" <<'PY'
import sys
from pathlib import Path

planned_path = Path(sys.argv[1])
succeeded_path = Path(sys.argv[2])
remaining_path = Path(sys.argv[3])

planned_ids = [line.strip() for line in planned_path.read_text(encoding="utf-8").splitlines() if line.strip()]
succeeded_ids = {
    line.strip()
    for line in succeeded_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
}
remaining = [video_id for video_id in planned_ids if video_id not in succeeded_ids]

remaining_path.write_text(
    "\n".join(remaining) + ("\n" if remaining else ""),
    encoding="utf-8",
)
PY

RUN_FINISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 - "$RUN_SUMMARY" "$CSV_PATH" "$WORKSPACE" "$PLANNED_IDS" "$SUCCEEDED_IDS" "$REMAINING_IDS" "$FAILED_ATTEMPTS" "$RUN_STARTED_AT" "$RUN_FINISHED_AT" "$RUN_PROCESSED" "$RUN_SUCCEEDED" "$RUN_FAILED" "$STOP_REASON" "$PROXY_MODE" "$SUMMARY_PROXY_URL" "$FETCH_BACKEND" <<'PY'
import json
import sys
from pathlib import Path

summary_path = Path(sys.argv[1])
csv_path = sys.argv[2]
workspace = sys.argv[3]
planned_ids = [line.strip() for line in Path(sys.argv[4]).read_text(encoding="utf-8").splitlines() if line.strip()]
succeeded_ids = [line.strip() for line in Path(sys.argv[5]).read_text(encoding="utf-8").splitlines() if line.strip()]
remaining_ids = [line.strip() for line in Path(sys.argv[6]).read_text(encoding="utf-8").splitlines() if line.strip()]
failed_attempt_lines = Path(sys.argv[7]).read_text(encoding="utf-8").splitlines()[1:]

payload = {
    "csv_path": csv_path,
    "workspace": workspace,
    "fetch_backend": sys.argv[16],
    "planned_count": len(planned_ids),
    "succeeded_count": len(set(succeeded_ids)),
    "remaining_count": len(remaining_ids),
    "failed_attempt_count": len([line for line in failed_attempt_lines if line.strip()]),
    "last_run": {
        "started_at": sys.argv[8],
        "finished_at": sys.argv[9],
        "processed": int(sys.argv[10]),
        "succeeded": int(sys.argv[11]),
        "failed": int(sys.argv[12]),
        "stop_reason": sys.argv[13],
        "proxy_mode": sys.argv[14],
        "proxy_url": sys.argv[15] if sys.argv[15] else None,
        "fetch_backend": sys.argv[16],
    },
}

summary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY

FINAL_SUCCEEDED="$(sed '/^$/d' "$SUCCEEDED_IDS" | sort -u | wc -l | tr -d ' ')"
FINAL_REMAINING="$(sed '/^$/d' "$REMAINING_IDS" | wc -l | tr -d ' ')"

echo "Run summary: planned=${PLANNED_COUNT} processed=${RUN_PROCESSED} succeeded=${RUN_SUCCEEDED} failed=${RUN_FAILED} total_succeeded=${FINAL_SUCCEEDED} remaining=${FINAL_REMAINING} stop_reason=${STOP_REASON}"
echo "Workspace: $WORKSPACE"

if [[ "$STOP_REASON" == "rate_limited" || "$STOP_REASON" == "api_rate_limited" || "$STOP_REASON" == "api_auth_failed" || "$STOP_REASON" == "api_budget_exhausted" ]]; then
  exit 2
fi
