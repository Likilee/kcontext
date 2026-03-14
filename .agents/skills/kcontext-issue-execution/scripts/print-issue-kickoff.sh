#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  print-issue-kickoff.sh --issue 123 [--repo owner/name] [--slug short-ascii-slug]

Print a compact issue kickoff prompt for starting a fresh Codex thread.
EOF
}

issue_number=""
github_repo=""
slug_override=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      issue_number="${2:-}"
      shift 2
      ;;
    --repo)
      github_repo="${2:-}"
      shift 2
      ;;
    --slug)
      slug_override="${2:-}"
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

if [[ -z "${issue_number}" ]]; then
  echo "Missing required argument: --issue" >&2
  exit 1
fi

if [[ -z "${github_repo}" ]]; then
  github_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

mapfile -t issue_fields < <(
  gh issue view "${issue_number}" --repo "${github_repo}" --json title,url --jq '.title, .url'
)
issue_title="${issue_fields[0]:-}"
issue_url="${issue_fields[1]:-}"

if [[ -z "${issue_title}" || -z "${issue_url}" ]]; then
  echo "Failed to read issue title or URL for #${issue_number}" >&2
  exit 1
fi
display_title="$(printf '%s' "${issue_title}" | sed -E 's/^\[[^]]+\][[:space:]]*//')"

if [[ -z "${display_title}" ]]; then
  display_title="${issue_title}"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
branch_command=(
  bash "${script_dir}/start-issue-branch.sh"
  --issue "${issue_number}"
  --repo "${github_repo}"
  --title "${issue_title}"
)

if [[ -n "${slug_override}" ]]; then
  branch_command+=(--slug "${slug_override}")
fi

branch_name="$("${branch_command[@]}")"

cat <<EOF
[Issue #${issue_number}] ${display_title}

Issue:
- #${issue_number} ${issue_url}

Branch:
- ${branch_name}

Please:
- Treat the GitHub issue as the source of truth.
- Implement only the in-scope work from the issue.
- Verify using the issue's Verification section.
- Use Closes #${issue_number} only for full completion; otherwise use Refs #${issue_number}.
EOF
