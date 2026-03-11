#!/usr/bin/env python3
"""Sync local Supabase DB and storage to remote Supabase using direct DB writes."""

from __future__ import annotations

import argparse
import contextlib
import csv
import io
import json
import os
import sqlite3
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psycopg2
from psycopg2.extras import execute_values

EXIT_FATAL = 1
EXIT_PARTIAL = 2
DEFAULT_LOCAL_DB_HOST = "127.0.0.1"
DEFAULT_LOCAL_DB_PORT = 54322
DEFAULT_LOCAL_DB_USER = "postgres"
DEFAULT_LOCAL_DB_PASSWORD = "postgres"
DEFAULT_LOCAL_DB_NAME = "postgres"
DEFAULT_LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
DEFAULT_STORAGE_BUCKET = "subtitles"
DEFAULT_STATE_DB = ".state/direct_remote_sync.sqlite"
PsycopgConnection = Any


@dataclass
class SyncConfig:
    state_db: Path
    batch_size: int
    max_videos: int
    dry_run: bool
    status: bool
    resync_all: bool
    storage_mode: str
    local_db_host: str
    local_db_port: int
    local_db_user: str
    local_db_password: str
    local_db_name: str
    local_supabase_url: str
    storage_bucket: str
    remote_supabase_url: str
    remote_service_role_key: str
    remote_db_url: str
    remote_s3_endpoint_url: str | None
    remote_s3_region: str
    remote_s3_access_key_id: str | None
    remote_s3_secret_access_key: str | None


@dataclass
class SyncResult:
    run_id: str
    started_at: str
    finished_at: str
    total: int
    success: int
    failed: int
    dry_run: bool
    storage_mode: str
    db_strategy: str
    failures: list[dict[str, str]]
    synced_video_ids: list[str]
    pending_video_ids: list[str]


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_run_id() -> str:
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{timestamp}-{os.getpid()}"


def parse_args() -> SyncConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-db", default=DEFAULT_STATE_DB)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--max-videos", type=int, default=200)
    parser.add_argument("--storage-mode", choices=("auto", "s3", "rest"), default="auto")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--resync-all", action="store_true")
    parser.add_argument("--local-db-host", default=os.getenv("LOCAL_DB_HOST", DEFAULT_LOCAL_DB_HOST))
    parser.add_argument(
        "--local-db-port",
        type=int,
        default=int(os.getenv("LOCAL_DB_PORT", str(DEFAULT_LOCAL_DB_PORT))),
    )
    parser.add_argument("--local-db-user", default=os.getenv("LOCAL_DB_USER", DEFAULT_LOCAL_DB_USER))
    parser.add_argument(
        "--local-db-password",
        default=os.getenv("LOCAL_DB_PASSWORD", DEFAULT_LOCAL_DB_PASSWORD),
    )
    parser.add_argument("--local-db-name", default=os.getenv("LOCAL_DB_NAME", DEFAULT_LOCAL_DB_NAME))
    parser.add_argument(
        "--local-supabase-url",
        default=os.getenv("LOCAL_SUPABASE_URL", DEFAULT_LOCAL_SUPABASE_URL),
    )
    parser.add_argument(
        "--storage-bucket",
        default=os.getenv("SYNC_STORAGE_BUCKET", DEFAULT_STORAGE_BUCKET),
    )
    args = parser.parse_args()

    remote_supabase_url = os.getenv("REMOTE_SUPABASE_URL", "").rstrip("/")
    remote_service_role_key = os.getenv("REMOTE_SUPABASE_SERVICE_ROLE_KEY", "")
    remote_db_url = os.getenv("REMOTE_DB_URL", "")

    if not remote_supabase_url:
        parser.error("REMOTE_SUPABASE_URL is required")
    if not remote_service_role_key:
        parser.error("REMOTE_SUPABASE_SERVICE_ROLE_KEY is required")
    if not remote_db_url:
        parser.error("REMOTE_DB_URL is required")

    return SyncConfig(
        state_db=Path(args.state_db),
        batch_size=args.batch_size,
        max_videos=args.max_videos,
        dry_run=bool(args.dry_run),
        status=bool(args.status),
        resync_all=bool(args.resync_all),
        storage_mode=str(args.storage_mode),
        local_db_host=str(args.local_db_host),
        local_db_port=int(args.local_db_port),
        local_db_user=str(args.local_db_user),
        local_db_password=str(args.local_db_password),
        local_db_name=str(args.local_db_name),
        local_supabase_url=str(args.local_supabase_url).rstrip("/"),
        storage_bucket=str(args.storage_bucket),
        remote_supabase_url=remote_supabase_url,
        remote_service_role_key=remote_service_role_key,
        remote_db_url=remote_db_url,
        remote_s3_endpoint_url=os.getenv("REMOTE_S3_ENDPOINT_URL"),
        remote_s3_region=os.getenv("REMOTE_S3_REGION", "us-east-1"),
        remote_s3_access_key_id=os.getenv("REMOTE_S3_ACCESS_KEY_ID"),
        remote_s3_secret_access_key=os.getenv("REMOTE_S3_SECRET_ACCESS_KEY"),
    )


def resolve_storage_mode(config: SyncConfig) -> str:
    if config.storage_mode != "auto":
        return config.storage_mode
    if config.remote_s3_access_key_id and config.remote_s3_secret_access_key:
        return "s3"
    return "rest"


def state_paths(state_db: Path) -> tuple[Path, Path, Path]:
    state_db_abs = state_db if state_db.is_absolute() else (Path.cwd() / state_db)
    state_dir = state_db_abs.parent
    lock_file = state_dir / "direct_remote_sync.lock"
    report_dir = state_dir / "direct-runs"
    return state_db_abs, lock_file, report_dir


def pid_is_running(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def acquire_lock(lock_file: Path) -> None:
    lock_file.parent.mkdir(parents=True, exist_ok=True)
    if lock_file.exists():
        try:
            lock_info = json.loads(lock_file.read_text(encoding="utf-8"))
            existing_pid = int(lock_info.get("pid", 0))
        except Exception:
            existing_pid = 0
        if pid_is_running(existing_pid):
            raise RuntimeError(f"Another direct sync process is running (pid={existing_pid}).")
        lock_file.unlink(missing_ok=True)

    fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    with os.fdopen(fd, "w", encoding="utf-8") as file_obj:
        json.dump({"pid": os.getpid(), "created_at": utc_now_iso()}, file_obj)


def release_lock(lock_file: Path) -> None:
    lock_file.unlink(missing_ok=True)


def sqlite_connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_state_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS synced_video (
          video_id TEXT PRIMARY KEY,
          synced_at TEXT NOT NULL,
          run_id TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sync_run (
          run_id TEXT PRIMARY KEY,
          started_at TEXT,
          finished_at TEXT,
          total INT,
          success INT,
          failed INT,
          dry_run INT,
          storage_mode TEXT,
          db_strategy TEXT,
          error_summary TEXT
        )
        """
    )
    conn.commit()


def insert_run_start(
    conn: sqlite3.Connection,
    run_id: str,
    started_at: str,
    dry_run: bool,
    storage_mode: str,
) -> None:
    conn.execute(
        """
        INSERT INTO sync_run (
          run_id, started_at, finished_at, total, success, failed, dry_run, storage_mode, db_strategy, error_summary
        )
        VALUES (?, ?, NULL, 0, 0, 0, ?, ?, '', '')
        """,
        (run_id, started_at, 1 if dry_run else 0, storage_mode),
    )
    conn.commit()


def update_run_end(
    conn: sqlite3.Connection,
    run_id: str,
    finished_at: str,
    total: int,
    success: int,
    failed: int,
    storage_mode: str,
    db_strategy: str,
    error_summary: str,
) -> None:
    conn.execute(
        """
        UPDATE sync_run
        SET finished_at = ?, total = ?, success = ?, failed = ?, storage_mode = ?, db_strategy = ?, error_summary = ?
        WHERE run_id = ?
        """,
        (finished_at, total, success, failed, storage_mode, db_strategy, error_summary, run_id),
    )
    conn.commit()


def connect_local_db(config: SyncConfig) -> PsycopgConnection:
    return psycopg2.connect(
        host=config.local_db_host,
        port=config.local_db_port,
        user=config.local_db_user,
        password=config.local_db_password,
        dbname=config.local_db_name,
    )


def connect_remote_db(config: SyncConfig) -> PsycopgConnection:
    return psycopg2.connect(config.remote_db_url)


def fetch_migration_versions(conn: PsycopgConnection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version::text"
        )
        return [str(row[0]) for row in cur.fetchall()]


def preflight_checks(local_conn: PsycopgConnection, remote_conn: PsycopgConnection) -> None:
    with local_conn.cursor() as cur:
        cur.execute("SELECT 1")
    with remote_conn.cursor() as cur:
        cur.execute("SELECT 1")

    local_versions = fetch_migration_versions(local_conn)
    remote_versions = fetch_migration_versions(remote_conn)
    missing = [version for version in local_versions if version not in remote_versions]
    if missing:
        raise RuntimeError(
            "Remote migration history missing required versions: " + ", ".join(missing)
        )


def fetch_all_local_video_ids(local_conn: PsycopgConnection) -> list[str]:
    with local_conn.cursor() as cur:
        cur.execute("SELECT id FROM video ORDER BY published_at DESC NULLS LAST, id")
        return [str(row[0]) for row in cur.fetchall()]


def fetch_synced_video_ids(state_conn: sqlite3.Connection) -> set[str]:
    rows = state_conn.execute("SELECT video_id FROM synced_video").fetchall()
    return {str(row["video_id"]) for row in rows}


def fetch_remote_counts(remote_conn: PsycopgConnection, bucket: str) -> dict[str, int]:
    with remote_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM video")
        video_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM subtitle")
        subtitle_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM storage.objects WHERE bucket_id = %s", (bucket,))
        storage_count = int(cur.fetchone()[0])
    return {
        "video_count": video_count,
        "subtitle_count": subtitle_count,
        "storage_object_count": storage_count,
    }


def fetch_local_counts(local_conn: PsycopgConnection, bucket: str) -> dict[str, int]:
    with local_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM video")
        video_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM subtitle")
        subtitle_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM storage.objects WHERE bucket_id = %s", (bucket,))
        storage_count = int(cur.fetchone()[0])
    return {
        "video_count": video_count,
        "subtitle_count": subtitle_count,
        "storage_object_count": storage_count,
    }


def fetch_batch_videos(
    local_conn: PsycopgConnection,
    video_ids: list[str],
) -> list[tuple[str, str, str, Any]]:
    with local_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, channel_name, published_at
            FROM video
            WHERE id = ANY(%s)
            ORDER BY published_at DESC NULLS LAST, id
            """,
            (video_ids,),
        )
        return [(str(row[0]), str(row[1]), str(row[2]), row[3]) for row in cur.fetchall()]


def fetch_batch_subtitles(
    local_conn: PsycopgConnection,
    video_ids: list[str],
) -> list[tuple[str, float, str]]:
    with local_conn.cursor() as cur:
        cur.execute(
            """
            SELECT video_id, start_time, text
            FROM subtitle
            WHERE video_id = ANY(%s)
            ORDER BY video_id, start_time, id
            """,
            (video_ids,),
        )
        return [(str(row[0]), float(row[1]), str(row[2])) for row in cur.fetchall()]


def choose_db_strategy(video_count: int, subtitle_count: int) -> str:
    if video_count <= 25 and subtitle_count <= 20000:
        return "per_video"
    if video_count <= 500 and subtitle_count <= 250000:
        return "batch_values"
    return "copy_merge"


def http_request(
    url: str,
    method: str,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout_sec: int = 30,
) -> bytes:
    req = Request(url=url, method=method, headers=headers or {}, data=body)
    try:
        with urlopen(req, timeout=timeout_sec) as response:
            return response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code} for {method} {url}: {detail[:500]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Network error for {method} {url}: {exc}") from exc


def download_local_storage_json(config: SyncConfig, video_id: str) -> bytes:
    public_url = (
        f"{config.local_supabase_url}/storage/v1/object/public/"
        f"{config.storage_bucket}/{video_id}.json"
    )
    try:
        return http_request(public_url, "GET")
    except RuntimeError as public_error:
        local_service_role_key = os.getenv("LOCAL_SUPABASE_SERVICE_ROLE_KEY")
        if not local_service_role_key:
            raise RuntimeError(
                f"Local storage fetch failed for {video_id}: {public_error}"
            ) from public_error
        api_url = (
            f"{config.local_supabase_url}/storage/v1/object/{config.storage_bucket}/{video_id}.json"
        )
        headers = {
            "Authorization": f"Bearer {local_service_role_key}",
            "apikey": local_service_role_key,
        }
        return http_request(api_url, "GET", headers=headers)


def upload_remote_storage_rest(config: SyncConfig, video_id: str, payload: bytes) -> None:
    url = (
        f"{config.remote_supabase_url}/storage/v1/object/"
        f"{config.storage_bucket}/{video_id}.json"
    )
    headers = {
        "Authorization": f"Bearer {config.remote_service_role_key}",
        "apikey": config.remote_service_role_key,
        "Content-Type": "application/json",
        "x-upsert": "true",
    }
    http_request(url, "POST", headers=headers, body=payload)


def upload_remote_storage_s3(config: SyncConfig, video_id: str, payload: bytes) -> None:
    if not config.remote_s3_access_key_id or not config.remote_s3_secret_access_key:
        raise RuntimeError("REMOTE_S3_ACCESS_KEY_ID and REMOTE_S3_SECRET_ACCESS_KEY are required")

    endpoint_url = config.remote_s3_endpoint_url or f"{config.remote_supabase_url}/storage/v1/s3"

    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise RuntimeError("boto3 is required for storage-mode=s3") from exc

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        region_name=config.remote_s3_region,
        aws_access_key_id=config.remote_s3_access_key_id,
        aws_secret_access_key=config.remote_s3_secret_access_key,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    client.put_object(
        Bucket=config.storage_bucket,
        Key=f"{video_id}.json",
        Body=payload,
        ContentType="application/json",
    )


def upsert_remote_db_per_video(
    remote_conn: PsycopgConnection,
    videos: list[tuple[str, str, str, Any]],
    subtitles: list[tuple[str, float, str]],
) -> None:
    subtitle_by_video: dict[str, list[tuple[str, float, str]]] = {}
    for row in subtitles:
        subtitle_by_video.setdefault(row[0], []).append(row)

    with remote_conn.cursor() as cur:
        for video_id, title, channel_name, published_at in videos:
            cur.execute(
                """
                INSERT INTO video (id, title, channel_name, published_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                  title = EXCLUDED.title,
                  channel_name = EXCLUDED.channel_name,
                  published_at = EXCLUDED.published_at
                """,
                (video_id, title, channel_name, published_at),
            )
            cur.execute("DELETE FROM subtitle WHERE video_id = %s", (video_id,))
            rows = subtitle_by_video.get(video_id, [])
            if rows:
                execute_values(
                    cur,
                    "INSERT INTO subtitle (video_id, start_time, text) VALUES %s",
                    rows,
                    page_size=1000,
                )
    remote_conn.commit()


def upsert_remote_db_batch(
    remote_conn: PsycopgConnection,
    videos: list[tuple[str, str, str, Any]],
    subtitles: list[tuple[str, float, str]],
) -> None:
    video_ids = [row[0] for row in videos]
    with remote_conn.cursor() as cur:
        if videos:
            execute_values(
                cur,
                """
                INSERT INTO video (id, title, channel_name, published_at) VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                  title = EXCLUDED.title,
                  channel_name = EXCLUDED.channel_name,
                  published_at = EXCLUDED.published_at
                """,
                videos,
                page_size=100,
            )
        cur.execute("DELETE FROM subtitle WHERE video_id = ANY(%s)", (video_ids,))
        if subtitles:
            execute_values(
                cur,
                "INSERT INTO subtitle (video_id, start_time, text) VALUES %s",
                subtitles,
                page_size=5000,
            )
    remote_conn.commit()


def copy_rows_to_temp_table(
    cur: Any,
    table_name: str,
    rows: list[tuple[Any, ...]],
) -> None:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter="\t", lineterminator="\n")
    for row in rows:
        writer.writerow(row)
    buffer.seek(0)
    cur.copy_expert(
        f"COPY {table_name} FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t')",
        buffer,
    )


def upsert_remote_db_copy(
    remote_conn: PsycopgConnection,
    videos: list[tuple[str, str, str, Any]],
    subtitles: list[tuple[str, float, str]],
) -> None:
    video_ids = [row[0] for row in videos]
    with remote_conn.cursor() as cur:
        cur.execute(
            "CREATE TEMP TABLE tmp_video (id TEXT, title TEXT, channel_name TEXT, published_at TIMESTAMPTZ) ON COMMIT DROP"
        )
        cur.execute(
            "CREATE TEMP TABLE tmp_subtitle (video_id TEXT, start_time REAL, text TEXT) ON COMMIT DROP"
        )
        if videos:
            copy_rows_to_temp_table(cur, "tmp_video", videos)
        if subtitles:
            copy_rows_to_temp_table(cur, "tmp_subtitle", subtitles)
        cur.execute(
            """
            INSERT INTO video (id, title, channel_name, published_at)
            SELECT id, title, channel_name, published_at FROM tmp_video
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              channel_name = EXCLUDED.channel_name,
              published_at = EXCLUDED.published_at
            """
        )
        cur.execute("DELETE FROM subtitle WHERE video_id = ANY(%s)", (video_ids,))
        cur.execute(
            """
            INSERT INTO subtitle (video_id, start_time, text)
            SELECT video_id, start_time, text
            FROM tmp_subtitle
            ORDER BY video_id, start_time
            """
        )
    remote_conn.commit()


def sync_batch_db(
    remote_conn: PsycopgConnection,
    videos: list[tuple[str, str, str, Any]],
    subtitles: list[tuple[str, float, str]],
    strategy: str,
) -> None:
    if strategy == "per_video":
        upsert_remote_db_per_video(remote_conn, videos, subtitles)
    elif strategy == "batch_values":
        upsert_remote_db_batch(remote_conn, videos, subtitles)
    else:
        upsert_remote_db_copy(remote_conn, videos, subtitles)


def mark_synced(state_conn: sqlite3.Connection, video_id: str, run_id: str) -> None:
    state_conn.execute(
        """
        INSERT OR REPLACE INTO synced_video (video_id, synced_at, run_id)
        VALUES (?, ?, ?)
        """,
        (video_id, utc_now_iso(), run_id),
    )
    state_conn.commit()


def truncate_error_summary(failures: list[dict[str, str]], max_chars: int = 2000) -> str:
    payload = json.dumps(failures, ensure_ascii=False)
    if len(payload) <= max_chars:
        return payload
    return payload[: max_chars - 3] + "..."


def write_run_report(report_dir: Path, result: SyncResult) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    path = report_dir / f"{result.run_id}.json"
    payload = {
        "run_id": result.run_id,
        "started_at": result.started_at,
        "finished_at": result.finished_at,
        "dry_run": result.dry_run,
        "total": result.total,
        "success": result.success,
        "failed": result.failed,
        "storage_mode": result.storage_mode,
        "db_strategy": result.db_strategy,
        "synced_video_ids": result.synced_video_ids,
        "pending_video_ids": result.pending_video_ids,
        "failures": result.failures,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def do_status(config: SyncConfig, state_db_abs: Path, storage_mode: str) -> int:
    summary: dict[str, Any] = {
        "timestamp": utc_now_iso(),
        "state_db": str(state_db_abs),
        "storage_mode": storage_mode,
        "local": {},
        "state": {},
        "remote": {},
    }

    state_conn = sqlite_connect(state_db_abs)
    try:
        init_state_db(state_conn)
        synced_count = state_conn.execute("SELECT COUNT(*) FROM synced_video").fetchone()[0]
        summary["state"]["synced_video_count"] = int(synced_count)
    finally:
        state_conn.close()

    local_conn = connect_local_db(config)
    remote_conn = connect_remote_db(config)
    try:
        summary["local"] = fetch_local_counts(local_conn, config.storage_bucket)
        summary["remote"] = fetch_remote_counts(remote_conn, config.storage_bucket)
        summary["state"]["pending_estimate"] = max(
            0,
            summary["local"]["video_count"] - summary["state"]["synced_video_count"],
        )
        summary["db_strategy_preview"] = choose_db_strategy(
            summary["state"]["pending_estimate"],
            summary["local"]["subtitle_count"],
        )
    finally:
        local_conn.close()
        remote_conn.close()

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def sync(config: SyncConfig, state_db_abs: Path, lock_file: Path, report_dir: Path) -> int:
    storage_mode = resolve_storage_mode(config)
    acquire_lock(lock_file)
    run_id = build_run_id()
    started_at = utc_now_iso()
    state_conn = sqlite_connect(state_db_abs)
    local_conn: PsycopgConnection | None = None
    remote_conn: PsycopgConnection | None = None
    db_strategy = "pending"

    try:
        init_state_db(state_conn)
        insert_run_start(state_conn, run_id, started_at, config.dry_run, storage_mode)

        local_conn = connect_local_db(config)
        remote_conn = connect_remote_db(config)
        preflight_checks(local_conn, remote_conn)

        local_ids = fetch_all_local_video_ids(local_conn)
        if config.resync_all:
            pending_ids = local_ids
        else:
            synced_ids = fetch_synced_video_ids(state_conn)
            pending_ids = [video_id for video_id in local_ids if video_id not in synced_ids]
        pending_ids = pending_ids[: config.max_videos]

        local_counts = fetch_local_counts(local_conn, config.storage_bucket)
        db_strategy = choose_db_strategy(len(pending_ids), local_counts["subtitle_count"])

        if config.dry_run:
            finished_at = utc_now_iso()
            result = SyncResult(
                run_id=run_id,
                started_at=started_at,
                finished_at=finished_at,
                total=len(pending_ids),
                success=0,
                failed=0,
                dry_run=True,
                storage_mode=storage_mode,
                db_strategy=db_strategy,
                failures=[],
                synced_video_ids=[],
                pending_video_ids=pending_ids,
            )
            report_path = write_run_report(report_dir, result)
            update_run_end(
                state_conn,
                run_id,
                finished_at,
                result.total,
                result.success,
                result.failed,
                storage_mode,
                db_strategy,
                "",
            )
            print(f"Dry-run pending video IDs: {len(pending_ids)}")
            print(f"Storage mode: {storage_mode}")
            print(f"DB strategy: {db_strategy}")
            print(f"Report: {report_path}")
            return 0

        success_count = 0
        failures: list[dict[str, str]] = []
        synced_video_ids: list[str] = []

        for offset in range(0, len(pending_ids), config.batch_size):
            batch_ids = pending_ids[offset : offset + config.batch_size]
            videos = fetch_batch_videos(local_conn, batch_ids)
            subtitles = fetch_batch_subtitles(local_conn, batch_ids)
            batch_strategy = choose_db_strategy(len(videos), len(subtitles))
            db_strategy = batch_strategy

            payloads: list[tuple[str, bytes]] = []
            for video_id in batch_ids:
                payloads.append((video_id, download_local_storage_json(config, video_id)))

            for video_id, payload in payloads:
                if storage_mode == "s3":
                    upload_remote_storage_s3(config, video_id, payload)
                else:
                    upload_remote_storage_rest(config, video_id, payload)

            sync_batch_db(remote_conn, videos, subtitles, batch_strategy)

            for video_id in batch_ids:
                mark_synced(state_conn, video_id, run_id)
                success_count += 1
                synced_video_ids.append(video_id)

        finished_at = utc_now_iso()
        result = SyncResult(
            run_id=run_id,
            started_at=started_at,
            finished_at=finished_at,
            total=len(pending_ids),
            success=success_count,
            failed=len(failures),
            dry_run=False,
            storage_mode=storage_mode,
            db_strategy=db_strategy,
            failures=failures,
            synced_video_ids=synced_video_ids,
            pending_video_ids=pending_ids,
        )
        report_path = write_run_report(report_dir, result)
        update_run_end(
            state_conn,
            run_id,
            finished_at,
            result.total,
            result.success,
            result.failed,
            storage_mode,
            db_strategy,
            truncate_error_summary(failures),
        )
        print(
            f"Direct sync finished: total={result.total} success={result.success} failed={result.failed}"
        )
        print(f"Storage mode: {storage_mode}")
        print(f"DB strategy: {db_strategy}")
        print(f"Report: {report_path}")
        return 0
    except Exception as exc:
        finished_at = utc_now_iso()
        failure = [{"video_id": "_fatal", "error": str(exc)}]
        with contextlib.suppress(Exception):
            update_run_end(
                state_conn,
                run_id,
                finished_at,
                0,
                0,
                1,
                storage_mode,
                db_strategy,
                truncate_error_summary(failure),
            )
        result = SyncResult(
            run_id=run_id,
            started_at=started_at,
            finished_at=finished_at,
            total=0,
            success=0,
            failed=1,
            dry_run=config.dry_run,
            storage_mode=storage_mode,
            db_strategy=db_strategy,
            failures=failure,
            synced_video_ids=[],
            pending_video_ids=[],
        )
        write_run_report(report_dir, result)
        print(f"Fatal error: {exc}", file=sys.stderr)
        return EXIT_FATAL
    finally:
        if remote_conn is not None:
            remote_conn.close()
        if local_conn is not None:
            local_conn.close()
        state_conn.close()
        release_lock(lock_file)


def main() -> int:
    config = parse_args()
    state_db_abs, lock_file, report_dir = state_paths(config.state_db)
    storage_mode = resolve_storage_mode(config)

    if config.status:
        try:
            return do_status(config, state_db_abs, storage_mode)
        except Exception as exc:
            print(f"Status failed: {exc}", file=sys.stderr)
            return EXIT_FATAL

    try:
        return sync(config, state_db_abs, lock_file, report_dir)
    except Exception as exc:
        print(f"Sync failed: {exc}", file=sys.stderr)
        return EXIT_FATAL


if __name__ == "__main__":
    raise SystemExit(main())
