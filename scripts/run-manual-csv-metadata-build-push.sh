#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_filtered_full"
MAX_VIDEOS_PER_RUN=0
FORCE=0
DEFAULT_AUDIO_LANGUAGE_CODE="${DEFAULT_AUDIO_LANGUAGE_CODE:-ko}"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --workspace <path>           Workspace with raw/build directories (default: $WORKSPACE)
  --max-videos-per-run <n>     Max metadata files to process this run (default: all remaining)
  --force                      Rebuild and repush metadata even if already marked successful
  -h, --help                   Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      WORKSPACE="$2"
      shift 2
      ;;
    --max-videos-per-run)
      MAX_VIDEOS_PER_RUN="$2"
      shift 2
      ;;
    --force)
      FORCE=1
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

if ! [[ "$MAX_VIDEOS_PER_RUN" =~ ^[0-9]+$ ]]; then
  echo "Error: --max-videos-per-run must be a non-negative integer." >&2
  exit 1
fi

RAW_DIR="$WORKSPACE/raw"
BUILD_DIR="$WORKSPACE/build"
LOG_DIR="$WORKSPACE/logs"
SUCCEEDED_IDS="$WORKSPACE/metadata_succeeded_ids.txt"
FAILED_ATTEMPTS="$WORKSPACE/metadata_failed_attempts.tsv"

mkdir -p "$RAW_DIR" "$BUILD_DIR" "$LOG_DIR"
touch "$SUCCEEDED_IDS"
if [[ ! -f "$FAILED_ATTEMPTS" ]]; then
  printf "timestamp\tvideo_id\tstage\terror_class\tlog_path\n" > "$FAILED_ATTEMPTS"
fi

METADATA_FILES=()
while IFS= read -r metadata_file; do
  METADATA_FILES+=("$metadata_file")
done < <(find "$RAW_DIR" -maxdepth 1 -type f -name '*_metadata_raw.json' | sort)
if [[ "${#METADATA_FILES[@]}" -eq 0 ]]; then
  echo "No metadata raw files found in $RAW_DIR"
  exit 0
fi

append_failure() {
  local timestamp="$1"
  local video_id="$2"
  local stage="$3"
  local error_class="$4"
  local log_path="$5"
  printf "%s\t%s\t%s\t%s\t%s\n" "$timestamp" "$video_id" "$stage" "$error_class" "$log_path" >> "$FAILED_ATTEMPTS"
}

RUN_PROCESSED=0
RUN_SUCCEEDED=0
RUN_FAILED=0

echo "Starting metadata backfill: workspace=${WORKSPACE} max_videos=${MAX_VIDEOS_PER_RUN:-0} force=${FORCE}"

for METADATA_RAW in "${METADATA_FILES[@]}"; do
  VIDEO_ID="$(basename "$METADATA_RAW" "_metadata_raw.json")"
  if [[ "$FORCE" -eq 0 ]] && grep -qxF -- "$VIDEO_ID" "$SUCCEEDED_IDS"; then
    continue
  fi

  if [[ "$MAX_VIDEOS_PER_RUN" -gt 0 && "$RUN_PROCESSED" -ge "$MAX_VIDEOS_PER_RUN" ]]; then
    break
  fi

  RUN_PROCESSED=$((RUN_PROCESSED + 1))
  BUILD_LOG="$LOG_DIR/build_metadata_${VIDEO_ID}.log"
  PUSH_LOG="$LOG_DIR/push_metadata_${VIDEO_ID}.log"

  echo "[${RUN_PROCESSED}] ${VIDEO_ID}: build-metadata"
  if ! (
    cd "$ROOT_DIR/cli" && \
      uv run tubelang build-metadata "$METADATA_RAW" -d "$BUILD_DIR" \
        --default-audio-language-code "$DEFAULT_AUDIO_LANGUAGE_CODE"
  ) >"$BUILD_LOG" 2>&1; then
    append_failure "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$VIDEO_ID" "build-metadata" "build_metadata_failed" "$BUILD_LOG"
    RUN_FAILED=$((RUN_FAILED + 1))
    echo "[${RUN_PROCESSED}] ${VIDEO_ID}: build-metadata failed (log: ${BUILD_LOG})" >&2
    continue
  fi

  echo "[${RUN_PROCESSED}] ${VIDEO_ID}: push-metadata"
  if ! (
    cd "$ROOT_DIR/cli" && \
      uv run tubelang push-metadata -m "$BUILD_DIR/${VIDEO_ID}_metadata_storage.json"
  ) >"$PUSH_LOG" 2>&1; then
    append_failure "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$VIDEO_ID" "push-metadata" "push_metadata_failed" "$PUSH_LOG"
    RUN_FAILED=$((RUN_FAILED + 1))
    echo "[${RUN_PROCESSED}] ${VIDEO_ID}: push-metadata failed (log: ${PUSH_LOG})" >&2
    continue
  fi

  if ! grep -qxF -- "$VIDEO_ID" "$SUCCEEDED_IDS"; then
    printf "%s\n" "$VIDEO_ID" >> "$SUCCEEDED_IDS"
  fi
  RUN_SUCCEEDED=$((RUN_SUCCEEDED + 1))
  echo "[${RUN_PROCESSED}] ${VIDEO_ID}: done"
done

TOTAL_SUCCEEDED="$(sed '/^$/d' "$SUCCEEDED_IDS" | sort -u | wc -l | tr -d ' ')"
echo "Metadata summary: processed=${RUN_PROCESSED} succeeded=${RUN_SUCCEEDED} failed=${RUN_FAILED} total_succeeded=${TOTAL_SUCCEEDED}"
