#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILTERED_CSV_PATH="$ROOT_DIR/docs/manual_ko_subtitle_videos_filtered.csv"
WORKSPACE="$ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_filtered_full"
STATE_DB="$ROOT_DIR/cli/.state/direct_remote_sync_filtered.sqlite"
REMOTE_ENV_FILE="$ROOT_DIR/.env.remote-sync"
FORCE=0

usage() {
  cat <<EOF
Usage: $0 [options]

Prepare the filtered canonical ingest workspace and remote sync state DB using the
current local Supabase corpus as the baseline.

Options:
  --filtered-csv <path>   Canonical filtered CSV (default: $FILTERED_CSV_PATH)
  --workspace <path>      New canonical ingest workspace (default: $WORKSPACE)
  --state-db <path>       New canonical remote sync state DB (default: $STATE_DB)
  --remote-env-file <path>
                          Remote Supabase env file for validation
                          (default: $REMOTE_ENV_FILE)
  --force                 Overwrite existing workspace summary/state DB
  -h, --help              Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --filtered-csv)
      FILTERED_CSV_PATH="$2"
      shift 2
      ;;
    --workspace)
      WORKSPACE="$2"
      shift 2
      ;;
    --state-db)
      STATE_DB="$2"
      shift 2
      ;;
    --remote-env-file)
      REMOTE_ENV_FILE="$2"
      shift 2
      ;;
    --force)
      FORCE=1
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

if [[ ! -f "$FILTERED_CSV_PATH" ]]; then
  echo "Error: filtered CSV not found: $FILTERED_CSV_PATH" >&2
  exit 1
fi

if [[ ! -f "$REMOTE_ENV_FILE" ]]; then
  echo "Error: remote env file not found: $REMOTE_ENV_FILE" >&2
  exit 1
fi

if [[ "$FORCE" -ne 1 ]]; then
  if [[ -e "$STATE_DB" ]]; then
    echo "Error: state DB already exists: $STATE_DB (use --force to overwrite)" >&2
    exit 1
  fi
  if [[ -e "$WORKSPACE/run_summary.json" || -e "$WORKSPACE/planned_ids.txt" || -e "$WORKSPACE/succeeded_ids.txt" ]]; then
    echo "Error: workspace already has seeded state: $WORKSPACE (use --force to overwrite)" >&2
    exit 1
  fi
fi

mkdir -p "$WORKSPACE"

(
  cd "$ROOT_DIR/cli"
  uv run python - "$FILTERED_CSV_PATH" "$WORKSPACE" "$STATE_DB" "$REMOTE_ENV_FILE" "$FORCE" <<'PY'
from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

import psycopg2

from kcontext_cli.manual_csv import load_unique_video_ids


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key] = value
    return env


def build_remote_db_url(env: dict[str, str]) -> str:
    remote_db_url = env.get("REMOTE_DB_URL", "").strip()
    remote_project_ref = env.get("REMOTE_PROJECT_REF", "").strip()
    if remote_db_url:
        return remote_db_url
    if not remote_project_ref:
        raise SystemExit("REMOTE_PROJECT_REF or REMOTE_DB_URL is required in remote env file")
    password = quote(os.environ.get("KCONTEXT_REMOTE_DB_PASSWORD", ""), safe="")
    if not password:
        raise SystemExit("REMOTE_DB_URL is not set and KCONTEXT_REMOTE_DB_PASSWORD is missing")
    return (
        f"postgresql://postgres.{remote_project_ref}:{password}"
        f"@db.{remote_project_ref}.supabase.co:5432/postgres?sslmode=require"
    )


def read_filtered_ids(path: Path) -> list[str]:
    try:
        return load_unique_video_ids(path)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc


def fetch_ids(conn: psycopg2.extensions.connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM video ORDER BY published_at DESC NULLS LAST, id")
        return [str(row[0]) for row in cur.fetchall()]


def fetch_counts(conn: psycopg2.extensions.connection) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM video")
        video_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM subtitle")
        subtitle_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'subtitles'")
        storage_count = int(cur.fetchone()[0])
    return {
        "video_count": video_count,
        "subtitle_count": subtitle_count,
        "storage_object_count": storage_count,
    }


def init_state_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS synced_video (
          video_id TEXT PRIMARY KEY,
          synced_at TEXT NOT NULL,
          run_id TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sync_run (
          run_id TEXT PRIMARY KEY,
          started_at TEXT,
          finished_at TEXT,
          total INT,
          success INT,
          failed INT,
          dry_run INT,
          storage_mode TEXT,
          db_strategy TEXT,
          error_summary TEXT
        )
        """
    )
    conn.commit()


filtered_csv = Path(sys.argv[1])
workspace = Path(sys.argv[2])
state_db = Path(sys.argv[3])
remote_env_file = Path(sys.argv[4])
force = sys.argv[5] == "1"

workspace.mkdir(parents=True, exist_ok=True)
for dirname in ("raw", "build", "logs", "supervisor"):
    (workspace / dirname).mkdir(parents=True, exist_ok=True)

planned_ids = read_filtered_ids(filtered_csv)
planned_set = set(planned_ids)

local_conn = psycopg2.connect(
    host=os.getenv("LOCAL_DB_HOST", "127.0.0.1"),
    port=int(os.getenv("LOCAL_DB_PORT", "54322")),
    user=os.getenv("LOCAL_DB_USER", "postgres"),
    password=os.getenv("LOCAL_DB_PASSWORD", "postgres"),
    dbname=os.getenv("LOCAL_DB_NAME", "postgres"),
)
remote_env = load_env_file(remote_env_file)
remote_conn = psycopg2.connect(build_remote_db_url(remote_env))

try:
    local_ids = fetch_ids(local_conn)
    remote_ids = fetch_ids(remote_conn)
    local_counts = fetch_counts(local_conn)
    remote_counts = fetch_counts(remote_conn)
finally:
    local_conn.close()
    remote_conn.close()

local_set = set(local_ids)
remote_set = set(remote_ids)

remote_only = sorted(remote_set - local_set)
if remote_only:
    raise SystemExit(
        "Remote corpus contains video IDs missing locally. "
        f"sample={remote_only[:10]}"
    )

if not local_set <= planned_set:
    stray_ids = sorted(local_set - planned_set)[:10]
    raise SystemExit(
        "Local corpus contains video IDs outside filtered canonical set. "
        f"sample={stray_ids}"
    )

succeeded_ids = [video_id for video_id in planned_ids if video_id in local_set]
remaining_ids = [video_id for video_id in planned_ids if video_id not in local_set]

timestamp = utc_now_iso()
baseline_run_id = f"baseline_filtered_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"

(workspace / "planned_ids.txt").write_text(
    "\n".join(planned_ids) + ("\n" if planned_ids else ""),
    encoding="utf-8",
)
(workspace / "succeeded_ids.txt").write_text(
    "\n".join(succeeded_ids) + ("\n" if succeeded_ids else ""),
    encoding="utf-8",
)
(workspace / "remaining_ids.txt").write_text(
    "\n".join(remaining_ids) + ("\n" if remaining_ids else ""),
    encoding="utf-8",
)
(workspace / "failed_attempts.tsv").write_text(
    "timestamp\tvideo_id\tstage\terror_class\tlog_path\n",
    encoding="utf-8",
)

summary = {
    "csv_path": str(filtered_csv),
    "workspace": str(workspace),
    "fetch_backend": "decodo-scraper",
    "canonical_source": "manual_ko_subtitle_videos_filtered.csv",
    "planned_count": len(planned_ids),
    "succeeded_count": len(succeeded_ids),
    "remaining_count": len(remaining_ids),
    "failed_attempts_count": 0,
    "proxy_mode": "api",
    "proxy_url": "",
    "initialized_at": timestamp,
    "baseline": {
        "local": local_counts,
        "remote": remote_counts,
        "synced_video_count": len(remote_set),
        "local_only_video_ids": sorted(local_set - remote_set)[:20],
        "run_id": baseline_run_id,
    },
    "last_run": {
        "started_at": timestamp,
        "finished_at": timestamp,
        "processed_count": 0,
        "succeeded_count": 0,
        "failed_count": 0,
        "stop_reason": "baseline_seeded",
    },
}
(workspace / "run_summary.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

if force and state_db.exists():
    state_db.unlink()
state_db.parent.mkdir(parents=True, exist_ok=True)
state_conn = sqlite3.connect(state_db)
try:
    init_state_db(state_conn)
    state_conn.execute("DELETE FROM synced_video")
    state_conn.execute("DELETE FROM sync_run")
    state_conn.executemany(
        "INSERT INTO synced_video (video_id, synced_at, run_id) VALUES (?, ?, ?)",
        [(video_id, timestamp, baseline_run_id) for video_id in planned_ids if video_id in remote_set],
    )
    state_conn.execute(
        """
        INSERT INTO sync_run (
          run_id, started_at, finished_at, total, success, failed, dry_run, storage_mode, db_strategy, error_summary
        )
        VALUES (?, ?, ?, ?, ?, 0, 0, 'baseline', 'baseline', '')
        """,
        (
            baseline_run_id,
            timestamp,
            timestamp,
            len(remote_set),
            len(remote_set),
        ),
    )
    state_conn.commit()
finally:
    state_conn.close()

print(
    json.dumps(
        {
            "workspace": str(workspace),
            "state_db": str(state_db),
            "planned_count": len(planned_ids),
            "succeeded_count": len(succeeded_ids),
            "remaining_count": len(remaining_ids),
            "local": local_counts,
            "remote": remote_counts,
            "remote_synced_count": len(remote_set),
            "local_only_count": len(local_set - remote_set),
            "local_only_sample": sorted(local_set - remote_set)[:10],
            "baseline_run_id": baseline_run_id,
        },
        ensure_ascii=False,
        indent=2,
    )
)
PY
)
