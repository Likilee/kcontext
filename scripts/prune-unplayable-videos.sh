#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSV_PATH="$ROOT_DIR/docs/unplayable_videos.csv"
TARGET="local"
ENV_FILE=""
APPLY=0
BATCH_SIZE=100

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --csv <path>         Unplayable CSV path (default: $ROOT_DIR/docs/unplayable_videos.csv)
  --target <name>      local | remote (default: local)
  --env-file <path>    Environment file to source
                       (default local: $ROOT_DIR/cli/.env)
                       (default remote: $ROOT_DIR/.env.remote-sync)
  --batch-size <n>     Batch size for DB/storage prune requests (default: 100)
  --apply              Actually delete DB rows and storage objects
  -h, --help           Show help

Without --apply, the script prints a dry-run summary only.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv)
      CSV_PATH="$2"
      shift 2
      ;;
    --target)
      TARGET="$2"
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
    --apply)
      APPLY=1
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

case "$TARGET" in
  local|remote)
    ;;
  *)
    echo "Error: --target must be 'local' or 'remote'." >&2
    exit 1
    ;;
esac

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [[ "$BATCH_SIZE" -lt 1 ]]; then
  echo "Error: --batch-size must be a positive integer." >&2
  exit 1
fi

if [[ ! -f "$CSV_PATH" ]]; then
  echo "Error: CSV file not found: $CSV_PATH" >&2
  exit 1
fi

if [[ -z "$ENV_FILE" ]]; then
  if [[ "$TARGET" == "remote" ]]; then
    ENV_FILE="$ROOT_DIR/.env.remote-sync"
  else
    ENV_FILE="$ROOT_DIR/cli/.env"
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

CMD=(
  uv
  run
  python
  -m
  kcontext_cli.prune_unplayable_videos
  --csv "$CSV_PATH"
  --target "$TARGET"
  --batch-size "$BATCH_SIZE"
)

if [[ "$APPLY" -eq 1 ]]; then
  CMD+=(--apply)
fi

(
  cd "$ROOT_DIR/cli"
  "${CMD[@]}"
)
