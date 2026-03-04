#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DB="$ROOT_DIR/cli/.state/remote_sync.sqlite"
BATCH_SIZE=20
MAX_VIDEOS=200
DRY_RUN=0
STATUS_ONLY=0
ENV_FILE="$ROOT_DIR/.env.remote-sync"

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --state-db <path>    Path to state DB (default: $ROOT_DIR/cli/.state/remote_sync.sqlite)
  --batch-size <n>     Pending video IDs processed per batch (default: 20)
  --max-videos <n>     Max pending video IDs per run (default: 200)
  --env-file <path>    Environment file to source (default: $ROOT_DIR/.env.remote-sync)
  --dry-run            Show pending IDs only, no remote mutation
  --status             Print local/state/remote counts only
  -h, --help           Show help

Required env for sync mode (not required for --status):
  REMOTE_SUPABASE_URL
  REMOTE_SUPABASE_SERVICE_ROLE_KEY
  REMOTE_DB_URL
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --state-db)
      STATE_DB="$2"
      shift 2
      ;;
    --batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    --max-videos)
      MAX_VIDEOS="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --status)
      STATUS_ONLY=1
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

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [[ "$BATCH_SIZE" -lt 1 ]]; then
  echo "Error: --batch-size must be a positive integer." >&2
  exit 1
fi

if ! [[ "$MAX_VIDEOS" =~ ^[0-9]+$ ]] || [[ "$MAX_VIDEOS" -lt 1 ]]; then
  echo "Error: --max-videos must be a positive integer." >&2
  exit 1
fi

CMD=(
  uv
  run
  python
  scripts/remote_sync.py
  --state-db "$STATE_DB"
)

if [[ "$STATUS_ONLY" -eq 1 ]]; then
  CMD+=(--status)
else
  for required_env in \
    REMOTE_SUPABASE_URL \
    REMOTE_SUPABASE_SERVICE_ROLE_KEY \
    REMOTE_DB_URL
  do
    if [[ -z "${!required_env:-}" ]]; then
      echo "Error: missing environment variable: $required_env" >&2
      exit 1
    fi
  done

  CMD+=(--batch-size "$BATCH_SIZE" --max-videos "$MAX_VIDEOS")
  if [[ "$DRY_RUN" -eq 1 ]]; then
    CMD+=(--dry-run)
  fi
fi

(
  cd "$ROOT_DIR/cli"
  "${CMD[@]}"
)
