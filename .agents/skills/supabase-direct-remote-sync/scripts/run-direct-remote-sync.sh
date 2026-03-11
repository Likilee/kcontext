#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SKILL_DIR="$ROOT_DIR/.agents/skills/supabase-direct-remote-sync"
STATE_DB="$ROOT_DIR/cli/.state/direct_remote_sync.sqlite"
ENV_FILE="$ROOT_DIR/.env.remote-sync"
BATCH_SIZE=50
MAX_VIDEOS=200
STORAGE_MODE="auto"
STATUS_ONLY=0
DRY_RUN=0
RESYNC_ALL=0

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --state-db <path>      Sync state DB (default: $ROOT_DIR/cli/.state/direct_remote_sync.sqlite)
  --env-file <path>      Remote env file (default: $ROOT_DIR/.env.remote-sync)
  --batch-size <n>       Videos per batch (default: 50)
  --max-videos <n>       Max videos per run (default: 200)
  --storage-mode <mode>  auto | s3 | rest (default: auto)
  --status               Print local/state/remote counts only
  --dry-run              Show pending IDs only
  --resync-all           Ignore sync state and upsert all local videos
  -h, --help             Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --state-db)
      STATE_DB="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
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
    --storage-mode)
      STORAGE_MODE="$2"
      shift 2
      ;;
    --status)
      STATUS_ONLY=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --resync-all)
      RESYNC_ALL=1
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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi

if [[ "$STORAGE_MODE" != "auto" && "$STORAGE_MODE" != "s3" && "$STORAGE_MODE" != "rest" ]]; then
  echo "Error: --storage-mode must be one of auto, s3, rest." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ -z "${REMOTE_PROJECT_REF:-}" ]]; then
  echo "Error: REMOTE_PROJECT_REF is required in $ENV_FILE" >&2
  exit 1
fi

read -r -s -p "Remote DB password for ${REMOTE_PROJECT_REF}: " REMOTE_DB_PASSWORD
echo

REMOTE_DB_URL_FILLED="$(
  python3 - "${REMOTE_PROJECT_REF}" "${REMOTE_DB_URL:-}" "${REMOTE_DB_PASSWORD}" <<'PY'
import sys
from urllib.parse import quote

project_ref = sys.argv[1]
existing = sys.argv[2].strip()
password = quote(sys.argv[3], safe="")

if existing:
    if "@" in existing and "://" in existing:
        prefix, suffix = existing.split("://", 1)
        creds, rest = suffix.split("@", 1)
        if ":" in creds:
            user, _ = creds.split(":", 1)
        else:
            user = creds
        print(f"{prefix}://{user}:{password}@{rest}")
    else:
        print(existing)
else:
    print(
        f"postgresql://postgres.{project_ref}:{password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require"
    )
PY
)"

CMD=(
  uv
  run
  --with
  boto3
  python
  "$SKILL_DIR/scripts/direct_remote_sync.py"
  --state-db "$STATE_DB"
  --batch-size "$BATCH_SIZE"
  --max-videos "$MAX_VIDEOS"
  --storage-mode "$STORAGE_MODE"
)

if [[ "$STATUS_ONLY" -eq 1 ]]; then
  CMD+=(--status)
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  CMD+=(--dry-run)
fi

if [[ "$RESYNC_ALL" -eq 1 ]]; then
  CMD+=(--resync-all)
fi

(
  cd "$ROOT_DIR/cli"
  export REMOTE_DB_URL="$REMOTE_DB_URL_FILLED"
  "${CMD[@]}"
)
