#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Run kcontext channel pipeline with managed proxy lifecycle.

Usage:
  bash skills/proxy-cli-pipeline/scripts/run-channel-pipeline-via-proxy.sh [channel-pipeline options]

Examples:
  bash skills/proxy-cli-pipeline/scripts/run-channel-pipeline-via-proxy.sh \
    --url "https://www.youtube.com/@sebasi15/videos" \
    --target 50 \
    --manual-ko-only \
    --skip-existing

Notes:
  - This wrapper runs: proxy-up -> proxy-check -> channel-pipeline -> proxy-down
  - All arguments are forwarded to cli/scripts/channel-pipeline.sh
  - Proxy URL defaults to KCONTEXT_YOUTUBE_PROXY_URL or http://127.0.0.1:8118
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${KCONTEXT_REPO_ROOT:-}"
if [[ -z "${REPO_ROOT}" ]]; then
  probe_dir="${SCRIPT_DIR}"
  while [[ "${probe_dir}" != "/" ]]; do
    if [[ -f "${probe_dir}/cli/scripts/channel-pipeline.sh" ]]; then
      REPO_ROOT="${probe_dir}"
      break
    fi
    probe_dir="$(cd "${probe_dir}/.." && pwd)"
  done
fi

if [[ -z "${REPO_ROOT}" ]]; then
  echo "Could not locate repository root containing cli/scripts/channel-pipeline.sh" >&2
  echo "Set KCONTEXT_REPO_ROOT explicitly and retry." >&2
  exit 1
fi

CLI_DIR="${REPO_ROOT}/cli"
CHANNEL_PIPELINE="${CLI_DIR}/scripts/channel-pipeline.sh"
PROXY_UP="${CLI_DIR}/scripts/proxy-up.sh"
PROXY_CHECK="${CLI_DIR}/scripts/proxy-check.sh"
PROXY_DOWN="${CLI_DIR}/scripts/proxy-down.sh"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  echo
  echo "channel-pipeline.sh help:"
  echo
  bash "${CHANNEL_PIPELINE}" --help
  exit 0
fi

for required in "${CHANNEL_PIPELINE}" "${PROXY_UP}" "${PROXY_CHECK}" "${PROXY_DOWN}"; do
  if [[ ! -f "${required}" ]]; then
    echo "Required script not found: ${required}" >&2
    exit 1
  fi
done

proxy_started=0

cleanup() {
  if [[ "${proxy_started}" -eq 1 ]]; then
    echo "[proxy-cli-pipeline] stopping proxy..."
    bash "${PROXY_DOWN}"
  fi
}

trap cleanup EXIT

echo "[proxy-cli-pipeline] starting proxy..."
bash "${PROXY_UP}"
proxy_started=1

echo "[proxy-cli-pipeline] checking proxy..."
bash "${PROXY_CHECK}"

echo "[proxy-cli-pipeline] running channel pipeline..."
(
  cd "${CLI_DIR}"
  bash "${CHANNEL_PIPELINE}" "$@"
)
