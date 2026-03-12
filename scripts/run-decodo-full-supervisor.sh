#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_full"
DECORDO_ENV_FILE="$ROOT_DIR/.env.decodo"
REMOTE_ENV_FILE="$ROOT_DIR/.env.remote-sync"
PARALLEL_RUNNER="$ROOT_DIR/scripts/run-manual-csv-ingest-parallel.sh"
DIRECT_SYNC_WORKER="$ROOT_DIR/.agents/skills/supabase-direct-remote-sync/scripts/direct_remote_sync.py"
DIRECT_SYNC_STATE_DB="$ROOT_DIR/cli/.state/direct_remote_sync.sqlite"
SUPERVISOR_DIR="$WORKSPACE/supervisor"
INGEST_SUMMARY_PATH="$WORKSPACE/run_summary.json"
INGEST_LOG=""
SUPERVISOR_LOG=""
INGEST_CONCURRENCY=12
INGEST_MAX_VIDEOS=5000
HEALTHCHECK_INTERVAL_SECONDS=300
STALL_THRESHOLD_SECONDS=900
RATE_LIMIT_COOLDOWN_SECONDS=300
REMOTE_BATCH_SIZE=25
REMOTE_MAX_VIDEOS=150
REMOTE_STORAGE_MODE="auto"
REMOTE_DB_PASSWORD="${KCONTEXT_REMOTE_DB_PASSWORD:-}"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --workspace <path>                    Main ingest workspace
                                        (default: $ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_full)
  --decodo-env-file <path>              Decodo scraper env file
                                        (default: $ROOT_DIR/.env.decodo)
  --remote-env-file <path>              Remote sync env file
                                        (default: $ROOT_DIR/.env.remote-sync)
  --ingest-concurrency <n>              Initial Decodo worker count (default: 12)
  --ingest-max-videos <n>               Max videos per ingest run (default: 5000)
  --healthcheck-interval-seconds <n>    Progress check interval (default: 300)
  --stall-threshold-seconds <n>         Restart ingest after no progress for this long (default: 900)
  --rate-limit-cooldown-seconds <n>     Wait before retry after rate limiting (default: 300)
  --remote-batch-size <n>               Direct remote sync batch size (default: 25)
  --remote-max-videos <n>               Direct remote sync max videos per run (default: 150)
  --remote-storage-mode <mode>          auto | s3 | rest (default: auto)
  -h, --help                            Show help

Environment:
  KCONTEXT_REMOTE_DB_PASSWORD           Remote DB password for the supervisor run
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      WORKSPACE="$2"
      shift 2
      ;;
    --decodo-env-file)
      DECORDO_ENV_FILE="$2"
      shift 2
      ;;
    --remote-env-file)
      REMOTE_ENV_FILE="$2"
      shift 2
      ;;
    --ingest-concurrency)
      INGEST_CONCURRENCY="$2"
      shift 2
      ;;
    --ingest-max-videos)
      INGEST_MAX_VIDEOS="$2"
      shift 2
      ;;
    --healthcheck-interval-seconds)
      HEALTHCHECK_INTERVAL_SECONDS="$2"
      shift 2
      ;;
    --stall-threshold-seconds)
      STALL_THRESHOLD_SECONDS="$2"
      shift 2
      ;;
    --rate-limit-cooldown-seconds)
      RATE_LIMIT_COOLDOWN_SECONDS="$2"
      shift 2
      ;;
    --remote-batch-size)
      REMOTE_BATCH_SIZE="$2"
      shift 2
      ;;
    --remote-max-videos)
      REMOTE_MAX_VIDEOS="$2"
      shift 2
      ;;
    --remote-storage-mode)
      REMOTE_STORAGE_MODE="$2"
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

for pair in \
  "INGEST_CONCURRENCY:$INGEST_CONCURRENCY" \
  "INGEST_MAX_VIDEOS:$INGEST_MAX_VIDEOS" \
  "HEALTHCHECK_INTERVAL_SECONDS:$HEALTHCHECK_INTERVAL_SECONDS" \
  "STALL_THRESHOLD_SECONDS:$STALL_THRESHOLD_SECONDS" \
  "RATE_LIMIT_COOLDOWN_SECONDS:$RATE_LIMIT_COOLDOWN_SECONDS" \
  "REMOTE_BATCH_SIZE:$REMOTE_BATCH_SIZE" \
  "REMOTE_MAX_VIDEOS:$REMOTE_MAX_VIDEOS"
do
  name="${pair%%:*}"
  value="${pair#*:}"
  if ! [[ "$value" =~ ^[0-9]+$ ]] || [[ "$value" -lt 1 ]]; then
    echo "Error: $name must be a positive integer." >&2
    exit 1
  fi
done

case "$REMOTE_STORAGE_MODE" in
  auto|s3|rest)
    ;;
  *)
    echo "Error: --remote-storage-mode must be auto, s3, or rest." >&2
    exit 1
    ;;
esac

if [[ ! -x "$PARALLEL_RUNNER" ]]; then
  echo "Error: parallel ingest runner not found or not executable: $PARALLEL_RUNNER" >&2
  exit 1
fi

if [[ ! -f "$DECORDO_ENV_FILE" ]]; then
  echo "Error: Decodo env file not found: $DECORDO_ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$REMOTE_ENV_FILE" ]]; then
  echo "Error: remote env file not found: $REMOTE_ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$DIRECT_SYNC_WORKER" ]]; then
  echo "Error: direct sync worker not found: $DIRECT_SYNC_WORKER" >&2
  exit 1
fi

if [[ -z "$REMOTE_DB_PASSWORD" ]]; then
  if [[ -t 0 ]]; then
    read -r -s -p "Remote DB password: " REMOTE_DB_PASSWORD
    echo
  else
    echo "Error: KCONTEXT_REMOTE_DB_PASSWORD is required for unattended remote sync." >&2
    exit 1
  fi
fi

mkdir -p "$WORKSPACE" "$SUPERVISOR_DIR"
INGEST_SUMMARY_PATH="$WORKSPACE/run_summary.json"
RUN_STAMP="$(date +%Y%m%d_%H%M%S)"
INGEST_LOG="$SUPERVISOR_DIR/ingest_${RUN_STAMP}.log"
SUPERVISOR_LOG="$SUPERVISOR_DIR/supervisor_${RUN_STAMP}.log"

log() {
  local message="$1"
  local timestamp=""
  timestamp="$(date +"%Y-%m-%d %H:%M:%S %Z")"
  printf "[%s] %s\n" "$timestamp" "$message" | tee -a "$SUPERVISOR_LOG"
}

load_remote_env() {
  set -a
  # shellcheck source=/dev/null
  source "$REMOTE_ENV_FILE"
  set +a
}

build_remote_db_url() {
  python3 - "${REMOTE_PROJECT_REF:-}" "${REMOTE_DB_URL:-}" "$REMOTE_DB_PASSWORD" <<'PY'
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
}

cleanup_stale_parallel_state() {
  python3 - "$WORKSPACE" <<'PY'
import json
import os
import shutil
import sys
from pathlib import Path

workspace = Path(sys.argv[1])
lock_path = workspace / ".parallel_orchestrator.lock"
pid = 0
if lock_path.exists():
    try:
        pid = int(json.loads(lock_path.read_text(encoding="utf-8")).get("pid", 0))
    except Exception:
        pid = 0

alive = False
if pid > 0:
    try:
        os.kill(pid, 0)
        alive = True
    except OSError:
        alive = False

if alive:
    raise SystemExit(f"parallel ingest still running pid={pid}")

for path in (
    workspace / ".parallel_orchestrator.lock",
    workspace / ".parallel_stop_reason",
    workspace / ".parallel_in_flight_ids.txt",
):
    path.unlink(missing_ok=True)

for path in workspace.glob(".parallel_worker.*"):
    if path.is_dir():
        shutil.rmtree(path)
PY
}

read_ingest_state() {
  python3 - "$INGEST_SUMMARY_PATH" <<'PY'
import json
import sys
from pathlib import Path

summary_path = Path(sys.argv[1])
summary = json.loads(summary_path.read_text(encoding="utf-8"))
last_run = summary.get("last_run", {})
print(summary.get("planned_count", 0))
print(summary.get("succeeded_count", 0))
print(summary.get("remaining_count", 0))
print(last_run.get("stop_reason", "unknown"))
print(last_run.get("finished_at", ""))
PY
}

bootstrap_ingest_state() {
  planned_count=0
  succeeded_count=0
  remaining_count=1
  last_stop_reason="bootstrap"
  last_finished_at=""
}

load_ingest_state() {
  local raw=""
  raw="$(read_ingest_state)"
  planned_count="$(printf '%s\n' "$raw" | sed -n '1p')"
  succeeded_count="$(printf '%s\n' "$raw" | sed -n '2p')"
  remaining_count="$(printf '%s\n' "$raw" | sed -n '3p')"
  last_stop_reason="$(printf '%s\n' "$raw" | sed -n '4p')"
  last_finished_at="$(printf '%s\n' "$raw" | sed -n '5p')"
}

read_remote_status() {
  REMOTE_DB_URL_FILLED="$REMOTE_DB_URL_FILLED" \
  REMOTE_ENV_FILE_LOCAL="$REMOTE_ENV_FILE" \
  python3 - "$DIRECT_SYNC_STATE_DB" "$REMOTE_STORAGE_MODE" "$DIRECT_SYNC_WORKER" <<'PY'
import json
import os
import subprocess
import sys
from pathlib import Path

state_db = sys.argv[1]
storage_mode = sys.argv[2]
worker = sys.argv[3]
env_file = os.environ["REMOTE_ENV_FILE_LOCAL"]
remote_db_url = os.environ["REMOTE_DB_URL_FILLED"]

env = os.environ.copy()
for line in Path(env_file).read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        continue
    key, value = stripped.split("=", 1)
    env[key] = value
env["REMOTE_DB_URL"] = remote_db_url

proc = subprocess.run(
    [
        "uv",
        "run",
        "--with",
        "boto3",
        "python",
        worker,
        "--state-db",
        state_db,
        "--storage-mode",
        storage_mode,
        "--status",
    ],
    check=True,
    capture_output=True,
    text=True,
    env=env,
    cwd=str(Path(worker).parents[4] / "cli"),
)
print(proc.stdout.strip())
PY
}

run_remote_batch() {
  local max_videos="$1"
  REMOTE_DB_URL_FILLED="$REMOTE_DB_URL_FILLED" \
  REMOTE_ENV_FILE_LOCAL="$REMOTE_ENV_FILE" \
  python3 - "$DIRECT_SYNC_STATE_DB" "$REMOTE_STORAGE_MODE" "$DIRECT_SYNC_WORKER" "$REMOTE_BATCH_SIZE" "$max_videos" <<'PY'
import os
import subprocess
import sys
from pathlib import Path

state_db = sys.argv[1]
storage_mode = sys.argv[2]
worker = sys.argv[3]
batch_size = sys.argv[4]
max_videos = sys.argv[5]
env_file = os.environ["REMOTE_ENV_FILE_LOCAL"]
remote_db_url = os.environ["REMOTE_DB_URL_FILLED"]

env = os.environ.copy()
for line in Path(env_file).read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        continue
    key, value = stripped.split("=", 1)
    env[key] = value
env["REMOTE_DB_URL"] = remote_db_url

proc = subprocess.run(
    [
        "uv",
        "run",
        "--with",
        "boto3",
        "python",
        worker,
        "--state-db",
        state_db,
        "--storage-mode",
        storage_mode,
        "--batch-size",
        batch_size,
        "--max-videos",
        max_videos,
    ],
    capture_output=True,
    text=True,
    env=env,
    cwd=str(Path(worker).parents[4] / "cli"),
)
sys.stdout.write(proc.stdout)
sys.stderr.write(proc.stderr)
raise SystemExit(proc.returncode)
PY
}

latest_direct_report() {
  ls -t "$ROOT_DIR"/cli/.state/direct-runs/*.json 2>/dev/null | head -n 1
}

load_remote_env
if [[ -z "${REMOTE_PROJECT_REF:-}" || -z "${REMOTE_SUPABASE_URL:-}" || -z "${REMOTE_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Error: .env.remote-sync is missing required values." >&2
  exit 1
fi
REMOTE_DB_URL_FILLED="$(build_remote_db_url)"

log "Supervisor started."
log "Workspace: $WORKSPACE"
log "Initial ingest concurrency: $INGEST_CONCURRENCY"
log "Ingest log: $INGEST_LOG"
log "Remote sync state DB: $DIRECT_SYNC_STATE_DB"

current_concurrency="$INGEST_CONCURRENCY"

while true; do
  if [[ -f "$INGEST_SUMMARY_PATH" ]]; then
    load_ingest_state
  else
    bootstrap_ingest_state
  fi

  if [[ "$remaining_count" -eq 0 ]]; then
    log "Local ingest already complete: planned=$planned_count succeeded=$succeeded_count"
    break
  fi

  cleanup_stale_parallel_state

  log "Starting ingest pass: remaining=$remaining_count concurrency=$current_concurrency"
  bash "$PARALLEL_RUNNER" \
    --workspace "$WORKSPACE" \
    --max-videos "$INGEST_MAX_VIDEOS" \
    --concurrency "$current_concurrency" \
    --env-file "$DECORDO_ENV_FILE" >>"$INGEST_LOG" 2>&1 &
  ingest_pid="$!"

  last_progress_count="$succeeded_count"
  last_progress_epoch="$(date +%s)"

  while kill -0 "$ingest_pid" 2>/dev/null; do
    sleep "$HEALTHCHECK_INTERVAL_SECONDS"
    load_ingest_state

    if [[ "$succeeded_count" -gt "$last_progress_count" ]]; then
      log "Ingest progress: succeeded=$succeeded_count remaining=$remaining_count"
      last_progress_count="$succeeded_count"
      last_progress_epoch="$(date +%s)"
      continue
    fi

    now_epoch="$(date +%s)"
    stalled_for=$((now_epoch - last_progress_epoch))
    log "Health check: no new success yet, stalled_for=${stalled_for}s remaining=$remaining_count"

    if [[ "$stalled_for" -ge "$STALL_THRESHOLD_SECONDS" ]]; then
      log "Ingest stalled for ${stalled_for}s. Restarting current ingest pass."
      kill "$ingest_pid" 2>/dev/null || true
      sleep 2
      kill -9 "$ingest_pid" 2>/dev/null || true
      wait "$ingest_pid" 2>/dev/null || true
      cleanup_stale_parallel_state
      break
    fi
  done

  if kill -0 "$ingest_pid" 2>/dev/null; then
    wait "$ingest_pid"
  else
    wait "$ingest_pid" 2>/dev/null || true
  fi

  if [[ ! -f "$INGEST_SUMMARY_PATH" ]]; then
    log "Ingest runner exited before creating $INGEST_SUMMARY_PATH."
    exit 1
  fi

  load_ingest_state
  log "Ingest pass ended: succeeded=$succeeded_count remaining=$remaining_count stop_reason=$last_stop_reason"

  case "$last_stop_reason" in
    completed)
      if [[ "$remaining_count" -eq 0 ]]; then
        break
      fi
      ;;
    api_budget_exhausted|api_auth_failed)
      log "Fatal ingest stop reason: $last_stop_reason"
      exit 1
      ;;
    api_rate_limited)
      if [[ "$current_concurrency" -gt 8 ]]; then
        current_concurrency=8
        log "Rate limited. Reducing concurrency to $current_concurrency."
      fi
      log "Cooling down for ${RATE_LIMIT_COOLDOWN_SECONDS}s before ingest retry."
      sleep "$RATE_LIMIT_COOLDOWN_SECONDS"
      ;;
    *)
      log "Non-fatal ingest stop_reason=$last_stop_reason. Retrying after short delay."
      sleep 30
      ;;
  esac
done

log "Local ingest complete. Starting remote sync."

remote_batch_max="$REMOTE_MAX_VIDEOS"
while true; do
  remote_status_json="$(read_remote_status)"
  pending_estimate="$(
    printf '%s\n' "$remote_status_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"]["pending_estimate"])'
  )"
  local_video_count="$(
    printf '%s\n' "$remote_status_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["local"]["video_count"])'
  )"
  remote_video_count="$(
    printf '%s\n' "$remote_status_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["remote"]["video_count"])'
  )"

  log "Remote sync status: local_video=$local_video_count remote_video=$remote_video_count pending=$pending_estimate batch_max=$remote_batch_max"

  if [[ "$pending_estimate" -eq 0 ]]; then
    break
  fi

  if run_output="$(run_remote_batch "$remote_batch_max" 2>&1)"; then
    printf '%s\n' "$run_output" | tee -a "$SUPERVISOR_LOG"
    remote_batch_max="$REMOTE_MAX_VIDEOS"
    continue
  fi

  printf '%s\n' "$run_output" | tee -a "$SUPERVISOR_LOG"
  latest_report="$(latest_direct_report)"
  fatal_error=""
  if [[ -n "$latest_report" ]]; then
    fatal_error="$(
      python3 - "$latest_report" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
failures = report.get("failures", [])
if failures:
    print(failures[0].get("error", ""))
else:
    print("")
PY
    )"
  fi

  if [[ "$fatal_error" == *"timed out"* || "$fatal_error" == *"read operation timed out"* ]]; then
    if [[ "$remote_batch_max" -gt 50 ]]; then
      remote_batch_max=50
    fi
    log "Remote sync timed out. Retrying with smaller batch_max=$remote_batch_max."
    continue
  fi

  log "Remote sync failed with non-recoverable error: ${fatal_error:-unknown}"
  exit 1
done

final_remote_status="$(read_remote_status)"
printf '%s\n' "$final_remote_status" | tee -a "$SUPERVISOR_LOG"
log "Supervisor finished successfully."
