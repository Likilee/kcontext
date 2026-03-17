"""Transform metadata raw JSON into a storage upload artifact."""

from __future__ import annotations

import json
import os
import pathlib  # noqa: TC003

import typer

from kcontext_cli.audio_language import (
    AUDIO_LANGUAGE_CODE_OPTION_HELP,
    resolve_audio_language_code,
)

REQUIRED_KEYS = {
    "video_id",
    "title",
    "channel_name",
    "published_at",
    "channel_id",
    "uploader_id",
    "uploader_url",
    "duration_sec",
    "thumbnail_url",
    "description",
    "categories",
    "tags",
    "source_backend",
    "fetched_at",
}


def build_metadata_artifact(
    input_path: pathlib.Path = typer.Argument(  # noqa: B008
        help="Path to metadata raw JSON file from fetch command"
    ),
    output_dir: pathlib.Path = typer.Option(  # noqa: B008
        ...,
        "-d",
        "--dir",
        help="Output directory for artifacts",
    ),
    default_audio_language_code: str = typer.Option(
        ...,
        "--default-audio-language-code",
        help=AUDIO_LANGUAGE_CODE_OPTION_HELP,
    ),
) -> None:
    """Transform metadata raw JSON into a storage JSON artifact."""
    if not input_path.exists():
        typer.echo(f"Error: Input file not found: {input_path}", err=True)
        raise typer.Exit(code=1)

    try:
        with open(input_path, encoding="utf-8") as file_obj:
            raw = json.load(file_obj)
    except json.JSONDecodeError as exc:
        typer.echo(f"Error: Invalid JSON in {input_path}: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    missing = REQUIRED_KEYS - set(raw.keys())
    if missing:
        typer.echo(f"Error: Missing required keys: {missing}", err=True)
        raise typer.Exit(code=1)

    try:
        audio_language_code = resolve_audio_language_code(
            raw.get("audio_language_code"),
            default_audio_language_code=default_audio_language_code,
        )
    except ValueError as exc:
        typer.echo(f"Error: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    video_id = raw["video_id"]
    os.makedirs(output_dir, exist_ok=True)

    output_path = output_dir / f"{video_id}_metadata_storage.json"
    normalized_raw = {**raw, "audio_language_code": audio_language_code}
    with open(output_path, "w", encoding="utf-8") as file_obj:
        json.dump(normalized_raw, file_obj, ensure_ascii=False, indent=2)

    typer.echo(f"Built metadata artifact for {video_id} in {output_dir}", err=True)
