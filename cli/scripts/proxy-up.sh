#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROXY_URL="${KCONTEXT_YOUTUBE_PROXY_URL:-http://127.0.0.1:8118}"

echo "Starting torproxy with docker compose..."
docker compose -f "${ROOT_DIR}/docker-compose.proxy.yml" up -d

echo "Waiting for proxy readiness: ${PROXY_URL}"
for _ in $(seq 1 20); do
  if curl -fsS -x "${PROXY_URL}" https://httpbin.org/ip > /dev/null; then
    echo "torproxy is ready"
    exit 0
  fi
  sleep 2
done

echo "torproxy did not become ready in time" >&2
exit 1
