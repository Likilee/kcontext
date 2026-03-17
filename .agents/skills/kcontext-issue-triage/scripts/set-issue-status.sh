#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  set-issue-status.sh --issue 123 --status ready|blocked|none [--comment-file /path/to/comment.md]
                      [--repo owner/name] [--dry-run]
EOF
}

issue_number=""
status=""
comment_file=""
github_repo=""
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      issue_number="${2:-}"
      shift 2
      ;;
    --status)
      status="${2:-}"
      shift 2
      ;;
    --comment-file)
      comment_file="${2:-}"
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

if [[ -z "${issue_number}" || -z "${status}" ]]; then
  echo "Both --issue and --status are required." >&2
  exit 1
fi

case "${status}" in
  ready|blocked|none)
    ;;
  *)
    echo "Invalid --status: ${status}" >&2
    exit 1
    ;;
esac

if [[ "${status}" == "blocked" && -z "${comment_file}" && "${dry_run}" -eq 0 ]]; then
  echo "--comment-file is required when setting status to blocked." >&2
  exit 1
fi

if [[ -n "${comment_file}" && ! -f "${comment_file}" ]]; then
  echo "Comment file not found: ${comment_file}" >&2
  exit 1
fi

if [[ -z "${github_repo}" ]]; then
  github_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

edit_command=(
  gh issue edit "${issue_number}"
  --repo "${github_repo}"
  --remove-label "status:ready"
  --remove-label "status:blocked"
)

if [[ "${status}" != "none" ]]; then
  edit_command+=(--add-label "status:${status}")
fi

if [[ "${dry_run}" -eq 1 ]]; then
  printf 'DRY RUN:'
  printf ' %q' "${edit_command[@]}"
  printf '\n'
  if [[ -n "${comment_file}" ]]; then
    echo "--- COMMENT ---"
    cat "${comment_file}"
  fi
  exit 0
fi

"${edit_command[@]}"

if [[ -n "${comment_file}" ]]; then
  gh issue comment "${issue_number}" --repo "${github_repo}" --body-file "${comment_file}"
fi
