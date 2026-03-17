#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
labels_file="${repo_root}/.github/managed-labels.tsv"

usage() {
  cat <<'EOF'
Usage: ./scripts/sync-github-labels.sh [--repo owner/name] [--dry-run]

Synchronize the repo-managed GitHub labels defined in .github/managed-labels.tsv.
EOF
}

github_repo=""
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
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

if [[ -z "${github_repo}" ]]; then
  github_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

if [[ ! -f "${labels_file}" ]]; then
  echo "Missing labels file: ${labels_file}" >&2
  exit 1
fi

echo "Syncing managed labels to ${github_repo}"

while IFS=$'\t' read -r name color description; do
  [[ -z "${name}" ]] && continue

  if [[ "${dry_run}" -eq 1 ]]; then
    echo "DRY RUN: ensure label '${name}' (${color}) -> ${description}"
    continue
  fi

  if gh label create "${name}" --repo "${github_repo}" --color "${color}" --description "${description}" >/dev/null 2>&1; then
    echo "Created ${name}"
    continue
  fi

  gh label edit "${name}" --repo "${github_repo}" --color "${color}" --description "${description}" >/dev/null
  echo "Updated ${name}"
done < "${labels_file}"
