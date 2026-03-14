#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  start-issue-branch.sh --issue 123 [--title "Issue title override"] [--slug short-ascii-slug] [--repo owner/name]
                        [--create] [--base main]

By default, print the canonical branch name without changing git state.
Use --create to create or switch to the branch.
EOF
}

issue_number=""
title_override=""
slug_override=""
github_repo=""
create_branch=0
base_ref=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      issue_number="${2:-}"
      shift 2
      ;;
    --title)
      title_override="${2:-}"
      shift 2
      ;;
    --slug)
      slug_override="${2:-}"
      shift 2
      ;;
    --repo)
      github_repo="${2:-}"
      shift 2
      ;;
    --create)
      create_branch=1
      shift
      ;;
    --base)
      base_ref="${2:-}"
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

if [[ -z "${title_override}" ]]; then
  if [[ -z "${github_repo}" ]]; then
    github_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
  fi
  title_override="$(gh issue view "${issue_number}" --repo "${github_repo}" --json title --jq '.title')"
fi

normalize_slug() {
  local raw="$1"
  local slug

  raw="$(printf '%s' "${raw}" | sed -E 's/^\[[^]]+\][[:space:]]*//')"
  slug="$(printf '%s' "${raw}" | iconv -c -t ascii//translit 2>/dev/null || printf '%s' "${raw}")"
  slug="$(printf '%s' "${slug}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"

  if [[ -z "${slug}" ]]; then
    slug="issue"
  fi

  printf '%s' "${slug}" | cut -c1-48
}

if [[ -n "${slug_override}" ]]; then
  slug="$(normalize_slug "${slug_override}")"
else
  slug="$(normalize_slug "${title_override}")"
fi
branch_name="codex/${issue_number}-${slug}"

if [[ "${create_branch}" -eq 0 ]]; then
  echo "${branch_name}"
  exit 0
fi

if [[ -n "${base_ref}" ]]; then
  git fetch origin "${base_ref}"
fi

if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
  git checkout "${branch_name}"
elif [[ -n "${base_ref}" ]]; then
  git checkout -b "${branch_name}" "origin/${base_ref}"
else
  git checkout -b "${branch_name}"
fi

echo "${branch_name}"
