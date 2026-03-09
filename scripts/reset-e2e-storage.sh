#!/bin/bash
set -euo pipefail

WORKDIR="testing/supabase-e2e"
SEED_DIR="testing/supabase-e2e/supabase/storage-seed"
BUCKET="subtitles"
SUPABASE_URL=""

usage() {
  cat <<EOF
Usage: $0 [--workdir <path>] [--seed-dir <path>] [--bucket <name>] [--api-url <url>]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workdir)
      WORKDIR="$2"
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
    --api-url)
      SUPABASE_URL="$2"
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

echo "Clearing storage bucket ${BUCKET}..."
LIST_PAYLOAD='{"prefix":"","limit":1000,"offset":0,"sortBy":{"column":"name","order":"asc"}}'
LIST_RESPONSE="$(curl --fail --silent --show-error \
  -X POST "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "${LIST_PAYLOAD}")"

existing_names="$(echo "$LIST_RESPONSE" | python3 -c 'import json,sys; data=json.load(sys.stdin); [print(item["name"]) for item in data if "name" in item]')"

if [[ -n "$existing_names" ]]; then
  delete_payload="$(
    printf '%s\n' "$existing_names" | python3 -c 'import json,sys; print(json.dumps({"prefixes": [line.strip() for line in sys.stdin if line.strip()]}))'
  )"
  curl --fail --silent --show-error \
    -X DELETE "${SUPABASE_URL}/storage/v1/object/${BUCKET}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "${delete_payload}" >/dev/null
fi

echo "Uploading deterministic storage seeds..."
"./supabase/upload-seed.sh" \
  --workdir "$WORKDIR" \
  --api-url "$SUPABASE_URL" \
  --seed-dir "$SEED_DIR" \
  --bucket "$BUCKET"

expected_names="$(find "$SEED_DIR" -maxdepth 1 -type f -name "*.json" -exec basename {} \; | sort)"
LIST_RESPONSE_AFTER="$(curl --fail --silent --show-error \
  -X POST "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "${LIST_PAYLOAD}")"
actual_names="$(echo "$LIST_RESPONSE_AFTER" | python3 -c 'import json,sys; data=json.load(sys.stdin); [print(item["name"]) for item in data if "name" in item]' | sort)"

expected_csv="$(printf '%s\n' "$expected_names" | sed '/^$/d' | paste -sd "," -)"
actual_csv="$(printf '%s\n' "$actual_names" | sed '/^$/d' | paste -sd "," -)"

if [[ "$expected_csv" != "$actual_csv" ]]; then
  echo "Storage verification failed." >&2
  echo "Expected: $expected_csv" >&2
  echo "Actual:   $actual_csv" >&2
  exit 1
fi

echo "Storage reset and verification complete."
