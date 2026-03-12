#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_AUDIO_LANGUAGE_CODE="${DEFAULT_AUDIO_LANGUAGE_CODE:-ko}"

cd "$ROOT_DIR/cli"

uv run tubelang snapshot-fixtures \
  --env-file "$ROOT_DIR/.env.remote-sync" \
  --dir "$ROOT_DIR/testing/cli-integration/raw" \
  --default-audio-language-code "$DEFAULT_AUDIO_LANGUAGE_CODE" \
  --prune-existing \
  --video-id "AYcZSPzAh-8" \
  --video-id "omA_eOp6i6k" \
  --video-id "Q21S8nbgcVI"
