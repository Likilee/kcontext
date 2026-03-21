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
uv run tubelang fetch DucXv5xjhW4 -o /tmp/DucXv5xjhW4_raw.json \
  --fetch-backend decodo-scraper \
  --default-audio-language-code ko
```

Default manual CSV ingest supervisor through Decodo scraper:

Prerequisites:

1. `.env.decodo` with `DECODO_SCRAPER_API_BASIC_TOKEN`
2. `cli/.env` with local Supabase storage/admin key
   - `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
3. `.env.remote-sync` plus `KCONTEXT_REMOTE_DB_PASSWORD`

```bash
export KCONTEXT_REMOTE_DB_PASSWORD='<remote-db-password>'
./scripts/run-decodo-full-supervisor.sh \
  --ingest-concurrency 12 \
  --ingest-max-videos 5000
```

Manual CSV ingest now uses `docs/manual_ko_subtitle_videos_filtered.csv` by default.
If you update `docs/manual_ko_subtitle_videos.csv`, re-run `python3 ./scripts/check_playable.py`
before restarting ingest.

The supervisor wraps the parallel runner for local ingest and quarantines a `video_id` into
`skipped_ids.txt` after `3` failed attempts recorded in `failed_attempts.tsv`, then continues
with the remaining IDs before remote sync.

For local-only parallel ingest or quarantine inspection:

```bash
./scripts/run-manual-csv-ingest-parallel.sh --max-videos 20 --concurrency 4
```

For single-batch smoke tests or debugging only:

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
- repeated non-fatal per-video failures: quarantined into `skipped_ids.txt` after 3 attempts by the parallel runner/supervisor
