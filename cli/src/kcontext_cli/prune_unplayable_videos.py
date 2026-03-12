"""Prune unplayable YouTube videos from DB rows and storage objects."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psycopg2
from dotenv import load_dotenv

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_UNPLAYABLE_CSV_PATH = REPO_ROOT / "docs" / "unplayable_videos.csv"
SUBTITLES_BUCKET = "subtitles"
VIDEO_METADATA_BUCKET = "video-metadata"
PsycopgConnection = Any


@dataclass(frozen=True)
class UnplayableVideoRow:
    channel_id: str
    channel_name: str
    video_id: str
    status: str


@dataclass(frozen=True)
class TargetConfig:
    target: str
    db_url: str | None
    db_kwargs: dict[str, object] | None
    supabase_url: str
    service_role_key: str


@dataclass(frozen=True)
class LocalStorageBackend:
    container_name: str
    base_path: str


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def parse_key_value_lines(text: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for line in text.splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        parsed[key.strip()] = value.strip().strip('"')
    return parsed


def load_unplayable_rows(csv_path: Path) -> list[UnplayableVideoRow]:
    with csv_path.open(encoding="utf-8") as file_obj:
        reader = csv.DictReader(file_obj)
        required = {"channel_id", "channel_name", "video_id", "status"}
        if reader.fieldnames is None or set(reader.fieldnames) != required:
            raise ValueError(f"Expected CSV columns {sorted(required)}, got {reader.fieldnames!r}")

        seen: set[str] = set()
        rows: list[UnplayableVideoRow] = []
        for line_no, row in enumerate(reader, start=2):
            video_id = str(row.get("video_id") or "").strip()
            if not video_id:
                raise ValueError(f"Missing video_id on line {line_no}")
            if video_id in seen:
                continue
            seen.add(video_id)
            rows.append(
                UnplayableVideoRow(
                    channel_id=str(row.get("channel_id") or "").strip(),
                    channel_name=str(row.get("channel_name") or "").strip(),
                    video_id=video_id,
                    status=str(row.get("status") or "").strip(),
                )
            )
    return rows


def _extract_status(row: UnplayableVideoRow | dict[str, object]) -> str:
    if isinstance(row, dict):
        return str(row.get("status") or "").strip()
    return str(row.status).strip()


def summarize_statuses(rows: list[UnplayableVideoRow]) -> dict[str, int]:
    counter = Counter(_extract_status(row) for row in rows)
    return {status: counter[status] for status in sorted(counter)}


def count_rows_by_status(rows: list[UnplayableVideoRow]) -> dict[str, int]:
    return summarize_statuses(rows)


def build_storage_delete_batches(video_ids: list[str], batch_size: int) -> list[list[str]]:
    object_names = [f"{video_id}.json" for video_id in video_ids]
    return chunked(object_names, batch_size)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--csv",
        default=str(DEFAULT_UNPLAYABLE_CSV_PATH),
        help=f"Path to unplayable CSV (default: {DEFAULT_UNPLAYABLE_CSV_PATH})",
    )
    parser.add_argument(
        "--target",
        choices=("local", "remote"),
        default="local",
        help="Target environment to prune (default: local)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for DB deletes and storage delete requests (default: 100)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete DB rows and storage objects (default: dry-run)",
    )
    return parser.parse_args()


def build_target_config(target: str) -> TargetConfig:
    if target == "local":
        status_env = load_local_supabase_status()
        supabase_url = (
            str(os.getenv("SUPABASE_URL", "")).strip()
            or str(status_env.get("API_URL", "http://127.0.0.1:54321")).strip()
        ).rstrip("/")
        service_role_key = str(os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")).strip()
        if not service_role_key or service_role_key.startswith("<"):
            service_role_key = str(status_env.get("SERVICE_ROLE_KEY", "")).strip()
        if not service_role_key:
            raise ValueError("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY")
        return TargetConfig(
            target=target,
            db_url=None,
            db_kwargs={
                "host": os.getenv("DB_HOST", "127.0.0.1"),
                "port": int(os.getenv("DB_PORT", "54322")),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", "postgres"),
                "dbname": os.getenv("DB_NAME", "postgres"),
            },
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )

    supabase_url = str(os.getenv("REMOTE_SUPABASE_URL", "")).rstrip("/")
    service_role_key = str(os.getenv("REMOTE_SUPABASE_SERVICE_ROLE_KEY", "")).strip()
    db_url = str(os.getenv("REMOTE_DB_URL", "")).strip()

    if not supabase_url:
        raise ValueError("Missing required environment variable: REMOTE_SUPABASE_URL")
    if not service_role_key:
        raise ValueError("Missing required environment variable: REMOTE_SUPABASE_SERVICE_ROLE_KEY")
    if not db_url:
        raise ValueError("Missing required environment variable: REMOTE_DB_URL")

    return TargetConfig(
        target=target,
        db_url=db_url,
        db_kwargs=None,
        supabase_url=supabase_url,
        service_role_key=service_role_key,
    )


def load_local_supabase_status() -> dict[str, str]:
    try:
        result = subprocess.run(
            ["supabase", "status", "-o", "env"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return {}
    return parse_key_value_lines(result.stdout)


def discover_local_storage_backend() -> LocalStorageBackend:
    project_name = REPO_ROOT.name
    try:
        ps_result = subprocess.run(
            [
                "docker",
                "ps",
                "--filter",
                f"label=com.supabase.cli.project={project_name}",
                "--format",
                "{{.Names}}",
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError("Failed to inspect local storage container") from exc

    container_names = [
        line.strip()
        for line in ps_result.stdout.splitlines()
        if line.strip().startswith("supabase_storage_")
    ]
    if len(container_names) != 1:
        raise RuntimeError(
            f"Expected exactly one local storage container, found {container_names or 'none'}"
        )

    container_name = container_names[0]
    try:
        inspect_result = subprocess.run(
            ["docker", "inspect", container_name, "--format", "{{json .Config.Env}}"],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"Failed to inspect local storage backend: {container_name}") from exc

    raw_env = json.loads(inspect_result.stdout)
    env_vars = parse_key_value_lines("\n".join(raw_env))
    storage_root = str(env_vars.get("FILE_STORAGE_BACKEND_PATH", "/mnt")).rstrip("/")
    global_bucket = str(env_vars.get("GLOBAL_S3_BUCKET", "stub")).strip() or "stub"
    tenant_id = str(env_vars.get("TENANT_ID", "stub")).strip() or "stub"

    return LocalStorageBackend(
        container_name=container_name,
        base_path=f"{storage_root}/{global_bucket}/{tenant_id}",
    )


def connect_db(config: TargetConfig) -> PsycopgConnection:
    if config.db_url is not None:
        return psycopg2.connect(config.db_url)
    if config.db_kwargs is None:
        raise RuntimeError("Missing DB configuration")
    return psycopg2.connect(**config.db_kwargs)


def count_rows_by_ids(
    conn: PsycopgConnection,
    table: str,
    id_column: str,
    video_ids: list[str],
    batch_size: int,
) -> int:
    total = 0
    with conn.cursor() as cur:
        for batch in chunked(video_ids, batch_size):
            cur.execute(
                f"SELECT COUNT(*) FROM {table} WHERE {id_column} = ANY(%s)",
                (batch,),
            )
            total += int(cur.fetchone()[0])
    return total


def count_storage_objects(
    conn: PsycopgConnection,
    bucket: str,
    object_names: list[str],
    batch_size: int,
) -> int:
    total = 0
    with conn.cursor() as cur:
        for batch in chunked(object_names, batch_size):
            cur.execute(
                """
                SELECT COUNT(*)
                FROM storage.objects
                WHERE bucket_id = %s
                  AND name = ANY(%s)
                """,
                (bucket, batch),
            )
            total += int(cur.fetchone()[0])
    return total


def collect_counts(
    conn: PsycopgConnection,
    video_ids: list[str],
    batch_size: int,
) -> dict[str, object]:
    object_names = [f"{video_id}.json" for video_id in video_ids]
    return {
        "video_count": count_rows_by_ids(conn, "video", "id", video_ids, batch_size),
        "subtitle_count": count_rows_by_ids(conn, "subtitle", "video_id", video_ids, batch_size),
        "storage": {
            SUBTITLES_BUCKET: count_storage_objects(
                conn,
                SUBTITLES_BUCKET,
                object_names,
                batch_size,
            ),
            VIDEO_METADATA_BUCKET: count_storage_objects(
                conn,
                VIDEO_METADATA_BUCKET,
                object_names,
                batch_size,
            ),
        },
    }


def delete_video_rows(conn: PsycopgConnection, video_ids: list[str], batch_size: int) -> int:
    deleted = 0
    with conn.cursor() as cur:
        for batch in chunked(video_ids, batch_size):
            cur.execute("DELETE FROM video WHERE id = ANY(%s)", (batch,))
            deleted += cur.rowcount
    conn.commit()
    return deleted


def http_request(
    url: str,
    method: str,
    headers: dict[str, str],
    body: bytes,
    timeout_sec: int = 30,
) -> bytes:
    request = Request(url=url, method=method, headers=headers, data=body)
    try:
        with urlopen(request, timeout=timeout_sec) as response:
            return response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code} for {method} {url}: {detail[:500]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Network error for {method} {url}: {exc}") from exc


def delete_storage_objects(
    config: TargetConfig,
    bucket: str,
    object_names: list[str],
    batch_size: int,
    conn: PsycopgConnection | None = None,
) -> int:
    if not object_names:
        return 0

    if config.target == "local":
        if conn is None:
            raise RuntimeError("Local storage deletion requires a DB connection")
        delete_local_storage_files(bucket, object_names, batch_size)
        delete_local_storage_rows(conn, bucket, object_names, batch_size)
        return len(object_names)

    delete_url = f"{config.supabase_url}/storage/v1/object/{bucket}"
    headers = {
        "Authorization": f"Bearer {config.service_role_key}",
        "apikey": config.service_role_key,
        "Content-Type": "application/json",
    }

    requested = 0
    for batch in chunked(object_names, batch_size):
        payload = json.dumps({"prefixes": batch}).encode("utf-8")
        http_request(delete_url, "DELETE", headers=headers, body=payload)
        requested += len(batch)
    return requested


def delete_local_storage_files(bucket: str, object_names: list[str], batch_size: int) -> None:
    backend = discover_local_storage_backend()
    for batch in chunked(object_names, batch_size):
        target_paths = [f"{backend.base_path}/{bucket}/{name}" for name in batch]
        try:
            subprocess.run(
                ["docker", "exec", backend.container_name, "rm", "-rf", "--", *target_paths],
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
            )
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise RuntimeError(
                f"Failed to remove local storage files from {backend.container_name}"
            ) from exc


def delete_local_storage_rows(
    conn: PsycopgConnection,
    bucket: str,
    object_names: list[str],
    batch_size: int,
) -> int:
    deleted = 0
    with conn.cursor() as cur:
        cur.execute("SET LOCAL storage.allow_delete_query = 'true'")
        for batch in chunked(object_names, batch_size):
            cur.execute(
                """
                DELETE FROM storage.objects
                WHERE bucket_id = %s
                  AND name = ANY(%s)
                """,
                (bucket, batch),
            )
            deleted += cur.rowcount
    conn.commit()
    return deleted


def build_summary(
    rows: list[UnplayableVideoRow],
    counts: dict[str, object],
    *,
    csv_path: Path,
    target: str,
    apply: bool,
    batch_size: int,
) -> dict[str, object]:
    return {
        "csv_path": str(csv_path),
        "target": target,
        "apply": apply,
        "batch_size": batch_size,
        "candidate_count": len(rows),
        "status_counts": count_rows_by_status(rows),
        "before": counts,
    }


def main() -> int:
    args = parse_args()
    csv_path = Path(args.csv).expanduser()
    if not csv_path.exists():
        raise SystemExit(f"Error: CSV file not found: {csv_path}")
    if args.batch_size < 1:
        raise SystemExit("Error: --batch-size must be >= 1")

    try:
        rows = load_unplayable_rows(csv_path)
        config = build_target_config(args.target)
    except ValueError as exc:
        raise SystemExit(f"Error: {exc}") from exc

    video_ids = [row.video_id for row in rows]
    object_names = [f"{video_id}.json" for video_id in video_ids]

    conn = connect_db(config)
    try:
        before_counts = collect_counts(conn, video_ids, args.batch_size)
        summary = build_summary(
            rows,
            before_counts,
            csv_path=csv_path,
            target=args.target,
            apply=args.apply,
            batch_size=args.batch_size,
        )

        if not args.apply:
            print(json.dumps(summary, ensure_ascii=False, indent=2))
            return 0

        deleted_video_count = delete_video_rows(conn, video_ids, args.batch_size)
        requested_subtitle_storage_deletes = delete_storage_objects(
            config,
            SUBTITLES_BUCKET,
            object_names,
            args.batch_size,
            conn,
        )
        requested_metadata_storage_deletes = delete_storage_objects(
            config,
            VIDEO_METADATA_BUCKET,
            object_names,
            args.batch_size,
            conn,
        )
        after_counts = collect_counts(conn, video_ids, args.batch_size)

        summary["deleted"] = {
            "video_count": deleted_video_count,
            "storage_delete_requests": {
                SUBTITLES_BUCKET: requested_subtitle_storage_deletes,
                VIDEO_METADATA_BUCKET: requested_metadata_storage_deletes,
            },
        }
        summary["after"] = after_counts
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
