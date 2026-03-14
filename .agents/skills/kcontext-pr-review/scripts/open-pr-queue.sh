#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  open-pr-queue.sh [--repo owner/name] [--limit 20]
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

gh pr list \
  --repo "${github_repo}" \
  --state open \
  --limit "${limit}" \
  --json number,title,author,isDraft,reviewDecision,headRefName,baseRefName,statusCheckRollup,updatedAt,url \
  --jq '
    def bucket:
      if (.status // "") != "COMPLETED" then "pending"
      elif ((.conclusion // "") | ascii_upcase) == "SKIPPED" then "skipping"
      elif ((.conclusion // "") | ascii_upcase) == "CANCELLED" then "cancel"
      elif (((.conclusion // "") | ascii_upcase) == "SUCCESS") or (((.conclusion // "") | ascii_upcase) == "NEUTRAL") then "pass"
      else "fail"
      end;
    def count_bucket($name):
      [(.statusCheckRollup[]? | bucket) | select(. == $name)] | length;
    if length == 0 then
      "No open pull requests."
    else
      .[] |
      "#\(.number) \(if .isDraft then "[DRAFT] " else "" end)\(.title)\n" +
      "  author: \(.author.login) | review: \(.reviewDecision // "NONE") | branch: \(.headRefName) -> \(.baseRefName)\n" +
      "  checks: \((count_bucket("pass"))) pass, \((count_bucket("fail"))) fail, \((count_bucket("pending"))) pending, \((count_bucket("skipping"))) skipped, \((count_bucket("cancel"))) cancel\n" +
      "  updated: \(.updatedAt[0:10]) | \(.url)\n"
    end
  '
