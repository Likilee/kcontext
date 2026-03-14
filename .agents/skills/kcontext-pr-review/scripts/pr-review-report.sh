#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  pr-review-report.sh [--pr number|url|branch] [--repo owner/name] [--files-limit 20] [--thread-limit 50]

If --pr is omitted, use the pull request attached to the current branch.
EOF
}

pr_ref=""
github_repo=""
files_limit=20
thread_limit=50

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
    --thread-limit)
      thread_limit="${2:-}"
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
  --json number,title,url,author,isDraft,headRefName,baseRefName,reviewDecision,mergeStateStatus,mergeable,additions,deletions,changedFiles,labels,closingIssuesReferences,latestReviews,files,statusCheckRollup
)

if [[ -n "${pr_ref}" ]]; then
  pr_json="$(gh pr view "${pr_ref}" "${pr_json_args[@]}")"
else
  pr_json="$(gh pr view "${pr_json_args[@]}")"
fi

pr_number="$(jq -r '.number' <<< "${pr_json}")"
repo_owner="${github_repo%%/*}"
repo_name="${github_repo##*/}"

thread_json="$(gh api graphql \
  -f query='query($owner:String!, $repo:String!, $number:Int!, $threadLimit:Int!, $commentLimit:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:$threadLimit) { nodes { isResolved isOutdated comments(first:$commentLimit) { nodes { author { login } body path line originalLine url createdAt } } } } } } }' \
  -F owner="${repo_owner}" \
  -F repo="${repo_name}" \
  -F number="${pr_number}" \
  -F threadLimit="${thread_limit}" \
  -F commentLimit=10)"

jq -nr \
  --argjson pr "${pr_json}" \
  --argjson threads "${thread_json}" \
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
    ($text // "" | gsub("\\s+"; " ") | if length > 160 then .[0:157] + "..." else . end);
  ($threads.data.repository.pullRequest.reviewThreads.nodes // []) as $reviewThreads |
  "== PR ==\n" +
  "#\($pr.number) \(if $pr.isDraft then "[DRAFT] " else "" end)\($pr.title)\n" +
  "url: \($pr.url)\n" +
  "author: \($pr.author.login) | branch: \($pr.headRefName) -> \($pr.baseRefName)\n" +
  "review: \($pr.reviewDecision // "NONE") | merge: \($pr.mergeable // "UNKNOWN") | state: \($pr.mergeStateStatus // "UNKNOWN")\n" +
  "linked issues: " +
    (if ($pr.closingIssuesReferences | length) == 0 then "none" else ($pr.closingIssuesReferences | map("#\(.number)") | join(", ")) end) + "\n" +
  "labels: " +
    (if ($pr.labels | length) == 0 then "none" else ($pr.labels | map(.name) | join(", ")) end) + "\n\n" +
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
      "  (none)\n\n"
    else
      (
        $pr.latestReviews
        | map("  - \(.state // "COMMENTED") by \(.author.login) at \((.submittedAt // .createdAt // "")[0:10])" +
              (if ((.body // "") | length) > 0 then "\n    " + excerpt(.body) else "" end))
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Unresolved Review Threads ==\n" +
  (
    ($reviewThreads | map(select(.isResolved | not))) as $openThreads |
    if ($openThreads | length) == 0 then
      "  (none)\n"
    else
      (
        $openThreads
        | map(.comments.nodes[0] // {})
        | map("  - \((.path // "general")):\((.line // .originalLine // 0)) by \(.author.login // "unknown")\n    " + excerpt(.body) + (if (.url // "") != "" then "\n    " + .url else "" end))
        | join("\n")
      ) + "\n"
    end
  )
  '
