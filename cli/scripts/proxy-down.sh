#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Stopping torproxy..."
docker compose -f "${ROOT_DIR}/docker-compose.proxy.yml" down
