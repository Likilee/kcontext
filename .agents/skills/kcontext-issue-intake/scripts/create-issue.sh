#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  create-issue.sh --kind task|bug --title "Title" --type feature|bug|refactor|chore|docs \
    --priority p0|p1|p2 --area web [--area docs] --status ready|blocked|none \
    --body-file /path/to/body.md [--repo owner/name] [--dry-run]
EOF
}

kind=""
title=""
issue_type=""
priority=""
status=""
body_file=""
github_repo=""
dry_run=0
areas=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kind)
      kind="${2:-}"
      shift 2
      ;;
    --title)
      title="${2:-}"
      shift 2
      ;;
    --type)
      issue_type="${2:-}"
      shift 2
      ;;
    --priority)
      priority="${2:-}"
      shift 2
      ;;
    --area)
      areas+=("${2:-}")
      shift 2
      ;;
    --status)
      status="${2:-}"
      shift 2
      ;;
    --body-file)
      body_file="${2:-}"
      shift 2
      ;;
    --repo)
      github_repo="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
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

require_value() {
  local value="$1"
  local name="$2"
  if [[ -z "${value}" ]]; then
    echo "Missing required argument: ${name}" >&2
    exit 1
  fi
}

contains_value() {
  local target="$1"
  shift
  for value in "$@"; do
    if [[ "${target}" == "${value}" ]]; then
      return 0
    fi
  done
  return 1
}

require_value "${kind}" "--kind"
require_value "${title}" "--title"
require_value "${issue_type}" "--type"
require_value "${priority}" "--priority"
require_value "${status}" "--status"
require_value "${body_file}" "--body-file"

if [[ ! -f "${body_file}" ]]; then
  echo "Body file not found: ${body_file}" >&2
  exit 1
fi

if [[ ${#areas[@]} -lt 1 || ${#areas[@]} -gt 2 ]]; then
  echo "Use one or two --area values." >&2
  exit 1
fi

if ! contains_value "${kind}" task bug; then
  echo "Invalid --kind: ${kind}" >&2
  exit 1
fi

if ! contains_value "${issue_type}" feature bug refactor chore docs; then
  echo "Invalid --type: ${issue_type}" >&2
  exit 1
fi

if ! contains_value "${priority}" p0 p1 p2; then
  echo "Invalid --priority: ${priority}" >&2
  exit 1
fi

if ! contains_value "${status}" ready blocked none; then
  echo "Invalid --status: ${status}" >&2
  exit 1
fi

for area in "${areas[@]}"; do
  if ! contains_value "${area}" web cli supabase ci docs; then
    echo "Invalid --area: ${area}" >&2
    exit 1
  fi
done

if [[ "${kind}" == "bug" && "${issue_type}" != "bug" ]]; then
  echo "--kind bug requires --type bug." >&2
  exit 1
fi

if [[ "${kind}" == "task" && "${issue_type}" == "bug" ]]; then
  echo "--kind task cannot use --type bug." >&2
  exit 1
fi

if [[ -z "${github_repo}" ]]; then
  github_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

case "${kind}" in
  task)
    [[ "${title}" == \[Task\]* || "${title}" == \[작업\]* ]] || title="[작업] ${title}"
    ;;
  bug)
    [[ "${title}" == \[Bug\]* || "${title}" == \[버그\]* ]] || title="[버그] ${title}"
    ;;
esac

labels=("type:${issue_type}" "priority:${priority}")

for area in "${areas[@]}"; do
  labels+=("area:${area}")
done

if [[ "${status}" != "none" ]]; then
  labels+=("status:${status}")
fi

if [[ "${dry_run}" -eq 1 ]]; then
  echo "Repo: ${github_repo}"
  echo "Title: ${title}"
  echo "Labels: ${labels[*]}"
  echo "Body file: ${body_file}"
  echo "--- BODY ---"
  cat "${body_file}"
  exit 0
fi

command=(
  gh issue create
  --repo "${github_repo}"
  --title "${title}"
  --body-file "${body_file}"
)

for label in "${labels[@]}"; do
  command+=(--label "${label}")
done

"${command[@]}"
