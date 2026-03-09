#!/bin/bash
set -euo pipefail

WORKDIR="."
SUPABASE_URL=""
SEED_DIR="testing/supabase-e2e/supabase/storage-seed"
BUCKET="subtitles"

usage() {
  cat <<EOF
Usage: $0 [--workdir <path>] [--api-url <url>] [--seed-dir <path>] [--bucket <name>]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workdir)
      WORKDIR="$2"
      shift 2
      ;;
    --api-url)
      SUPABASE_URL="$2"
      shift 2
      ;;
    --seed-dir)
      SEED_DIR="$2"
      shift 2
      ;;
    --bucket)
      BUCKET="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

STATUS_ENV="$(supabase status --workdir "$WORKDIR" -o env)"

extract_status_var() {
  local key="$1"
  echo "$STATUS_ENV" | awk -F= -v key="$key" '$1 == key {print $2}' | sed 's/^"//; s/"$//'
}

if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="$(extract_status_var API_URL)"
fi
SERVICE_ROLE_KEY="$(extract_status_var SERVICE_ROLE_KEY)"

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "Failed to resolve API URL or service role key from supabase status." >&2
  exit 1
fi

seed_files="$(find "$SEED_DIR" -maxdepth 1 -type f -name "*.json" | sort)"
if [[ -z "$seed_files" ]]; then
  echo "No seed files found in $SEED_DIR" >&2
  exit 1
fi

while IFS= read -r file_path; do
  [[ -z "$file_path" ]] && continue
  video_id="$(basename "$file_path" .json)"
  echo "Uploading ${video_id}.json to bucket ${BUCKET}..."
  curl --fail --silent --show-error \
    -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${video_id}.json" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "x-upsert: true" \
    --data-binary @"${file_path}" >/dev/null
done <<< "$seed_files"

echo "Seed upload complete."
