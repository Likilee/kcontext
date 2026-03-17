#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  pr-review-report.sh [--pr number|url|branch] [--repo owner/name] [--files-limit 20]

If --pr is omitted, use the pull request attached to the current branch.
EOF
}

pr_ref=""
github_repo=""
files_limit=20

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
    --files-limit)
      files_limit="${2:-}"
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

pr_json_args=(
  --repo "${github_repo}"
  --json number,title,url,author,isDraft,headRefName,headRefOid,baseRefName,reviewDecision,mergeStateStatus,mergeable,updatedAt,additions,deletions,changedFiles,labels,closingIssuesReferences,latestReviews,files,statusCheckRollup
)

if [[ -n "${pr_ref}" ]]; then
  pr_json="$(gh pr view "${pr_ref}" "${pr_json_args[@]}")"
  state_json="$(bash .agents/skills/kcontext-pr-review/scripts/pr-action-state.sh --repo "${github_repo}" --pr "${pr_ref}" --format json)"
else
  pr_json="$(gh pr view "${pr_json_args[@]}")"
  state_json="$(bash .agents/skills/kcontext-pr-review/scripts/pr-action-state.sh --repo "${github_repo}" --format json)"
fi

jq -nr \
  --argjson pr "${pr_json}" \
  --argjson state "${state_json}" \
  --argjson filesLimit "${files_limit}" '
  def bucket:
    if (.status // "") != "COMPLETED" then "pending"
    elif ((.conclusion // "") | ascii_upcase) == "SKIPPED" then "skipping"
    elif ((.conclusion // "") | ascii_upcase) == "CANCELLED" then "cancel"
    elif (((.conclusion // "") | ascii_upcase) == "SUCCESS") or (((.conclusion // "") | ascii_upcase) == "NEUTRAL") then "pass"
    else "fail"
    end;
  def count_bucket($name):
    [($pr.statusCheckRollup[]? | bucket) | select(. == $name)] | length;
  def excerpt($text):
    ($text // "" | gsub("\\s+"; " ") | if length > 180 then .[0:177] + "..." else . end);
  "== PR ==\n" +
  "#\($pr.number) \(if $pr.isDraft then "[DRAFT] " else "" end)\($pr.title)\n" +
  "url: \($pr.url)\n" +
  "author: \($pr.author.login) | branch: \($pr.headRefName) -> \($pr.baseRefName)\n" +
  "review: \($pr.reviewDecision // "NONE") | merge: \($pr.mergeable // "UNKNOWN") | state: \($pr.mergeStateStatus // "UNKNOWN")\n" +
  "linked issues: " +
    (if ($pr.closingIssuesReferences | length) == 0 then "none" else ($pr.closingIssuesReferences | map("#\(.number)") | join(", ")) end) + "\n" +
  "labels: " +
    (if ($pr.labels | length) == 0 then "none" else ($pr.labels | map(.name) | join(", ")) end) + "\n\n" +
  "== Actor State ==\n" +
  "next actor: \($state.next_actor)\n" +
  "reason: \($state.reason)\n" +
  "codex review on head: \(if $state.has_codex_review_on_head then "yes" else "no" end)\n" +
  "bootstrap mode: \(if $state.bootstrap_mode then "yes" else "no" end)\n" +
  "contract sync suggested: \(if $state.contract_sync_suggested then "yes" else "no" end)\n" +
  "actionable human inputs since codex: \($state.human_inputs_since_codex | length) | unresolved human threads: \($state.open_human_threads | length)\n" +
  (if ($state.last_codex_action_at // "") != "" then "last codex action: \($state.last_codex_action_at)\n" else "" end) +
  (if ($state.latest_human_input_at // "") != "" then "latest human input: \($state.latest_human_input_at)\n\n" else "\n" end) +
  "== Actionable Human Inputs Since Codex ==\n" +
  (
    if ($state.human_inputs_since_codex | length) == 0 then
      "  (none)\n\n"
    else
      (
        $state.human_inputs_since_codex
        | map("  - \(.source) by \(.author // "unknown") at \((.created_at // "")[0:19])" +
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
        | map("  - \(.path):\(.line) by \(.author // "unknown")" +
              (if .contract_signal then " [contract]" else "" end) +
              (if (.url // "") != "" then "\n    " + .url else "" end) +
              (if (.body_excerpt // "") != "" then "\n    " + excerpt(.body_excerpt) else "" end))
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Scope ==\n" +
  "files: \($pr.changedFiles) | +\($pr.additions) -\($pr.deletions)\n" +
  (
    if ($pr.files | length) == 0 then
      "changed files:\n  (none)\n\n"
    else
      "changed files:\n" +
      (
        $pr.files
        | sort_by(-(.additions + .deletions))
        | .[:$filesLimit]
        | map("  - \(.path) (+\(.additions) -\(.deletions))")
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Checks ==\n" +
  "summary: \(count_bucket("pass")) pass, \(count_bucket("fail")) fail, \(count_bucket("pending")) pending, \(count_bucket("skipping")) skipped, \(count_bucket("cancel")) cancel\n" +
  (
    if ($pr.statusCheckRollup | length) == 0 then
      "  (none)\n\n"
    else
      (
        $pr.statusCheckRollup
        | sort_by(.name)
        | map("  - \(.name): " + (bucket))
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Latest Reviews ==\n" +
  (
    if ($pr.latestReviews | length) == 0 then
      "  (none)\n"
    else
      (
        $pr.latestReviews
        | map("  - \(.state // "COMMENTED") by \(.author.login) at \((.submittedAt // .createdAt // "")[0:19])" +
              (if ((.body // "") | length) > 0 then "\n    " + excerpt(.body) else "" end))
        | join("\n")
      ) + "\n"
    end
  )
  '
