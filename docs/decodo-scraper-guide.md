# Decodo Scraper Backend Guide

Use Decodo Web Scraping API as an alternative `fetch` backend. This path keeps the existing
subtitle pipeline contract, adds a metadata sidecar, and does not depend on the proxy layer.

## Scope

- Supported in v1: `fetch --fetch-backend decodo-scraper`
- Supported in v1: normalized metadata sidecar and `video-metadata` storage uploads
- Out of scope in v1: channel and playlist listing via Decodo
- Out of scope in v1: DB metadata columns and frontend metadata queries

## Setup

1. Copy `.env.decodo.example` to `.env.decodo`
2. Fill `DECODO_SCRAPER_API_BASIC_TOKEN`
3. Keep `DECODO_SCRAPER_API_URL` at the default unless Decodo gives you a different endpoint

## Commands

Smoke check the scraper API:

```bash
./scripts/check-decodo-scraper-api.sh
```

Fetch a single video with subtitle raw plus metadata sidecar:

```bash
cd cli
set -a
source ../.env.decodo
set +a
uv run tubelang fetch DucXv5xjhW4 -o /tmp/DucXv5xjhW4_raw.json --fetch-backend decodo-scraper
```

Resume manual CSV ingest through Decodo scraper:

```bash
./scripts/run-manual-csv-ingest-via-decodo-scraper.sh --max-videos-per-run 3
```

Backfill metadata storage artifacts and upload them:

```bash
./scripts/run-manual-csv-metadata-build-push.sh --max-videos-per-run 20
```

## Output Files

- Subtitle raw: `{video_id}_raw.json`
- Metadata raw: `{video_id}_metadata_raw.json`
- Metadata storage artifact: `{video_id}_metadata_storage.json`
- Metadata storage object: `video-metadata/{video_id}.json`

## Failure Modes

- `api_auth_failed`: invalid or expired Decodo scraper credentials
- `api_budget_exhausted`: traffic or plan budget exhausted
- `api_rate_limited`: Decodo scraper API rate limited the request
- `api_unreachable`: network or DNS error to the scraper API
- `api_unexpected_schema`: target response shape changed or required fields are missing
