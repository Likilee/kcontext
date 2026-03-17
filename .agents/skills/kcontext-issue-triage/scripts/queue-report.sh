#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  queue-report.sh [--repo owner/name] [--limit 20]
EOF
}

github_repo=""
limit=20

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      github_repo="${2:-}"
      shift 2
      ;;
    --limit)
      limit="${2:-}"
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

if [[ -z "${github_repo}" ]]; then
  github_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

show_section() {
  local title="$1"
  local query="$2"

  echo "== ${title} =="
  gh issue list \
    --repo "${github_repo}" \
    --state open \
    --limit "${limit}" \
    --search "${query}" \
    --json number,title,labels,updatedAt,url \
    --jq '
      if length == 0 then
        "  (none)"
      else
        .[] |
        "  #\(.number) \(.title) | updated \(.updatedAt[0:10]) | labels: \((.labels | map(.name) | join(", "))) | \(.url)"
      end
    '
  echo
}

show_section "Ready" 'label:"status:ready" -label:"status:blocked"'
show_section "Blocked" 'label:"status:blocked"'
show_section "Priority P0" 'label:"priority:p0"'
show_section "Priority P1" 'label:"priority:p1"'
show_section "Backlog / No Status" '-label:"status:ready" -label:"status:blocked"'
