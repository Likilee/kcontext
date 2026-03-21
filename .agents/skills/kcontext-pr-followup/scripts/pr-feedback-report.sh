#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  pr-feedback-report.sh [--pr number|url|branch] [--repo owner/name]

If --pr is omitted, use the pull request attached to the current branch.
EOF
}

pr_ref=""
github_repo=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      pr_ref="${2:-}"
      shift 2
      ;;
    --repo)
      github_repo="${2:-}"
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

if [[ -n "${pr_ref}" ]]; then
  state_json="$(bash .agents/skills/kcontext-pr-review/scripts/pr-action-state.sh --repo "${github_repo}" --pr "${pr_ref}" --format json)"
else
  state_json="$(bash .agents/skills/kcontext-pr-review/scripts/pr-action-state.sh --repo "${github_repo}" --format json)"
fi

jq -nr \
  --argjson state "${state_json}" '
  def excerpt($text):
    ($text // "" | gsub("\\s+"; " ") | if length > 220 then .[0:217] + "..." else . end);
  "== PR ==\n" +
  "#\($state.pr.number) \($state.pr.title)\n" +
  "url: \($state.pr.url)\n" +
  "next actor: \($state.next_actor)\n" +
  "reason: \($state.reason)\n" +
  "review decision: \($state.pr.review_decision // "NONE")\n" +
  "has conflicts: \(if $state.has_conflicts then "yes" else "no" end)\n" +
  "branch: \($state.pr.head_ref) -> \($state.pr.base_ref)\n" +
  "linked issue: " +
    (if $state.linked_issue == null then "none" else "#\($state.linked_issue.number) \($state.linked_issue.title)" end) + "\n" +
  "bootstrap mode: \(if $state.bootstrap_mode then "yes" else "no" end)\n" +
  "contract sync suggested: \(if $state.contract_sync_suggested then "yes" else "no" end)\n\n" +
  "== Actionable Human Inputs Since Codex ==\n" +
  (
    if ($state.human_inputs_since_codex | length) == 0 then
      "  (none)\n\n"
    else
      (
        $state.human_inputs_since_codex
        | map("  - [ ] \(.source) by \(.author // "unknown") at \((.created_at // "")[0:19])" +
              (if .contract_signal then " [contract]" else "" end) +
              (if (.url // "") != "" then "\n    " + .url else "" end) +
              (if (.body_excerpt // "") != "" then "\n    " + excerpt(.body_excerpt) else "" end))
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Unresolved Human Review Threads ==\n" +
  (
    if ($state.open_human_threads | length) == 0 then
      "  (none)\n\n"
    else
      (
        $state.open_human_threads
        | map("  - [ ] \(.path):\(.line) by \(.author // "unknown")" +
              (if .contract_signal then " [contract]" else "" end) +
              (if (.url // "") != "" then "\n    " + .url else "" end) +
              (if (.body_excerpt // "") != "" then "\n    " + excerpt(.body_excerpt) else "" end))
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Linked Issue Comments Since PR Creation ==\n" +
  (
    if ($state.issue_comments_since_pr | length) == 0 then
      "  (none)\n"
    else
      (
        $state.issue_comments_since_pr
        | map("  - \(.author // "unknown") at \((.created_at // "")[0:19])" +
              (if .contract_signal then " [contract]" else "" end) +
              (if (.url // "") != "" then "\n    " + .url else "" end) +
              (if (.body_excerpt // "") != "" then "\n    " + excerpt(.body_excerpt) else "" end))
        | join("\n")
      ) + "\n"
    end
  )
  '
