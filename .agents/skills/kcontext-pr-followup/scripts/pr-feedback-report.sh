#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  pr-feedback-report.sh [--pr number|url|branch] [--repo owner/name] [--thread-limit 50]

If --pr is omitted, use the pull request attached to the current branch.
EOF
}

pr_ref=""
github_repo=""
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
  --json number,title,url,reviewDecision,latestReviews,closingIssuesReferences,headRefName,baseRefName,files
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
  --argjson threads "${thread_json}" '
  def excerpt($text):
    ($text // "" | gsub("\\s+"; " ") | if length > 180 then .[0:177] + "..." else . end);
  ($threads.data.repository.pullRequest.reviewThreads.nodes // []) as $reviewThreads |
  ($reviewThreads | map(select(.isResolved | not))) as $openThreads |
  ($reviewThreads | map(select(.isResolved and (.isOutdated | not)))) as $resolvedThreads |
  ($reviewThreads | map(select(.isOutdated))) as $outdatedThreads |
  "== PR ==\n" +
  "#\($pr.number) \($pr.title)\n" +
  "url: \($pr.url)\n" +
  "review decision: \($pr.reviewDecision // "NONE")\n" +
  "branch: \($pr.headRefName) -> \($pr.baseRefName)\n" +
  "linked issues: " +
    (if ($pr.closingIssuesReferences | length) == 0 then "none" else ($pr.closingIssuesReferences | map("#\(.number)") | join(", ")) end) + "\n\n" +
  "== Actionable Review Summaries ==\n" +
  (
    ($pr.latestReviews | map(select((.state // "") == "CHANGES_REQUESTED" or ((.body // "") | length > 0)))) as $reviews |
    if ($reviews | length) == 0 then
      "  (none)\n\n"
    else
      (
        $reviews
        | map("  - \(.state // "COMMENTED") by \(.author.login) at \((.submittedAt // .createdAt // "")[0:10])" +
              (if ((.body // "") | length) > 0 then "\n    " + excerpt(.body) else "" end))
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Unresolved Review Threads ==\n" +
  (
    if ($openThreads | length) == 0 then
      "  (none)\n\n"
    else
      (
        $openThreads
        | map(.comments.nodes[0] // {})
        | map("  - [ ] \((.path // "general")):\((.line // .originalLine // 0)) by \(.author.login // "unknown")\n    " + excerpt(.body) + (if (.url // "") != "" then "\n    " + .url else "" end))
        | join("\n")
      ) + "\n\n"
    end
  ) +
  "== Thread Counts ==\n" +
  "open: \($openThreads | length) | resolved: \($resolvedThreads | length) | outdated: \($outdatedThreads | length)\n"
  '
