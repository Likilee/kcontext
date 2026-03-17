#!/usr/bin/env bash
set -euo pipefail

base_sha=""
head_sha=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-sha)
      base_sha="${2:-}"
      shift 2
      ;;
    --head-sha)
      head_sha="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$head_sha" ]]; then
  head_sha="$(git rev-parse HEAD)"
fi

if [[ -z "$base_sha" || "$base_sha" == "0000000000000000000000000000000000000000" ]]; then
  base_sha="$(git rev-list --max-parents=0 "$head_sha" | tail -n 1)"
fi

mapfile -t changed_files < <(git diff --name-only "$base_sha" "$head_sha")

if [[ "${#changed_files[@]}" -eq 0 ]]; then
  echo "No changed files detected. Skipping lefthook parity."
  exit 0
fi

args=()
for file in "${changed_files[@]}"; do
  if [[ -n "$file" ]]; then
    args+=(--file "$file")
  fi
done

if [[ "${#args[@]}" -eq 0 ]]; then
  echo "No changed files detected. Skipping lefthook parity."
  exit 0
fi

echo "Running lefthook pre-commit parity for ${#args[@]} changed files."
npx lefthook run pre-commit "${args[@]}"
