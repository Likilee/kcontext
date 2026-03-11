#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.decodo"
VIDEO_ID="${DECODO_CANARY_VIDEO_ID:-DucXv5xjhW4}"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --env-file <path>   Decodo env file to source (default: $ROOT_DIR/.env.decodo)
  --video-id <id>     Canary YouTube video ID (default: $VIDEO_ID)
  -h, --help          Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --video-id)
      VIDEO_ID="$2"
      shift 2
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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export DECODO_SCRAPER_API_URL="${DECODO_SCRAPER_API_URL:-https://scraper-api.decodo.com/v2/scrape}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
FETCH_LOG="$TMP_DIR/fetch.log"
RAW_PATH="$TMP_DIR/${VIDEO_ID}_raw.json"
METADATA_PATH="$TMP_DIR/${VIDEO_ID}_metadata_raw.json"
BUILD_DIR="$TMP_DIR/build"

classify_log() {
  local log_file="$1"
  if grep -Eiq '\[api_auth_failed\]|401|403|407' "$log_file"; then
    echo "api_auth_failed"
    return 0
  fi
  if grep -Eiq '\[api_budget_exhausted\]|quota|budget|traffic|balance|subscription|upgrade|payment' "$log_file"; then
    echo "api_budget_exhausted"
    return 0
  fi
  if grep -Eiq '\[api_rate_limited\]|429|Too Many Requests' "$log_file"; then
    echo "api_rate_limited"
    return 0
  fi
  if grep -Eiq '\[api_unreachable\]|timed out|temporary failure|name or service not known|connection refused|network is unreachable' "$log_file"; then
    echo "api_unreachable"
    return 0
  fi
  echo "api_unexpected_schema"
}

if ! (
  cd "$ROOT_DIR/cli" && \
    uv run tubelang fetch "$VIDEO_ID" -o "$RAW_PATH" --fetch-backend decodo-scraper
) >"$FETCH_LOG" 2>&1; then
  classify_log "$FETCH_LOG"
  exit 1
fi

if [[ ! -f "$RAW_PATH" || ! -f "$METADATA_PATH" ]]; then
  echo "api_unexpected_schema"
  exit 1
fi

if ! (
  cd "$ROOT_DIR/cli" && \
    uv run tubelang build-metadata "$METADATA_PATH" -d "$BUILD_DIR"
) >>"$FETCH_LOG" 2>&1; then
  echo "api_unexpected_schema"
  exit 1
fi

echo "ok"
printf 'video_id=%s\nmetadata_sidecar=%s\n' "$VIDEO_ID" "$METADATA_PATH" >&2
