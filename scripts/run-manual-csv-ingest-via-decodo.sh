#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.decodo"

usage() {
  cat <<EOF
Usage: $0 [options] [-- ingest args...]

Options:
  --env-file <path>   Decodo env file to source (default: $ROOT_DIR/.env.decodo)
  -h, --help          Show help

Pass-through:
  Remaining arguments are forwarded to ./scripts/run-manual-csv-ingest.sh.
  --no-proxy, --proxy-url, and --fetch-backend are rejected by this wrapper.
EOF
}

INGEST_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --proxy-url|--no-proxy|--fetch-backend)
      echo "Error: $1 is not allowed with the Decodo wrapper." >&2
      exit 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        if [[ "$1" == "--proxy-url" || "$1" == "--no-proxy" || "$1" == "--fetch-backend" ]]; then
          echo "Error: $1 is not allowed with the Decodo wrapper." >&2
          exit 1
        fi
        INGEST_ARGS+=("$1")
        shift
      done
      break
      ;;
    *)
      INGEST_ARGS+=("$1")
      shift
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

exec "$ROOT_DIR/scripts/run-manual-csv-ingest.sh" "${INGEST_ARGS[@]}"
