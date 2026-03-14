#!/usr/bin/env bash
set -euo pipefail

MODE="symlink"
FORCE="0"
DRY_RUN="0"
SOURCE_ROOT=""
TARGET_ROOT=""

BOOTSTRAP_PATHS=(
  ".env.local"
  ".env.remote-sync"
  ".env.decodo"
  "web/.env.local"
  "cli/.env"
)

usage() {
  cat <<'USAGE'
Usage: ./scripts/bootstrap-worktree-env.sh [options]

Bootstrap local-only environment files into a git worktree by linking or copying
them from the canonical checkout that owns the shared git dir.

Options:
  --symlink              Symlink files from the canonical checkout (default)
  --copy                 Copy files instead of symlinking them
  --force                Replace existing target files
  --dry-run              Print planned actions without changing files
  --source-root <path>   Override the canonical checkout path
  --target-root <path>   Override the target worktree path (defaults to current repo)
  -h, --help             Show help

Bootstrapped paths:
  .env.local
  .env.remote-sync
  .env.decodo
  web/.env.local
  cli/.env
USAGE
}

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

resolve_path() {
  local base_path="$1"
  local candidate_path="$2"

  if [[ "$candidate_path" = /* ]]; then
    cd "$candidate_path" && pwd -P
    return
  fi

  cd "$base_path/$candidate_path" && pwd -P
}

remove_target() {
  local target_path="$1"

  if [[ -d "$target_path" && ! -L "$target_path" ]]; then
    fail "Refusing to remove directory target: $target_path"
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    log "would remove $target_path"
    return
  fi

  rm -f "$target_path"
}

create_parent_dir() {
  local target_path="$1"
  local parent_dir

  parent_dir="$(dirname "$target_path")"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "would ensure directory $parent_dir"
    return
  fi

  mkdir -p "$parent_dir"
}

write_target() {
  local source_path="$1"
  local target_path="$2"

  if [[ "$DRY_RUN" == "1" ]]; then
    log "would ${MODE} $target_path -> $source_path"
    return
  fi

  if [[ "$MODE" == "copy" ]]; then
    cp -p "$source_path" "$target_path"
    return
  fi

  ln -s "$source_path" "$target_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --symlink)
      MODE="symlink"
      shift
      ;;
    --copy)
      MODE="copy"
      shift
      ;;
    --force)
      FORCE="1"
      shift
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    --source-root)
      [[ $# -ge 2 ]] || fail "--source-root requires a path."
      SOURCE_ROOT="$2"
      shift 2
      ;;
    --target-root)
      [[ $# -ge 2 ]] || fail "--target-root requires a path."
      TARGET_ROOT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  fail "git is required."
fi

if [[ -z "$TARGET_ROOT" ]]; then
  TARGET_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)"
fi
TARGET_ROOT="$(cd "$TARGET_ROOT" && pwd -P)"

if [[ -z "$SOURCE_ROOT" ]]; then
  common_git_dir="$(
    git -C "$TARGET_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true
  )"
  if [[ -z "$common_git_dir" ]]; then
    fail "Could not resolve git common dir for $TARGET_ROOT. Use --source-root explicitly."
  fi

  core_worktree="$(git --git-dir="$common_git_dir" config --get core.worktree || true)"
  if [[ -z "$core_worktree" ]]; then
    if [[ "$(basename "$common_git_dir")" == ".git" ]]; then
      SOURCE_ROOT="$(cd "$common_git_dir/.." && pwd -P)"
    else
      SOURCE_ROOT="$TARGET_ROOT"
    fi
  else
    SOURCE_ROOT="$(resolve_path "$common_git_dir" "$core_worktree")"
  fi
fi
SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd -P)"

if [[ ! -d "$SOURCE_ROOT" ]]; then
  fail "Source root does not exist: $SOURCE_ROOT"
fi

if [[ "$SOURCE_ROOT" == "$TARGET_ROOT" ]]; then
  log "Already in the canonical checkout: $TARGET_ROOT"
  exit 0
fi

created_count=0
replaced_count=0
skipped_count=0
missing_count=0

log "Bootstrapping local env files"
log "source: $SOURCE_ROOT"
log "target: $TARGET_ROOT"
log "mode:   $MODE"

for relative_path in "${BOOTSTRAP_PATHS[@]}"; do
  source_path="$SOURCE_ROOT/$relative_path"
  target_path="$TARGET_ROOT/$relative_path"

  if [[ ! -e "$source_path" && ! -L "$source_path" ]]; then
    log "skip missing source: $relative_path"
    missing_count=$((missing_count + 1))
    continue
  fi

  if [[ -L "$target_path" ]]; then
    existing_link="$(readlink "$target_path" || true)"
    if [[ "$existing_link" == "$source_path" ]]; then
      log "keep existing link: $relative_path"
      skipped_count=$((skipped_count + 1))
      continue
    fi

    if [[ "$FORCE" != "1" ]]; then
      log "keep existing target: $relative_path"
      skipped_count=$((skipped_count + 1))
      continue
    fi

    remove_target "$target_path"
    create_parent_dir "$target_path"
    write_target "$source_path" "$target_path"
    log "replace ${MODE}: $relative_path"
    replaced_count=$((replaced_count + 1))
    continue
  fi

  if [[ -e "$target_path" ]]; then
    if [[ "$FORCE" != "1" ]]; then
      log "keep existing target: $relative_path"
      skipped_count=$((skipped_count + 1))
      continue
    fi

    remove_target "$target_path"
    create_parent_dir "$target_path"
    write_target "$source_path" "$target_path"
    log "replace ${MODE}: $relative_path"
    replaced_count=$((replaced_count + 1))
    continue
  fi

  create_parent_dir "$target_path"
  write_target "$source_path" "$target_path"
  log "create ${MODE}: $relative_path"
  created_count=$((created_count + 1))
done

log ""
log "Bootstrap complete"
log "created:  $created_count"
log "replaced: $replaced_count"
log "kept:     $skipped_count"
log "missing:  $missing_count"
