# Decodo Residential Proxy Guide

Use Decodo residential proxies through the existing YouTube proxy layer. This path keeps the
existing `yt-dlp` subtitle fetch flow and only changes proxy resolution.
For the Decodo Web Scraping API backend, see `docs/decodo-scraper-guide.md`.

## Scope

- Supported in v1: rotating residential HTTP proxy endpoint
- Out of scope in this guide: sticky sessions, geo targeting, ASN targeting
- Out of scope in v1: deprecated YouTube subtitles target from Decodo Scraping API

## Setup

1. Copy `.env.decodo.example` to `.env.decodo`
2. Paste the Decodo residential endpoint host, port, username, and password
3. Keep `KCONTEXT_YOUTUBE_PROXY_PROVIDER=decodo`

## Commands

Smoke check the proxy with a canary video:

```bash
./scripts/check-decodo-proxy.sh
```

Fetch a single video through Decodo:

```bash
cd cli
set -a
source ../.env.decodo
set +a
uv run tubelang fetch DucXv5xjhW4 -o /tmp/decodo_canary.json \
  --default-audio-language-code ko
```

Resume manual CSV ingest through Decodo:

```bash
./scripts/run-manual-csv-ingest-via-decodo.sh --max-videos-per-run 3
```

Manual CSV ingest now uses `docs/manual_ko_subtitle_videos_filtered.csv` by default.
If you update `docs/manual_ko_subtitle_videos.csv`, re-run `python3 ./scripts/check_playable.py`
before restarting ingest.

## Output and Failure Modes

- `proxy_auth_failed`: invalid Decodo username/password or proxy auth rejection
- `proxy_unreachable`: DNS, timeout, connection refused, or tunnel/connect failure
- `youtube_rate_limited`: upstream YouTube still returned 429 / blocked the request
- `ok`: metadata fetch and subtitle fetch both succeeded

The ingest workspace keeps resumable state in `cli/.state/manual_csv_ingest/manual_ko_filtered_full`.
Proxy credentials are redacted in CLI logs and summaries.
