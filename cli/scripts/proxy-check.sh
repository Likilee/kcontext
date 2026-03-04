#!/usr/bin/env bash
set -euo pipefail

PROXY_URL="${KCONTEXT_YOUTUBE_PROXY_URL:-http://127.0.0.1:8118}"

echo "Checking proxy via ${PROXY_URL}"
curl -fsS -x "${PROXY_URL}" https://httpbin.org/ip
