"""Incrementally sync local Supabase data to a remote Supabase project."""

from __future__ import annotations

import argparse
import contextlib
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
PsycopgConnection = Any


@dataclass
class SyncConfig:
    state_db: Path
    batch_size: int
    max_videos: int
    dry_run: bool
    status: bool
    local_db_host: str
    local_db_port: int
    local_db_user: str
    local_db_password: str
    local_db_name: str
    local_supabase_url: str
    storage_bucket: str
    remote_supabase_url: str | None
    remote_secret_key: str | None
    remote_db_url: str | None


@dataclass
class SyncResult:
    run_id: str
    started_at: str
    finished_at: str
    total: int
    success: int
    failed: int
    dry_run: bool
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
    parser.add_argument(
        "--state-db",
        default=".state/remote_sync.sqlite",
        help="Path to local SQLite state DB (default: .state/remote_sync.sqlite)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=20,
        help="Number of video IDs to process per batch (default: 20)",
    )
    parser.add_argument(
        "--max-videos",
        type=int,
        default=200,
        help="Max pending videos to process this run (default: 200)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview pending IDs only")
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print local/state/remote status summary without syncing",
    )
    parser.add_argument(
        "--local-db-host",
        default=os.getenv("LOCAL_DB_HOST", DEFAULT_LOCAL_DB_HOST),
    )
    parser.add_argument(
        "--local-db-port",
        type=int,
        default=int(os.getenv("LOCAL_DB_PORT", str(DEFAULT_LOCAL_DB_PORT))),
    )
    parser.add_argument(
        "--local-db-user",
        default=os.getenv("LOCAL_DB_USER", DEFAULT_LOCAL_DB_USER),
    )
    parser.add_argument(
        "--local-db-password",
        default=os.getenv("LOCAL_DB_PASSWORD", DEFAULT_LOCAL_DB_PASSWORD),
    )
    parser.add_argument(
        "--local-db-name",
        default=os.getenv("LOCAL_DB_NAME", DEFAULT_LOCAL_DB_NAME),
    )
    parser.add_argument(
        "--local-supabase-url",
        default=os.getenv("LOCAL_SUPABASE_URL", DEFAULT_LOCAL_SUPABASE_URL),
    )
    parser.add_argument(
        "--storage-bucket",
        default=os.getenv("SYNC_STORAGE_BUCKET", DEFAULT_STORAGE_BUCKET),
    )

    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")
    if args.max_videos < 1:
        parser.error("--max-videos must be >= 1")

    return SyncConfig(
        state_db=Path(args.state_db),
        batch_size=args.batch_size,
        max_videos=args.max_videos,
        dry_run=bool(args.dry_run),
        status=bool(args.status),
        local_db_host=str(args.local_db_host),
        local_db_port=int(args.local_db_port),
        local_db_user=str(args.local_db_user),
        local_db_password=str(args.local_db_password),
        local_db_name=str(args.local_db_name),
        local_supabase_url=str(args.local_supabase_url).rstrip("/"),
        storage_bucket=str(args.storage_bucket),
        remote_supabase_url=os.getenv("REMOTE_SUPABASE_URL"),
        remote_secret_key=os.getenv("REMOTE_SUPABASE_SECRET_KEY"),
        remote_db_url=os.getenv("REMOTE_DB_URL"),
    )


def state_paths(state_db: Path) -> tuple[Path, Path, Path]:
    state_db_abs = state_db if state_db.is_absolute() else (Path.cwd() / state_db)
    state_dir = state_db_abs.parent
    lock_file = state_dir / "remote_sync.lock"
    report_dir = state_dir / "runs"
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
            raise RuntimeError(
                f"Another sync process is running (pid={existing_pid}). Lock: {lock_file}"
            )

        lock_file.unlink(missing_ok=True)

    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    fd = os.open(str(lock_file), flags)
    with os.fdopen(fd, "w", encoding="utf-8") as file_obj:
        json.dump({"pid": os.getpid(), "created_at": utc_now_iso()}, file_obj)


def release_lock(lock_file: Path) -> None:
    lock_file.unlink(missing_ok=True)


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
          error_summary TEXT
        )
        """
    )
    conn.commit()


def insert_run_start(conn: sqlite3.Connection, run_id: str, started_at: str, dry_run: bool) -> None:
    conn.execute(
        """
        INSERT INTO sync_run (
          run_id, started_at, finished_at, total, success, failed, dry_run, error_summary
        )
        VALUES (?, ?, NULL, 0, 0, 0, ?, '')
        """,
        (run_id, started_at, 1 if dry_run else 0),
    )
    conn.commit()


def update_run_end(
    conn: sqlite3.Connection,
    run_id: str,
    finished_at: str,
    total: int,
    success: int,
    failed: int,
    error_summary: str,
) -> None:
    conn.execute(
        """
        UPDATE sync_run
        SET finished_at = ?, total = ?, success = ?, failed = ?, error_summary = ?
        WHERE run_id = ?
        """,
        (finished_at, total, success, failed, error_summary, run_id),
    )
    conn.commit()


def sqlite_connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def connect_local_db(config: SyncConfig) -> PsycopgConnection:
    return psycopg2.connect(
        host=config.local_db_host,
        port=config.local_db_port,
        user=config.local_db_user,
        password=config.local_db_password,
        dbname=config.local_db_name,
    )


def connect_remote_db(config: SyncConfig) -> PsycopgConnection:
    if not config.remote_db_url:
        raise RuntimeError("Missing required environment variable: REMOTE_DB_URL")
    return psycopg2.connect(config.remote_db_url)


def fetch_migration_versions(conn: PsycopgConnection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version::text"
        )
        return [str(row[0]) for row in cur.fetchall()]


def preflight_checks(
    local_conn: PsycopgConnection,
    remote_conn: PsycopgConnection,
) -> None:
    with local_conn.cursor() as cur:
        cur.execute("SELECT 1")
    with remote_conn.cursor() as cur:
        cur.execute("SELECT 1")

    local_versions = fetch_migration_versions(local_conn)
    remote_versions = fetch_migration_versions(remote_conn)
    missing_on_remote = [version for version in local_versions if version not in remote_versions]

    if missing_on_remote:
        versions = ", ".join(missing_on_remote)
        raise RuntimeError(f"Remote migration history missing required versions: {versions}")

    if len(remote_versions) > len(local_versions):
        print(
            "Warning: remote has additional migrations beyond local state.",
            file=sys.stderr,
        )


def fetch_all_local_video_ids(local_conn: PsycopgConnection) -> list[str]:
    with local_conn.cursor() as cur:
        cur.execute("SELECT id FROM video ORDER BY published_at DESC NULLS LAST, id")
        return [str(row[0]) for row in cur.fetchall()]


def fetch_synced_video_ids(state_conn: sqlite3.Connection) -> set[str]:
    rows = state_conn.execute("SELECT video_id FROM synced_video").fetchall()
    return {str(row["video_id"]) for row in rows}


def fetch_local_video(
    local_conn: PsycopgConnection,
    video_id: str,
) -> tuple[str, str, str, Any, str] | None:
    with local_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, channel_name, published_at, audio_language_code
            FROM video
            WHERE id = %s
            """,
            (video_id,),
        )
        row = cur.fetchone()

    if row is None:
        return None

    return (str(row[0]), str(row[1]), str(row[2]), row[3], str(row[4] or "ko"))


def fetch_local_subtitles(
    local_conn: PsycopgConnection,
    video_id: str,
) -> list[tuple[str, float, str]]:
    with local_conn.cursor() as cur:
        cur.execute(
            """
            SELECT video_id, start_time, text
            FROM subtitle
            WHERE video_id = %s
            ORDER BY start_time, id
            """,
            (video_id,),
        )
        rows = cur.fetchall()

    return [(str(row[0]), float(row[1]), str(row[2])) for row in rows]


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
        return http_request(url=public_url, method="GET")
    except RuntimeError as public_error:
        local_secret_key = os.getenv("LOCAL_SUPABASE_SECRET_KEY")
        if not local_secret_key:
            raise RuntimeError(
                f"Local storage fetch failed via public URL for {video_id}: {public_error}"
            ) from public_error

        api_url = (
            f"{config.local_supabase_url}/storage/v1/object/{config.storage_bucket}/{video_id}.json"
        )
        headers = {"apikey": local_secret_key}
        try:
            return http_request(url=api_url, method="GET", headers=headers)
        except RuntimeError as api_error:
            raise RuntimeError(
                f"Local storage fetch failed for {video_id}. "
                f"public_error={public_error}; api_error={api_error}"
            ) from api_error


def upload_remote_storage_json(config: SyncConfig, video_id: str, payload: bytes) -> None:
    if not config.remote_supabase_url:
        raise RuntimeError("Missing required environment variable: REMOTE_SUPABASE_URL")
    if not config.remote_secret_key:
        raise RuntimeError("Missing required environment variable: REMOTE_SUPABASE_SECRET_KEY")

    url = (
        f"{config.remote_supabase_url.rstrip('/')}/storage/v1/object/"
        f"{config.storage_bucket}/{video_id}.json"
    )
    headers = {
        "apikey": config.remote_secret_key,
        "Content-Type": "application/json",
        "x-upsert": "true",
    }
    http_request(url=url, method="POST", headers=headers, body=payload)


def upsert_remote_db(
    remote_conn: PsycopgConnection,
    video: tuple[str, str, str, Any, str],
    subtitles: list[tuple[str, float, str]],
) -> None:
    video_id, title, channel_name, published_at, audio_language_code = video

    with remote_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO video (id, title, channel_name, published_at, audio_language_code)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              channel_name = EXCLUDED.channel_name,
              published_at = EXCLUDED.published_at,
              audio_language_code = EXCLUDED.audio_language_code
            """,
            (video_id, title, channel_name, published_at, audio_language_code),
        )

        cur.execute("DELETE FROM subtitle WHERE video_id = %s", (video_id,))

        if subtitles:
            execute_values(
                cur,
                "INSERT INTO subtitle (video_id, start_time, text) VALUES %s",
                subtitles,
                page_size=1000,
            )

    remote_conn.commit()


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
        "synced_video_ids": result.synced_video_ids,
        "pending_video_ids": result.pending_video_ids,
        "failures": result.failures,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def do_status(config: SyncConfig, state_db_abs: Path) -> int:
    summary: dict[str, Any] = {
        "timestamp": utc_now_iso(),
        "state_db": str(state_db_abs),
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
    try:
        with local_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM video")
            local_video_count = int(cur.fetchone()[0])
            cur.execute("SELECT COUNT(*) FROM subtitle")
            local_subtitle_count = int(cur.fetchone()[0])
            cur.execute(
                "SELECT COUNT(*) FROM storage.objects WHERE bucket_id = %s",
                (config.storage_bucket,),
            )
            local_storage_count = int(cur.fetchone()[0])

        summary["local"]["video_count"] = local_video_count
        summary["local"]["subtitle_count"] = local_subtitle_count
        summary["local"]["storage_object_count"] = local_storage_count
        summary["state"]["pending_estimate"] = max(
            0,
            local_video_count - int(summary["state"]["synced_video_count"]),
        )
    finally:
        local_conn.close()

    if config.remote_db_url:
        remote_conn = connect_remote_db(config)
        try:
            with remote_conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM video")
                remote_video_count = int(cur.fetchone()[0])
                cur.execute("SELECT COUNT(*) FROM subtitle")
                remote_subtitle_count = int(cur.fetchone()[0])
                cur.execute(
                    "SELECT COUNT(*) FROM storage.objects WHERE bucket_id = %s",
                    (config.storage_bucket,),
                )
                remote_storage_count = int(cur.fetchone()[0])

            summary["remote"]["video_count"] = remote_video_count
            summary["remote"]["subtitle_count"] = remote_subtitle_count
            summary["remote"]["storage_object_count"] = remote_storage_count
        finally:
            remote_conn.close()
    else:
        summary["remote"]["warning"] = "REMOTE_DB_URL not set; remote counts unavailable"

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def sync(config: SyncConfig, state_db_abs: Path, lock_file: Path, report_dir: Path) -> int:
    acquire_lock(lock_file)

    run_id = build_run_id()
    started_at = utc_now_iso()

    state_conn = sqlite_connect(state_db_abs)
    local_conn: PsycopgConnection | None = None
    remote_conn: PsycopgConnection | None = None

    try:
        init_state_db(state_conn)
        insert_run_start(state_conn, run_id, started_at, config.dry_run)

        local_conn = connect_local_db(config)
        remote_conn = connect_remote_db(config)

        preflight_checks(local_conn, remote_conn)

        local_ids = fetch_all_local_video_ids(local_conn)
        synced_ids = fetch_synced_video_ids(state_conn)
        pending_ids = [video_id for video_id in local_ids if video_id not in synced_ids]
        pending_ids = pending_ids[: config.max_videos]

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
                failures=[],
                synced_video_ids=[],
                pending_video_ids=pending_ids,
            )
            report_path = write_run_report(report_dir, result)
            update_run_end(
                state_conn,
                run_id,
                finished_at,
                total=result.total,
                success=result.success,
                failed=result.failed,
                error_summary="",
            )
            print(f"Dry-run pending video IDs: {len(pending_ids)}")
            print(f"Report: {report_path}")
            return 0

        success_count = 0
        failures: list[dict[str, str]] = []
        synced_video_ids: list[str] = []

        for offset in range(0, len(pending_ids), config.batch_size):
            batch = pending_ids[offset : offset + config.batch_size]
            print(
                f"Processing batch {offset // config.batch_size + 1} ({len(batch)} videos)...",
                file=sys.stderr,
            )

            for video_id in batch:
                try:
                    video = fetch_local_video(local_conn, video_id)
                    if video is None:
                        raise RuntimeError(f"video not found in local DB: {video_id}")

                    subtitles = fetch_local_subtitles(local_conn, video_id)
                    payload = download_local_storage_json(config, video_id)

                    upload_remote_storage_json(config, video_id, payload)
                    upsert_remote_db(remote_conn, video, subtitles)
                    mark_synced(state_conn, video_id, run_id)

                    success_count += 1
                    synced_video_ids.append(video_id)
                except Exception as exc:
                    error_message = str(exc)
                    failures.append({"video_id": video_id, "error": error_message})
                    if remote_conn is not None:
                        remote_conn.rollback()
                    print(f"Failed {video_id}: {error_message}", file=sys.stderr)

        finished_at = utc_now_iso()
        failed_count = len(failures)
        result = SyncResult(
            run_id=run_id,
            started_at=started_at,
            finished_at=finished_at,
            total=len(pending_ids),
            success=success_count,
            failed=failed_count,
            dry_run=False,
            failures=failures,
            synced_video_ids=synced_video_ids,
            pending_video_ids=pending_ids,
        )

        report_path = write_run_report(report_dir, result)
        error_summary = truncate_error_summary(failures)
        update_run_end(
            state_conn,
            run_id,
            finished_at,
            total=result.total,
            success=result.success,
            failed=result.failed,
            error_summary=error_summary,
        )

        print(
            f"Sync finished: total={result.total} success={result.success} failed={result.failed}"
        )
        print(f"Report: {report_path}")

        if failed_count > 0:
            return EXIT_PARTIAL
        return 0
    except Exception as exc:
        finished_at = utc_now_iso()
        error_summary = truncate_error_summary([{"video_id": "_fatal", "error": str(exc)}])

        with contextlib.suppress(Exception):
            update_run_end(
                state_conn,
                run_id,
                finished_at,
                total=0,
                success=0,
                failed=1,
                error_summary=error_summary,
            )

        result = SyncResult(
            run_id=run_id,
            started_at=started_at,
            finished_at=finished_at,
            total=0,
            success=0,
            failed=1,
            dry_run=config.dry_run,
            failures=[{"video_id": "_fatal", "error": str(exc)}],
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

    if config.status:
        try:
            return do_status(config, state_db_abs)
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
