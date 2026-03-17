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

pr_numbers="$(gh pr list \
  --repo "${github_repo}" \
  --state open \
  --limit "${limit}" \
  --json number \
  --jq '.[].number')"

if [[ -z "${pr_numbers}" ]]; then
  echo "No open pull requests."
  exit 0
fi

while IFS= read -r pr_number; do
  [[ -z "${pr_number}" ]] && continue

  pr_json="$(bash .agents/skills/kcontext-pr-review/scripts/pr-action-state.sh --repo "${github_repo}" --pr "${pr_number}" --format json)"
  status_checks_json="$(gh pr view "${pr_number}" --repo "${github_repo}" --json statusCheckRollup --jq '.statusCheckRollup')"
  merged_json="$(jq -n --argjson state "${pr_json}" --argjson checks "${status_checks_json}" '$state + {checks: $checks}')"

  jq -r '
    def bucket:
      if (.status // "") != "COMPLETED" then "pending"
      elif ((.conclusion // "") | ascii_upcase) == "SKIPPED" then "skipping"
      elif ((.conclusion // "") | ascii_upcase) == "CANCELLED" then "cancel"
      elif (((.conclusion // "") | ascii_upcase) == "SUCCESS") or (((.conclusion // "") | ascii_upcase) == "NEUTRAL") then "pass"
      else "fail"
      end;
    def count_bucket($name):
      [(.checks[]? | bucket) | select(. == $name)] | length;
    "#\(.pr.number) \(.pr.title)\n" +
    "  next_actor: \(.next_actor) | reason: \(.reason)\n" +
    "  review: \(.pr.review_decision // "NONE") | branch: \(.pr.head_ref) -> \(.pr.base_ref)\n" +
    "  linked issue: " +
      (if .linked_issue == null then "none" else "#\(.linked_issue.number) \(.linked_issue.title)" end) + "\n" +
    "  actionable human inputs since codex: \(.human_inputs_since_codex | length) | unresolved human threads: \(.open_human_threads | length) | contract sync: \(if .contract_sync_suggested then "yes" else "no" end)\n" +
    "  checks: \((count_bucket("pass"))) pass, \((count_bucket("fail"))) fail, \((count_bucket("pending"))) pending, \((count_bucket("skipping"))) skipped, \((count_bucket("cancel"))) cancel\n" +
    "  updated: \(.pr.updated_at[0:10]) | \(.pr.url)\n"
  ' <<< "${merged_json}"
done <<< "${pr_numbers}"
