# Direct Sync Strategy

## Required inputs

- Ask for the remote DB password every run.
- Read remote metadata from `.env.remote-sync`.
- Prefer these optional env vars when available for direct storage upload:
  - `REMOTE_S3_ENDPOINT_URL`
  - `REMOTE_S3_REGION`
  - `REMOTE_S3_ACCESS_KEY_ID`
  - `REMOTE_S3_SECRET_ACCESS_KEY`
  - `SYNC_STORAGE_BUCKET`

## Upsert policy

- `video`: `INSERT ... ON CONFLICT (id) DO UPDATE`
- `subtitle`: `DELETE WHERE video_id IN batch` then bulk insert the replacement rows
- `storage`: overwrite `subtitles/<video_id>.json`

This is the safest default for kcontext because `video_id` is stable, subtitle rows are derived artifacts, and retries must stay idempotent.

## Data volume rules

- Small batch:
  - Use per-video SQL writes.
  - Trigger when pending batch is `<= 25` videos and `<= 20,000` subtitle rows.
  - Best for targeted repair or confidence checks.
- Medium batch:
  - Use batched `execute_values`.
  - Trigger when pending batch is `<= 500` videos and `<= 250,000` subtitle rows.
  - Best default for normal sync runs.
- Large batch:
  - Use temp tables plus `COPY` into staging tables, then merge into target tables.
  - Trigger above the medium thresholds.
  - Best when local data volume is large enough that row-wise inserts become the bottleneck.

## Storage mode rules

- `s3`:
  - Use when remote S3 credentials exist.
  - Lowest-bandwidth option for hosted Supabase storage.
  - Preferred for large sync runs.
- `rest`:
  - Use when S3 credentials are unavailable.
  - Simpler fallback path.
  - Accept the Supabase Storage REST path bandwidth tradeoff.
- `auto`:
  - Choose `s3` when both remote S3 key vars exist, otherwise choose `rest`.

## Recovery rules

- If local and remote counts drift, re-run with the same state DB first.
- If local content changed after a prior sync, use `--resync-all`.
- If only some video IDs need repair, use a temporary state DB path or delete the main state DB after confirming the scope.
