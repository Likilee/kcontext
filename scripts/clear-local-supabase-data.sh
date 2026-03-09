#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="$ROOT_DIR"
BUCKET="subtitles"
STATE_DB="$ROOT_DIR/cli/.state/remote_sync.sqlite"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --workdir <path>    Supabase workdir (default: $ROOT_DIR)
  --bucket <name>     Storage bucket to clear (default: subtitles)
  --state-db <path>   Remote sync state DB to remove (default: $ROOT_DIR/cli/.state/remote_sync.sqlite)
  -h, --help          Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workdir)
      WORKDIR="$2"
      shift 2
      ;;
    --bucket)
      BUCKET="$2"
      shift 2
      ;;
    --state-db)
      STATE_DB="$2"
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

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI is required." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required." >&2
  exit 1
fi

STATUS_ENV="$(supabase status --workdir "$WORKDIR" -o env)"

extract_status_var() {
  local key="$1"
  echo "$STATUS_ENV" | awk -F= -v key="$key" '$1 == key {print $2}' | sed 's/^"//; s/"$//'
}

API_URL="$(extract_status_var API_URL)"
SERVICE_ROLE_KEY="$(extract_status_var SERVICE_ROLE_KEY)"
DB_URL="$(extract_status_var DB_URL)"

if [[ -z "$API_URL" || -z "$SERVICE_ROLE_KEY" || -z "$DB_URL" ]]; then
  echo "Error: failed to resolve API URL, service role key, or DB URL from supabase status." >&2
  exit 1
fi

echo "Truncating local database tables..."
(
  cd "$ROOT_DIR/cli"
  uv run python - "$DB_URL" <<'PY'
import sys

import psycopg2

db_url = sys.argv[1]
with psycopg2.connect(db_url) as conn:
    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE subtitle, video RESTART IDENTITY CASCADE")
PY
)

echo "Clearing storage bucket ${BUCKET}..."
python3 - "$API_URL" "$SERVICE_ROLE_KEY" "$BUCKET" <<'PY'
import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

api_url = sys.argv[1].rstrip("/")
service_role_key = sys.argv[2]
bucket = sys.argv[3]

headers = {
    "Authorization": f"Bearer {service_role_key}",
    "apikey": service_role_key,
    "Content-Type": "application/json",
}
list_url = f"{api_url}/storage/v1/object/list/{bucket}"
delete_url = f"{api_url}/storage/v1/object/{bucket}"
list_payload = json.dumps(
    {
        "prefix": "",
        "limit": 1000,
        "offset": 0,
        "sortBy": {"column": "name", "order": "asc"},
    }
).encode("utf-8")

while True:
    request = Request(list_url, method="POST", headers=headers, data=list_payload)
    with urlopen(request) as response:
        objects = json.loads(response.read().decode("utf-8"))

    names = [item["name"] for item in objects if "name" in item]
    if not names:
        break

    delete_payload = json.dumps({"prefixes": names}).encode("utf-8")
    request = Request(delete_url, method="DELETE", headers=headers, data=delete_payload)
    try:
        with urlopen(request):
            pass
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"Error: failed to delete storage objects: HTTP {exc.code}: {detail}")
PY

STATE_DIR="$(dirname "$STATE_DB")"
echo "Removing remote sync state..."
rm -f "$STATE_DB" "$STATE_DIR/remote_sync.lock"
rm -rf "$STATE_DIR/runs"

echo "Verifying local state..."
(
  cd "$ROOT_DIR/cli"
  uv run python - "$DB_URL" "$BUCKET" "$STATE_DB" <<'PY'
import json
import sqlite3
import sys
from pathlib import Path

import psycopg2

db_url = sys.argv[1]
bucket = sys.argv[2]
state_db = Path(sys.argv[3])

with psycopg2.connect(db_url) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM video")
        video_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM subtitle")
        subtitle_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM storage.objects WHERE bucket_id = %s", (bucket,))
        storage_count = int(cur.fetchone()[0])

if state_db.exists():
    with sqlite3.connect(state_db) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'synced_video'"
        )
        has_synced_video = int(cur.fetchone()[0]) == 1
        if has_synced_video:
            cur.execute("SELECT COUNT(*) FROM synced_video")
            synced_count = int(cur.fetchone()[0])
        else:
            synced_count = 0
else:
    synced_count = 0

payload = {
    "video_count": video_count,
    "subtitle_count": subtitle_count,
    "storage_object_count": storage_count,
    "synced_video_count": synced_count,
}

print(json.dumps(payload, ensure_ascii=False, indent=2))

if payload != {
    "video_count": 0,
    "subtitle_count": 0,
    "storage_object_count": 0,
    "synced_video_count": 0,
}:
    raise SystemExit(1)
PY
)

echo "Local Supabase data cleared."
