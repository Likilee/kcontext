#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="$ROOT_DIR/cli/config/sources.json"
WORKSPACE_ROOT="/tmp/kcontext_ingest_runs"
MAX_SOURCES=999
CONTINUE_ON_ERROR=0

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --config <path>          Path to sources.json (default: $ROOT_DIR/cli/config/sources.json)
  --workspace-root <path>  Root directory for run outputs (default: /tmp/kcontext_ingest_runs)
  --max-sources <n>        Max number of sources to process (default: 999)
  --continue-on-error      Continue other sources when one source fails
  -h, --help               Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG_PATH="$2"
      shift 2
      ;;
    --workspace-root)
      WORKSPACE_ROOT="$2"
      shift 2
      ;;
    --max-sources)
      MAX_SOURCES="$2"
      shift 2
      ;;
    --continue-on-error)
      CONTINUE_ON_ERROR=1
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

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Error: config file not found: $CONFIG_PATH" >&2
  exit 1
fi

if ! [[ "$MAX_SOURCES" =~ ^[0-9]+$ ]] || [[ "$MAX_SOURCES" -lt 1 ]]; then
  echo "Error: --max-sources must be a positive integer." >&2
  exit 1
fi

RUN_AT_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")"
RUN_DIR="$WORKSPACE_ROOT/$RUN_ID"
SOURCES_DIR="$RUN_DIR/sources"
LOG_DIR="$RUN_DIR/logs"

mkdir -p "$SOURCES_DIR" "$LOG_DIR"

AGG_PUSHED="$RUN_DIR/pushed_ids.txt"
AGG_FAILED="$RUN_DIR/failed_ids.txt"
RESULTS_TSV="$RUN_DIR/source_results.tsv"
MANIFEST_TSV="$RUN_DIR/sources_manifest.tsv"

: > "$AGG_PUSHED"
: > "$AGG_FAILED"
: > "$RESULTS_TSV"

python3 - "$CONFIG_PATH" "$MAX_SOURCES" "$MANIFEST_TSV" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
max_sources = int(sys.argv[2])
manifest_path = Path(sys.argv[3])

try:
    data = json.loads(config_path.read_text(encoding="utf-8"))
except json.JSONDecodeError as exc:
    print(f"Error: invalid JSON in {config_path}: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc

if not isinstance(data, dict):
    print("Error: config root must be an object.", file=sys.stderr)
    raise SystemExit(1)

sources = data.get("sources")
if not isinstance(sources, list):
    print("Error: key 'sources' must be an array.", file=sys.stderr)
    raise SystemExit(1)

if len(sources) == 0:
    print("Error: key 'sources' must contain at least one source.", file=sys.stderr)
    raise SystemExit(1)

seen_names: set[str] = set()
rows: list[str] = []

for idx, source in enumerate(sources[:max_sources], start=1):
    if not isinstance(source, dict):
        print(f"Error: sources[{idx - 1}] must be an object.", file=sys.stderr)
        raise SystemExit(1)

    missing = [
        key
        for key in (
            "name",
            "url",
            "target_per_run",
            "manual_ko_only",
            "probe_max_candidates",
            "use_proxy",
        )
        if key not in source
    ]
    if missing:
        print(
            f"Error: sources[{idx - 1}] missing required keys: {', '.join(missing)}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    name = source["name"]
    url = source["url"]
    target_per_run = source["target_per_run"]
    manual_ko_only = source["manual_ko_only"]
    probe_max_candidates = source["probe_max_candidates"]
    use_proxy = source["use_proxy"]

    if not isinstance(name, str) or not name.strip():
        print(f"Error: sources[{idx - 1}].name must be a non-empty string.", file=sys.stderr)
        raise SystemExit(1)
    if name in seen_names:
        print(f"Error: duplicate source name: {name}", file=sys.stderr)
        raise SystemExit(1)
    seen_names.add(name)

    if not isinstance(url, str) or not url.strip():
        print(f"Error: sources[{idx - 1}].url must be a non-empty string.", file=sys.stderr)
        raise SystemExit(1)

    if not isinstance(target_per_run, int) or target_per_run < 1:
        print(
            f"Error: sources[{idx - 1}].target_per_run must be a positive integer.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    if not isinstance(probe_max_candidates, int) or probe_max_candidates < 1:
        print(
            f"Error: sources[{idx - 1}].probe_max_candidates must be a positive integer.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    if not isinstance(manual_ko_only, bool):
        print(f"Error: sources[{idx - 1}].manual_ko_only must be boolean.", file=sys.stderr)
        raise SystemExit(1)

    if not isinstance(use_proxy, bool):
        print(f"Error: sources[{idx - 1}].use_proxy must be boolean.", file=sys.stderr)
        raise SystemExit(1)

    rows.append(
        "\t".join(
            [
                name,
                url,
                str(target_per_run),
                "1" if manual_ko_only else "0",
                str(probe_max_candidates),
                "1" if use_proxy else "0",
            ]
        )
    )

manifest_path.write_text("\n".join(rows) + ("\n" if rows else ""), encoding="utf-8")
PY

if [[ ! -s "$MANIFEST_TSV" ]]; then
  echo "Error: no sources selected from config." >&2
  exit 1
fi

SOURCE_FAILURE=0
PROCESSED=0

while IFS=$'\t' read -r NAME URL TARGET MANUAL_KO_ONLY PROBE_MAX_CANDIDATES USE_PROXY; do
  [[ -z "$NAME" ]] && continue
  PROCESSED=$((PROCESSED + 1))

  SOURCE_WORKSPACE="$SOURCES_DIR/$NAME"
  SOURCE_STDOUT_LOG="$LOG_DIR/${NAME}.stdout.log"
  SOURCE_STDERR_LOG="$LOG_DIR/${NAME}.stderr.log"

  mkdir -p "$SOURCE_WORKSPACE"

  CMD=(
    "$ROOT_DIR/cli/scripts/channel-pipeline.sh"
    --url "$URL"
    --target "$TARGET"
    --workspace "$SOURCE_WORKSPACE"
    --probe-max-candidates "$PROBE_MAX_CANDIDATES"
    --skip-existing
  )

  if [[ "$MANUAL_KO_ONLY" == "1" ]]; then
    CMD+=(--manual-ko-only)
  else
    CMD+=(--no-manual-ko-only)
  fi

  if [[ "$USE_PROXY" == "1" ]]; then
    :
  else
    CMD+=(--no-proxy)
  fi

  set +e
  "${CMD[@]}" >"$SOURCE_STDOUT_LOG" 2>"$SOURCE_STDERR_LOG"
  EXIT_CODE=$?
  set -e

  SOURCE_PUSHED_IDS="$SOURCE_WORKSPACE/pushed_ids.txt"
  SOURCE_FAILED_IDS="$SOURCE_WORKSPACE/failed_ids.txt"

  SOURCE_PUSHED_COUNT=0
  SOURCE_FAILED_COUNT=0

  if [[ -f "$SOURCE_PUSHED_IDS" ]]; then
    cat "$SOURCE_PUSHED_IDS" >> "$AGG_PUSHED"
    SOURCE_PUSHED_COUNT="$(sed '/^$/d' "$SOURCE_PUSHED_IDS" | wc -l | tr -d ' ')"
  fi

  if [[ -f "$SOURCE_FAILED_IDS" ]]; then
    cat "$SOURCE_FAILED_IDS" >> "$AGG_FAILED"
    SOURCE_FAILED_COUNT="$(sed '/^$/d' "$SOURCE_FAILED_IDS" | wc -l | tr -d ' ')"
  fi

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$NAME" \
    "$EXIT_CODE" \
    "$SOURCE_WORKSPACE" \
    "$SOURCE_STDOUT_LOG" \
    "$SOURCE_STDERR_LOG" \
    "$SOURCE_PUSHED_COUNT" \
    "$SOURCE_FAILED_COUNT" >> "$RESULTS_TSV"

  if [[ "$EXIT_CODE" -ne 0 ]]; then
    SOURCE_FAILURE=1
    if [[ "$CONTINUE_ON_ERROR" -ne 1 ]]; then
      break
    fi
  fi
done < "$MANIFEST_TSV"

python3 - "$RUN_AT_UTC" "$RUN_DIR" "$RESULTS_TSV" "$AGG_PUSHED" "$AGG_FAILED" <<'PY'
import json
import sys
from pathlib import Path

run_at, run_dir_raw, results_tsv_raw, pushed_raw, failed_raw = sys.argv[1:]
run_dir = Path(run_dir_raw)
results_tsv = Path(results_tsv_raw)
pushed_file = Path(pushed_raw)
failed_file = Path(failed_raw)


def read_ids(path: Path) -> list[str]:
    if not path.exists():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


pushed_ids = read_ids(pushed_file)
failed_ids = read_ids(failed_file)
source_results: list[dict[str, object]] = []

if results_tsv.exists():
    for line in results_tsv.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        name, exit_code, workspace, stdout_log, stderr_log, pushed_count, failed_count = line.split("\t")
        source_results.append(
            {
                "name": name,
                "exit_code": int(exit_code),
                "workspace": workspace,
                "stdout_log": stdout_log,
                "stderr_log": stderr_log,
                "pushed_count": int(pushed_count),
                "failed_count": int(failed_count),
            }
        )

summary = {
    "run_at": run_at,
    "sources_total": len(source_results),
    "videos_pushed": len(set(pushed_ids)),
    "videos_failed": len(set(failed_ids)),
    "workspace_paths": [entry["workspace"] for entry in source_results],
    "run_dir": str(run_dir),
    "source_results": source_results,
}

(run_dir / "summary.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
PY

echo "Local ingest run completed."
echo "  run_dir: $RUN_DIR"
echo "  summary: $RUN_DIR/summary.json"

if [[ "$SOURCE_FAILURE" -ne 0 ]]; then
  exit 2
fi

exit 0
