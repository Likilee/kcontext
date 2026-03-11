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

export KCONTEXT_YOUTUBE_PROXY_PROVIDER="${KCONTEXT_YOUTUBE_PROXY_PROVIDER:-decodo}"

PROXY_JSON="$(
  cd "$ROOT_DIR/cli" && \
    uv run python - <<'PY'
import json

from kcontext_cli.network.proxy import describe_proxy_target, resolve_youtube_proxy_url

proxy_url = resolve_youtube_proxy_url(None)
print(
    json.dumps(
        {
            "proxy_url": proxy_url,
            "proxy_target": describe_proxy_target(proxy_url),
        },
        ensure_ascii=False,
    )
)
PY
)"

PROXY_URL="$(printf '%s' "$PROXY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["proxy_url"] or "")')"
PROXY_TARGET="$(printf '%s' "$PROXY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["proxy_target"] or "")')"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
META_LOG="$TMP_DIR/metadata.log"
FETCH_LOG="$TMP_DIR/fetch.log"

classify_log() {
  local log_file="$1"
  if grep -Eiq '\[proxy_auth_failed\]|Proxy Authentication Required|407' "$log_file"; then
    echo "proxy_auth_failed"
    return 0
  fi
  if grep -Eiq '\[proxy_unreachable\]|connection refused|timed out|name or service not known|temporary failure in name resolution|nodename nor servname provided|proxy connect|tunnel connection failed' "$log_file"; then
    echo "proxy_unreachable"
    return 0
  fi
  if grep -Eiq '\[rate_limited\]|YouTube blocked|429|Too Many Requests' "$log_file"; then
    echo "youtube_rate_limited"
    return 0
  fi
  echo "proxy_unreachable"
}

if ! (cd "$ROOT_DIR/cli" && uv run yt-dlp --proxy "$PROXY_URL" --dump-json --skip-download "https://www.youtube.com/watch?v=$VIDEO_ID") >"$META_LOG" 2>&1; then
  classify_log "$META_LOG"
  exit 1
fi

if ! (cd "$ROOT_DIR/cli" && uv run tubelang fetch "$VIDEO_ID" -o "$TMP_DIR/$VIDEO_ID.json" --youtube-proxy-url "$PROXY_URL") >"$FETCH_LOG" 2>&1; then
  classify_log "$FETCH_LOG"
  exit 1
fi

echo "ok"
printf 'proxy=%s\nvideo_id=%s\n' "$PROXY_TARGET" "$VIDEO_ID" >&2
