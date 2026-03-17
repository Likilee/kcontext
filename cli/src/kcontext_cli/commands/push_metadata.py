"""Upload metadata storage JSON to Supabase Storage."""

from __future__ import annotations

import json
import os
import pathlib  # noqa: TC003

import typer
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
METADATA_STORAGE_BUCKET = "video-metadata"
METADATA_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"
METADATA_STORAGE_OPTION = typer.Option(
    ...,
    "-m",
    "--metadata-storage",
    help="Path to _metadata_storage.json file",
)


def push_metadata(
    metadata_storage: pathlib.Path = METADATA_STORAGE_OPTION,
) -> None:
    """Upload metadata storage JSON into the video-metadata bucket."""
    if not metadata_storage.exists():
        typer.echo(f"Error: metadata storage file not found: {metadata_storage}", err=True)
        raise typer.Exit(code=1)

    try:
        payload = json.loads(metadata_storage.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        typer.echo(f"Error: Invalid JSON in {metadata_storage}: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    video_id = str(payload.get("video_id") or "").strip()
    if not video_id:
        typer.echo(f"Error: metadata storage JSON missing video_id: {metadata_storage}", err=True)
        raise typer.Exit(code=1)

    typer.echo(f"Uploading {metadata_storage.name} to Storage...", err=True)
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
        with open(metadata_storage, "rb") as file_obj:
            supabase.storage.from_(METADATA_STORAGE_BUCKET).upload(
                path=f"{video_id}.json",
                file=file_obj,
                file_options={
                    "cache-control": METADATA_CACHE_CONTROL,
                    "content-type": "application/json",
                    "upsert": "true",
                },
            )
    except Exception as exc:
        typer.echo(f"Error: Metadata storage upload failed: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    typer.echo(f"Successfully pushed metadata for {video_id}", err=True)
