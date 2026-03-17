#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_CSV_PATH="$ROOT_DIR/docs/manual_ko_subtitle_videos.csv"
DEFAULT_CSV_PATH="$ROOT_DIR/docs/manual_ko_subtitle_videos_filtered.csv"
WORKSPACE="$ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_filtered_full"
MAX_VIDEOS=500
CONCURRENCY=4
ENV_FILE="$ROOT_DIR/.env.decodo"
FETCH_BACKEND="decodo-scraper"
RUNNER="$ROOT_DIR/scripts/run-manual-csv-ingest-via-decodo-scraper.sh"
STATE_LOCK_PATH=""
ORCHESTRATOR_LOCK_PATH=""
IN_FLIGHT_PATH=""
STOP_REASON_PATH=""
SKIPPED_IDS_PATH=""
RUN_STARTED_AT=""
TOTAL_CLAIMED=0
TOTAL_COMPLETED=0
TOTAL_SUCCEEDED=0
TOTAL_FAILED=0
NO_MORE_WORK=0
GLOBAL_STOP_REASON=""
WORKERS_DECLARED=0

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --workspace <path>       Main workspace to use as source of truth
                           (default: $ROOT_DIR/cli/.state/manual_csv_ingest/manual_ko_filtered_full)
                           Default source CSV: $ROOT_DIR/docs/manual_ko_subtitle_videos_filtered.csv
  --max-videos <n>         Maximum number of videos to process in this run (default: 500)
  --concurrency <n>        Number of concurrent workers (default: 4)
  --env-file <path>        Decodo env file to source (default: $ROOT_DIR/.env.decodo)
  --fetch-backend <name>   Fetch backend, fixed to decodo-scraper in v1
                           (default: decodo-scraper)
  -h, --help               Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      WORKSPACE="$2"
      shift 2
      ;;
    --max-videos)
      MAX_VIDEOS="$2"
      shift 2
      ;;
    --concurrency)
      CONCURRENCY="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --fetch-backend)
      FETCH_BACKEND="$2"
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

if ! [[ "$MAX_VIDEOS" =~ ^[0-9]+$ ]] || [[ "$MAX_VIDEOS" -lt 1 ]]; then
  echo "Error: --max-videos must be a positive integer." >&2
  exit 1
fi

if ! [[ "$CONCURRENCY" =~ ^[0-9]+$ ]] || [[ "$CONCURRENCY" -lt 1 ]]; then
  echo "Error: --concurrency must be a positive integer." >&2
  exit 1
fi

if [[ "$FETCH_BACKEND" != "decodo-scraper" ]]; then
  echo "Error: --fetch-backend is fixed to 'decodo-scraper' in this parallel runner." >&2
  exit 1
fi

if [[ ! -x "$RUNNER" ]]; then
  echo "Error: runner script not found or not executable: $RUNNER" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi

(
  cd "$ROOT_DIR/cli"
  uv run python -m kcontext_cli.manual_csv_source \
    --selected "$DEFAULT_CSV_PATH" \
    --raw "$RAW_CSV_PATH" \
    --filtered "$DEFAULT_CSV_PATH"
)

mkdir -p "$WORKSPACE" "$WORKSPACE/raw" "$WORKSPACE/build" "$WORKSPACE/logs"
STATE_LOCK_PATH="$WORKSPACE/.parallel_ingest.lock"
ORCHESTRATOR_LOCK_PATH="$WORKSPACE/.parallel_orchestrator.lock"
IN_FLIGHT_PATH="$WORKSPACE/.parallel_in_flight_ids.txt"
STOP_REASON_PATH="$WORKSPACE/.parallel_stop_reason"
SKIPPED_IDS_PATH="$WORKSPACE/skipped_ids.txt"
RUN_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cleanup() {
  if [[ "$WORKERS_DECLARED" -eq 1 ]]; then
    terminate_active_workers
  fi
  if [[ -n "$IN_FLIGHT_PATH" ]]; then
    : > "$IN_FLIGHT_PATH" 2>/dev/null || true
  fi
  rm -f "$ORCHESTRATOR_LOCK_PATH" "$STOP_REASON_PATH"
}
trap cleanup EXIT

acquire_orchestrator_lock() {
  python3 - "$ORCHESTRATOR_LOCK_PATH" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

lock_path = Path(sys.argv[1])
lock_path.parent.mkdir(parents=True, exist_ok=True)
if lock_path.exists():
    try:
        payload = json.loads(lock_path.read_text(encoding="utf-8"))
        pid = int(payload.get("pid", 0))
    except Exception:
        pid = 0

    if pid > 0:
        try:
            os.kill(pid, 0)
        except OSError:
            pid = 0

    if pid > 0:
        raise SystemExit(f"Error: another parallel ingest orchestrator is running (pid={pid}).")

    lock_path.unlink(missing_ok=True)

fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
with os.fdopen(fd, "w", encoding="utf-8") as file_obj:
    json.dump(
        {
            "pid": os.getpid(),
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
        file_obj,
    )
PY
}

ensure_workspace_state() {
  PYTHONPATH="$ROOT_DIR/cli/src${PYTHONPATH:+:$PYTHONPATH}" python3 - "$WORKSPACE" "$DEFAULT_CSV_PATH" <<'PY'
import json
import sys
from pathlib import Path

from kcontext_cli.manual_csv import load_unique_video_ids

workspace = Path(sys.argv[1])
default_csv_path = Path(sys.argv[2])
planned_path = workspace / "planned_ids.txt"
succeeded_path = workspace / "succeeded_ids.txt"
remaining_path = workspace / "remaining_ids.txt"
failed_path = workspace / "failed_attempts.tsv"
summary_path = workspace / "run_summary.json"
in_flight_path = workspace / ".parallel_in_flight_ids.txt"
skipped_path = workspace / "skipped_ids.txt"

workspace.mkdir(parents=True, exist_ok=True)
succeeded_path.touch()
skipped_path.touch()
in_flight_path.write_text("", encoding="utf-8")
if not failed_path.exists():
    failed_path.write_text("timestamp\tvideo_id\tstage\terror_class\tlog_path\n", encoding="utf-8")

if not default_csv_path.exists():
    raise SystemExit(f"Error: default CSV was not found: {default_csv_path}")

try:
    ordered_ids = load_unique_video_ids(default_csv_path)
except ValueError as exc:
    raise SystemExit(f"Error: {exc}") from exc

planned_path.write_text(
    "\n".join(ordered_ids) + ("\n" if ordered_ids else ""),
    encoding="utf-8",
)

planned_ids = [line.strip() for line in planned_path.read_text(encoding="utf-8").splitlines() if line.strip()]
succeeded_ids = {
    line.strip()
    for line in succeeded_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
}
skipped_ids = {
    line.strip()
    for line in skipped_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
}
remaining_ids = [
    video_id for video_id in planned_ids if video_id not in succeeded_ids and video_id not in skipped_ids
]
remaining_path.write_text(
    "\n".join(remaining_ids) + ("\n" if remaining_ids else ""),
    encoding="utf-8",
)

if not summary_path.exists():
    summary_path.write_text(
        json.dumps(
            {
                "csv_path": str(default_csv_path),
                "workspace": str(workspace),
                "fetch_backend": "decodo-scraper",
                "planned_count": len(planned_ids),
                "succeeded_count": len(succeeded_ids),
                "remaining_count": len(remaining_ids),
                "skipped_count": len(skipped_ids),
                "failed_attempt_count": max(0, len(failed_path.read_text(encoding="utf-8").splitlines()) - 1),
                "last_run": {
                    "processed": 0,
                    "succeeded": 0,
                    "failed": 0,
                    "stop_reason": "idle",
                    "proxy_mode": "scraper_api",
                    "proxy_url": None,
                    "fetch_backend": "decodo-scraper",
                    "mode": "parallel",
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
PY
}

claim_next_video() {
  python3 - "$WORKSPACE" "$STATE_LOCK_PATH" <<'PY'
import fcntl
import sys
from pathlib import Path

workspace = Path(sys.argv[1])
lock_path = Path(sys.argv[2])
planned_path = workspace / "planned_ids.txt"
succeeded_path = workspace / "succeeded_ids.txt"
remaining_path = workspace / "remaining_ids.txt"
in_flight_path = workspace / ".parallel_in_flight_ids.txt"
skipped_path = workspace / "skipped_ids.txt"
failed_path = workspace / "failed_attempts.tsv"

lock_path.parent.mkdir(parents=True, exist_ok=True)
with lock_path.open("a+", encoding="utf-8") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

    planned_ids = [
        line.strip()
        for line in planned_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    succeeded_ids = {
        line.strip()
        for line in succeeded_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    in_flight_ids = {
        line.strip()
        for line in in_flight_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    skipped_ids = {
        line.strip()
        for line in skipped_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }

    failure_counts: dict[str, int] = {}
    if failed_path.exists():
        for row in failed_path.read_text(encoding="utf-8").splitlines()[1:]:
            parts = row.split("\t")
            if len(parts) != 5:
                continue
            failure_video_id = parts[1].strip()
            if not failure_video_id:
                continue
            failure_counts[failure_video_id] = failure_counts.get(failure_video_id, 0) + 1

    for failed_video_id, failure_count in failure_counts.items():
        if failure_count >= 3 and failed_video_id not in succeeded_ids:
            skipped_ids.add(failed_video_id)

    remaining_ids = [
        video_id
        for video_id in planned_ids
        if video_id not in succeeded_ids and video_id not in in_flight_ids and video_id not in skipped_ids
    ]

    if not remaining_ids:
        remaining_path.write_text("", encoding="utf-8")
        skipped_path.write_text(
            "\n".join(sorted(skipped_ids)) + ("\n" if skipped_ids else ""),
            encoding="utf-8",
        )
        print("")
        raise SystemExit(0)

    video_id = remaining_ids[0]
    in_flight_ids.add(video_id)
    updated_remaining = remaining_ids[1:]

    in_flight_path.write_text(
        "\n".join(sorted(in_flight_ids)) + ("\n" if in_flight_ids else ""),
        encoding="utf-8",
    )
    remaining_path.write_text(
        "\n".join(updated_remaining) + ("\n" if updated_remaining else ""),
        encoding="utf-8",
    )
    skipped_path.write_text(
        "\n".join(sorted(skipped_ids)) + ("\n" if skipped_ids else ""),
        encoding="utf-8",
    )
    print(video_id)
PY
}

merge_worker_workspace() {
  local temp_workspace="$1"
  local video_id="$2"
  local processed_count="$3"
  local succeeded_count="$4"
  local failed_count="$5"
  local stop_reason="$6"

  python3 - "$WORKSPACE" "$STATE_LOCK_PATH" "$temp_workspace" "$video_id" "$RUN_STARTED_AT" "$processed_count" "$succeeded_count" "$failed_count" "$stop_reason" "$CONCURRENCY" "$MAX_VIDEOS" "$FETCH_BACKEND" "$DEFAULT_CSV_PATH" <<'PY'
import fcntl
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

workspace = Path(sys.argv[1])
lock_path = Path(sys.argv[2])
temp_workspace = Path(sys.argv[3])
video_id = sys.argv[4]
run_started_at = sys.argv[5]
processed_count = int(sys.argv[6])
succeeded_count = int(sys.argv[7])
failed_count = int(sys.argv[8])
stop_reason = sys.argv[9]
concurrency = int(sys.argv[10])
max_videos = int(sys.argv[11])
fetch_backend = sys.argv[12]
default_csv_path = sys.argv[13]

planned_path = workspace / "planned_ids.txt"
succeeded_path = workspace / "succeeded_ids.txt"
remaining_path = workspace / "remaining_ids.txt"
failed_path = workspace / "failed_attempts.tsv"
summary_path = workspace / "run_summary.json"
in_flight_path = workspace / ".parallel_in_flight_ids.txt"
skipped_path = workspace / "skipped_ids.txt"
main_raw_dir = workspace / "raw"
main_build_dir = workspace / "build"
main_log_dir = workspace / "logs"

temp_succeeded_path = temp_workspace / "succeeded_ids.txt"
temp_failed_path = temp_workspace / "failed_attempts.tsv"
temp_summary_path = temp_workspace / "run_summary.json"
temp_raw_dir = temp_workspace / "raw"
temp_build_dir = temp_workspace / "build"
temp_log_dir = temp_workspace / "logs"
temp_worker_stdout = temp_workspace / "worker.stdout.log"

main_raw_dir.mkdir(parents=True, exist_ok=True)
main_build_dir.mkdir(parents=True, exist_ok=True)
main_log_dir.mkdir(parents=True, exist_ok=True)
succeeded_path.touch()
skipped_path.touch()
in_flight_path.touch()
if not failed_path.exists():
    failed_path.write_text("timestamp\tvideo_id\tstage\terror_class\tlog_path\n", encoding="utf-8")

temp_succeeded_ids = {
    line.strip()
    for line in temp_succeeded_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
} if temp_succeeded_path.exists() else set()
worker_success = video_id in temp_succeeded_ids

if temp_log_dir.exists():
    for file_path in temp_log_dir.iterdir():
        if file_path.is_file():
            shutil.copy2(file_path, main_log_dir / file_path.name)
if temp_worker_stdout.exists():
    shutil.copy2(temp_worker_stdout, main_log_dir / f"parallel_worker_{video_id}.log")

if worker_success:
    for candidate in (
        temp_raw_dir / f"{video_id}_raw.json",
        temp_raw_dir / f"{video_id}_metadata_raw.json",
    ):
        if candidate.exists():
            shutil.copy2(candidate, main_raw_dir / candidate.name)

    for candidate in (
        temp_build_dir / f"{video_id}_storage.json",
        temp_build_dir / f"{video_id}_video.csv",
        temp_build_dir / f"{video_id}_subtitle.csv",
    ):
        if candidate.exists():
            shutil.copy2(candidate, main_build_dir / candidate.name)

failure_rows: list[str] = []
if temp_failed_path.exists():
    for line in temp_failed_path.read_text(encoding="utf-8").splitlines()[1:]:
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) != 5:
            continue
        parts[4] = str(main_log_dir / Path(parts[4]).name)
        failure_rows.append("\t".join(parts))

now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

lock_path.parent.mkdir(parents=True, exist_ok=True)
with lock_path.open("a+", encoding="utf-8") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

    planned_ids = [
        line.strip()
        for line in planned_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    succeeded_ids = [
        line.strip()
        for line in succeeded_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    succeeded_set = set(succeeded_ids)
    in_flight_ids = {
        line.strip()
        for line in in_flight_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    skipped_ids = {
        line.strip()
        for line in skipped_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    in_flight_ids.discard(video_id)

    if worker_success and video_id not in succeeded_set:
        succeeded_ids.append(video_id)
        succeeded_set.add(video_id)
        skipped_ids.discard(video_id)

    if failure_rows:
        with failed_path.open("a", encoding="utf-8") as file_obj:
            for row in failure_rows:
                file_obj.write(f"{row}\n")

    failure_counts: dict[str, int] = {}
    for row in failed_path.read_text(encoding="utf-8").splitlines()[1:]:
        parts = row.split("\t")
        if len(parts) != 5:
            continue
        failure_video_id = parts[1].strip()
        if not failure_video_id:
            continue
        failure_counts[failure_video_id] = failure_counts.get(failure_video_id, 0) + 1

    skipped_this_video = False
    if not worker_success and failure_counts.get(video_id, 0) >= 3 and video_id not in succeeded_set:
        skipped_ids.add(video_id)
        skipped_this_video = True

    remaining_ids = [
        claimed_video_id
        for claimed_video_id in planned_ids
        if claimed_video_id not in succeeded_set
        and claimed_video_id not in in_flight_ids
        and claimed_video_id not in skipped_ids
    ]

    succeeded_path.write_text(
        "\n".join(succeeded_ids) + ("\n" if succeeded_ids else ""),
        encoding="utf-8",
    )
    in_flight_path.write_text(
        "\n".join(sorted(in_flight_ids)) + ("\n" if in_flight_ids else ""),
        encoding="utf-8",
    )
    skipped_path.write_text(
        "\n".join(sorted(skipped_ids)) + ("\n" if skipped_ids else ""),
        encoding="utf-8",
    )
    remaining_path.write_text(
        "\n".join(remaining_ids) + ("\n" if remaining_ids else ""),
        encoding="utf-8",
    )

    summary = {}
    if summary_path.exists():
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            summary = {}

    failed_attempt_count = max(0, len(failed_path.read_text(encoding="utf-8").splitlines()) - 1)
    summary.update(
        {
            "csv_path": summary.get("csv_path", default_csv_path),
            "workspace": str(workspace),
            "fetch_backend": fetch_backend,
            "planned_count": len(planned_ids),
            "succeeded_count": len(succeeded_set),
            "remaining_count": len(remaining_ids),
            "skipped_count": len(skipped_ids),
            "failed_attempt_count": failed_attempt_count,
            "last_run": {
                "started_at": run_started_at,
                "finished_at": now,
                "processed": processed_count,
                "succeeded": succeeded_count,
                "failed": failed_count,
                "stop_reason": stop_reason,
                "proxy_mode": "scraper_api",
                "proxy_url": None,
                "fetch_backend": fetch_backend,
                "mode": "parallel",
                "concurrency": concurrency,
                "max_videos": max_videos,
                "worker_video_id": video_id,
                "worker_skipped": skipped_this_video,
            },
        }
    )
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

print(
    json.dumps(
        {
            "worker_success": worker_success,
            "remaining_count": len(remaining_ids),
            "worker_skipped": skipped_this_video,
        }
    )
)
PY
}

write_stop_reason() {
  local stop_reason="$1"
  printf "%s\n" "$stop_reason" > "$STOP_REASON_PATH"
}

finalize_summary() {
  local final_stop_reason="$1"
  python3 - "$WORKSPACE" "$STATE_LOCK_PATH" "$RUN_STARTED_AT" "$TOTAL_COMPLETED" "$TOTAL_SUCCEEDED" "$TOTAL_FAILED" "$final_stop_reason" "$CONCURRENCY" "$MAX_VIDEOS" "$FETCH_BACKEND" "$DEFAULT_CSV_PATH" <<'PY'
import fcntl
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

workspace = Path(sys.argv[1])
lock_path = Path(sys.argv[2])
run_started_at = sys.argv[3]
processed_count = int(sys.argv[4])
succeeded_count = int(sys.argv[5])
failed_count = int(sys.argv[6])
stop_reason = sys.argv[7]
concurrency = int(sys.argv[8])
max_videos = int(sys.argv[9])
fetch_backend = sys.argv[10]
default_csv_path = sys.argv[11]

planned_path = workspace / "planned_ids.txt"
succeeded_path = workspace / "succeeded_ids.txt"
remaining_path = workspace / "remaining_ids.txt"
failed_path = workspace / "failed_attempts.tsv"
summary_path = workspace / "run_summary.json"
in_flight_path = workspace / ".parallel_in_flight_ids.txt"

now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

lock_path.parent.mkdir(parents=True, exist_ok=True)
with lock_path.open("a+", encoding="utf-8") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

    planned_ids = [
        line.strip()
        for line in planned_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    succeeded_ids = [
        line.strip()
        for line in succeeded_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    in_flight_ids = {
        line.strip()
        for line in in_flight_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    skipped_ids = {
        line.strip()
        for line in skipped_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    remaining_ids = [
        video_id
        for video_id in planned_ids
        if video_id not in set(succeeded_ids)
        and video_id not in in_flight_ids
        and video_id not in skipped_ids
    ]
    remaining_path.write_text(
        "\n".join(remaining_ids) + ("\n" if remaining_ids else ""),
        encoding="utf-8",
    )

    summary = {}
    if summary_path.exists():
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            summary = {}

    failed_attempt_count = max(0, len(failed_path.read_text(encoding="utf-8").splitlines()) - 1)
    summary.update(
        {
            "csv_path": summary.get("csv_path", default_csv_path),
            "workspace": str(workspace),
            "fetch_backend": fetch_backend,
            "planned_count": len(planned_ids),
            "succeeded_count": len(set(succeeded_ids)),
            "remaining_count": len(remaining_ids),
            "skipped_count": len(skipped_ids),
            "failed_attempt_count": failed_attempt_count,
            "last_run": {
                "started_at": run_started_at,
                "finished_at": now,
                "processed": processed_count,
                "succeeded": succeeded_count,
                "failed": failed_count,
                "stop_reason": stop_reason,
                "proxy_mode": "scraper_api",
                "proxy_url": None,
                "fetch_backend": fetch_backend,
                "mode": "parallel",
                "concurrency": concurrency,
                "max_videos": max_videos,
            },
        }
    )
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
PY
}

describe_worker_result() {
  local temp_workspace="$1"
  local video_id="$2"
  python3 - "$temp_workspace" "$video_id" <<'PY'
import json
import sys
from pathlib import Path

temp_workspace = Path(sys.argv[1])
video_id = sys.argv[2]
summary_path = temp_workspace / "run_summary.json"
succeeded_path = temp_workspace / "succeeded_ids.txt"

stop_reason = "unknown"
worker_skipped = False
if summary_path.exists():
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        stop_reason = str(summary.get("last_run", {}).get("stop_reason") or stop_reason)
        worker_skipped = bool(summary.get("last_run", {}).get("worker_skipped"))
    except json.JSONDecodeError:
        pass

success = False
if succeeded_path.exists():
    success = video_id in {
        line.strip()
        for line in succeeded_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }

print(json.dumps({"success": success, "stop_reason": stop_reason, "worker_skipped": worker_skipped}))
PY
}

spawn_worker() {
  local slot="$1"
  local video_id=""
  video_id="$(claim_next_video)"
  if [[ -z "$video_id" ]]; then
    return 1
  fi

  local temp_workspace=""
  temp_workspace="$(mktemp -d "${WORKSPACE}/.parallel_worker.${slot}.${video_id}.XXXXXX")"
  local temp_csv="$temp_workspace/mini.csv"
  printf "channel_id,channel_name,video_id\nparallel,Parallel Worker,%s\n" "$video_id" > "$temp_csv"

  "$RUNNER" \
    --env-file "$ENV_FILE" \
    --csv "$temp_csv" \
    --workspace "$temp_workspace" \
    --max-videos-per-run 1 >"$temp_workspace/worker.stdout.log" 2>&1 &

  WORKER_PIDS[$slot]="$!"
  WORKER_IDS[$slot]="$video_id"
  WORKER_WORKSPACES[$slot]="$temp_workspace"
  WORKER_ACTIVE[$slot]=1
  TOTAL_CLAIMED=$((TOTAL_CLAIMED + 1))

  echo "[slot ${slot}] claimed ${video_id} pid=${WORKER_PIDS[$slot]}"
  return 0
}

handle_worker_completion() {
  local slot="$1"
  local exit_code="$2"
  local pid="${WORKER_PIDS[$slot]}"
  local video_id="${WORKER_IDS[$slot]}"
  local temp_workspace="${WORKER_WORKSPACES[$slot]}"
  local worker_json=""
  local worker_success=""
  local worker_stop_reason=""
  local worker_skipped=""

  worker_json="$(describe_worker_result "$temp_workspace" "$video_id")"
  worker_success="$(printf '%s' "$worker_json" | python3 -c 'import json,sys; print("1" if json.load(sys.stdin)["success"] else "0")')"
  worker_stop_reason="$(printf '%s' "$worker_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["stop_reason"])')"
  worker_skipped="$(printf '%s' "$worker_json" | python3 -c 'import json,sys; print("1" if json.load(sys.stdin).get("worker_skipped") else "0")')"

  TOTAL_COMPLETED=$((TOTAL_COMPLETED + 1))
  if [[ "$worker_success" == "1" ]]; then
    TOTAL_SUCCEEDED=$((TOTAL_SUCCEEDED + 1))
  else
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi

  local aggregate_stop_reason="running"
  if [[ -n "$GLOBAL_STOP_REASON" ]]; then
    aggregate_stop_reason="$GLOBAL_STOP_REASON"
  fi

  merge_worker_workspace \
    "$temp_workspace" \
    "$video_id" \
    "$TOTAL_COMPLETED" \
    "$TOTAL_SUCCEEDED" \
    "$TOTAL_FAILED" \
    "$aggregate_stop_reason"

  if [[ "$worker_success" == "1" ]]; then
    echo "[slot ${slot}] ${video_id} succeeded (pid=${pid})"
  else
    echo "[slot ${slot}] ${video_id} failed stop_reason=${worker_stop_reason} exit_code=${exit_code}" >&2
    if [[ "$worker_skipped" == "1" ]]; then
      echo "[slot ${slot}] ${video_id} quarantined after 3 failed attempts" >&2
    fi
  fi

  if [[ -z "$GLOBAL_STOP_REASON" ]]; then
    case "$worker_stop_reason" in
      api_auth_failed|api_budget_exhausted|api_rate_limited)
        GLOBAL_STOP_REASON="$worker_stop_reason"
        write_stop_reason "$GLOBAL_STOP_REASON"
        ;;
    esac
  fi

  rm -rf "$temp_workspace"
  WORKER_ACTIVE[$slot]=0
  WORKER_PIDS[$slot]=""
  WORKER_IDS[$slot]=""
  WORKER_WORKSPACES[$slot]=""
}

terminate_active_workers() {
  local slot=""
  for ((slot = 0; slot < CONCURRENCY; slot++)); do
    if [[ "${WORKER_ACTIVE[$slot]:-0}" -eq 1 ]]; then
      kill "${WORKER_PIDS[$slot]}" 2>/dev/null || true
    fi
  done

  sleep 1

  for ((slot = 0; slot < CONCURRENCY; slot++)); do
    if [[ "${WORKER_ACTIVE[$slot]:-0}" -eq 1 ]] && kill -0 "${WORKER_PIDS[$slot]}" 2>/dev/null; then
      kill -9 "${WORKER_PIDS[$slot]}" 2>/dev/null || true
    fi
  done
}

acquire_orchestrator_lock
ensure_workspace_state

declare -a WORKER_PIDS
declare -a WORKER_IDS
declare -a WORKER_WORKSPACES
declare -a WORKER_ACTIVE
WORKERS_DECLARED=1

for ((slot = 0; slot < CONCURRENCY; slot++)); do
  WORKER_PIDS[$slot]=""
  WORKER_IDS[$slot]=""
  WORKER_WORKSPACES[$slot]=""
  WORKER_ACTIVE[$slot]=0
done

echo "Starting parallel ingest: workspace=${WORKSPACE} max_videos=${MAX_VIDEOS} concurrency=${CONCURRENCY} backend=${FETCH_BACKEND}"

while true; do
  if [[ -z "$GLOBAL_STOP_REASON" ]]; then
    for ((slot = 0; slot < CONCURRENCY; slot++)); do
      if [[ "${WORKER_ACTIVE[$slot]:-0}" -eq 0 ]]; then
        if [[ "$TOTAL_CLAIMED" -ge "$MAX_VIDEOS" ]]; then
          break
        fi
        if ! spawn_worker "$slot"; then
          NO_MORE_WORK=1
          break
        fi
      fi
    done
  fi

  COMPLETED_SOMETHING=0
  ACTIVE_COUNT=0
  for ((slot = 0; slot < CONCURRENCY; slot++)); do
    if [[ "${WORKER_ACTIVE[$slot]:-0}" -eq 1 ]]; then
      ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
      if ! kill -0 "${WORKER_PIDS[$slot]}" 2>/dev/null; then
        exit_code=0
        if wait "${WORKER_PIDS[$slot]}"; then
          exit_code=0
        else
          exit_code=$?
        fi
        handle_worker_completion "$slot" "$exit_code"
        COMPLETED_SOMETHING=1
        ACTIVE_COUNT=$((ACTIVE_COUNT - 1))
      fi
    fi
  done

  if [[ -n "$GLOBAL_STOP_REASON" ]]; then
    echo "Stopping remaining workers due to fatal stop_reason=${GLOBAL_STOP_REASON}" >&2
    terminate_active_workers
    for ((slot = 0; slot < CONCURRENCY; slot++)); do
      if [[ "${WORKER_ACTIVE[$slot]:-0}" -eq 1 ]]; then
        exit_code=0
        if wait "${WORKER_PIDS[$slot]}"; then
          exit_code=0
        else
          exit_code=$?
        fi
        handle_worker_completion "$slot" "$exit_code"
      fi
    done
    break
  fi

  if [[ "$TOTAL_CLAIMED" -ge "$MAX_VIDEOS" && "$ACTIVE_COUNT" -eq 0 ]]; then
    break
  fi
  if [[ "$NO_MORE_WORK" -eq 1 && "$ACTIVE_COUNT" -eq 0 ]]; then
    break
  fi
  if [[ "$COMPLETED_SOMETHING" -eq 0 ]]; then
    sleep 1
  fi
done

FINAL_STOP_REASON="${GLOBAL_STOP_REASON:-completed}"
finalize_summary "$FINAL_STOP_REASON"

echo "Parallel summary: claimed=${TOTAL_CLAIMED} processed=${TOTAL_COMPLETED} succeeded=${TOTAL_SUCCEEDED} failed=${TOTAL_FAILED} stop_reason=${FINAL_STOP_REASON}"
echo "Workspace: $WORKSPACE"

if [[ -n "$GLOBAL_STOP_REASON" ]]; then
  exit 2
fi
