#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_SUPABASE_WORKDIR="$ROOT_DIR/testing/supabase-e2e"
FIXTURE_DIR="$ROOT_DIR/testing/cli-integration/raw"
WORKSPACE="$(mktemp -d /tmp/kcontext_integration_XXXXXX)"
DEFAULT_AUDIO_LANGUAGE_CODE="${DEFAULT_AUDIO_LANGUAGE_CODE:-ko}"

cleanup() {
  rm -rf "$WORKSPACE"
  supabase stop --workdir "$E2E_SUPABASE_WORKDIR" --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

extract_status_value() {
  local status_env="$1"
  local key="$2"
  echo "$status_env" | awk -F= -v target="$key" '$1==target{print $2}' | sed 's/^"//; s/"$//'
}

echo "=================================================="
echo "tubelang Fixture-backed Full Stack Integration Test"
echo "Source: local raw fixtures -> CLI build/push -> web E2E"
echo "=================================================="

echo "[1/5] Starting and resetting isolated E2E Supabase stack..."
supabase start --workdir "$E2E_SUPABASE_WORKDIR" --exclude logflare,imgproxy,vector,supavisor
supabase db reset --workdir "$E2E_SUPABASE_WORKDIR" --yes
STATUS_ENV="$(supabase status --workdir "$E2E_SUPABASE_WORKDIR" -o env)"
API_URL="$(extract_status_value "$STATUS_ENV" "API_URL")"
ANON_KEY="$(extract_status_value "$STATUS_ENV" "ANON_KEY")"
SERVICE_ROLE_KEY="$(extract_status_value "$STATUS_ENV" "SERVICE_ROLE_KEY")"
DB_URL="$(extract_status_value "$STATUS_ENV" "DB_URL")"

if [[ -z "$API_URL" || -z "$ANON_KEY" || -z "$SERVICE_ROLE_KEY" || -z "$DB_URL" ]]; then
  echo "Failed to resolve E2E Supabase status env." >&2
  exit 1
fi

eval "$(
  python3 - "$DB_URL" <<'PY'
import shlex
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
values = {
    "DB_HOST": parsed.hostname or "",
    "DB_PORT": str(parsed.port or 5432),
    "DB_USER": parsed.username or "",
    "DB_PASSWORD": parsed.password or "",
    "DB_NAME": parsed.path.lstrip("/") or "postgres",
}
for key, value in values.items():
    print(f"export {key}={shlex.quote(value)}")
PY
)"

export SUPABASE_URL="$API_URL"
export SUPABASE_SECRET_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export NEXT_PUBLIC_CDN_URL="$API_URL/storage/v1/object/public"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3410}"
export CI="true"
echo "  ✓ E2E stack is ready"

echo "[2/5] Building and pushing fixture raw files through CLI..."
mkdir -p "$WORKSPACE/build"
LOADED=0
for RAW_PATH in "$FIXTURE_DIR"/*_raw.json; do
  [[ -f "$RAW_PATH" ]] || continue
  VIDEO_ID="$(
    python3 - "$RAW_PATH" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as raw_file:
    print(json.load(raw_file)["video_id"])
PY
  )"

  (
    cd "$ROOT_DIR/cli"
    uv run tubelang build "$RAW_PATH" -d "$WORKSPACE/build" \
      --default-audio-language-code "$DEFAULT_AUDIO_LANGUAGE_CODE"
    uv run tubelang push \
      -s "$WORKSPACE/build/${VIDEO_ID}_storage.json" \
      -vc "$WORKSPACE/build/${VIDEO_ID}_video.csv" \
      -sc "$WORKSPACE/build/${VIDEO_ID}_subtitle.csv" \
      --default-audio-language-code "$DEFAULT_AUDIO_LANGUAGE_CODE"
  )

  LOADED=$((LOADED + 1))
done

if [[ "$LOADED" -eq 0 ]]; then
  echo "No fixture raw files found in $FIXTURE_DIR" >&2
  exit 1
fi
echo "  ✓ Loaded $LOADED fixture videos via CLI build/push"

echo "[3/5] Verifying database search results..."
(
  cd "$ROOT_DIR/cli"
  DB_URL="$DB_URL" DEFAULT_AUDIO_LANGUAGE_CODE="$DEFAULT_AUDIO_LANGUAGE_CODE" uv run python - <<'PY'
import os
import psycopg2

db_url = os.environ["DB_URL"]
language_code = os.environ["DEFAULT_AUDIO_LANGUAGE_CODE"]
queries = {
    "떡볶이": 1,
    "전분당": 1,
    "죽마고우": 1,
    "과징금": 1,
    "어쩔티비": 0,
}

with psycopg2.connect(db_url) as conn, conn.cursor() as cur:
    for keyword, minimum in queries.items():
        cur.execute(
            "SELECT count(*) FROM search_subtitles(%s, %s)",
            (keyword, language_code),
        )
        count = int(cur.fetchone()[0])
        if minimum == 0:
            if count != 0:
                raise SystemExit(f"Expected 0 results for {keyword!r}, got {count}")
        elif count < minimum:
            raise SystemExit(f"Expected at least {minimum} result(s) for {keyword!r}, got {count}")
        print(f"{keyword}={count}")
PY
)
echo "  ✓ Search RPC returns expected fixture-backed results"

echo "[4/5] Running Playwright integration tests..."
(
  cd "$ROOT_DIR/web"
  pnpm test:e2e:real
)
echo "  ✓ All Playwright integration tests passed"

echo "[5/5] Cleaning up..."
rm -rf "$WORKSPACE"
echo "  ✓ Workspace cleaned"

echo ""
echo "=================================================="
echo "✅ FIXTURE-BACKED FULL STACK INTEGRATION TEST PASSED"
echo "=================================================="
