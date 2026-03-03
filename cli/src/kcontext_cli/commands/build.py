"""Transform raw JSON into build artifacts for Supabase DB and Storage."""

import csv
import json
import os
from pathlib import Path

import typer

REQUIRED_KEYS = {"video_id", "title", "channel_name", "published_at", "transcript"}


def _sanitize_tab(text: str) -> str:
    return text.replace("\t", " ")


def build_artifacts(
    input_path: Path = typer.Argument(help="Path to raw JSON file from fetch command"),  # noqa: B008
    output_dir: Path = typer.Option(..., "-d", "--dir", help="Output directory for artifacts"),  # noqa: B008
) -> None:
    """Transform raw JSON into storage JSON and TSV artifacts."""
    if not input_path.exists():
        typer.echo(f"Error: Input file not found: {input_path}", err=True)
        raise typer.Exit(code=1)

    try:
        with open(input_path, encoding="utf-8") as f:
            raw = json.load(f)
    except json.JSONDecodeError as exc:
        typer.echo(f"Error: Invalid JSON in {input_path}: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    missing = REQUIRED_KEYS - set(raw.keys())
    if missing:
        typer.echo(f"Error: Missing required keys: {missing}", err=True)
        raise typer.Exit(code=1)

    video_id = raw["video_id"]
    os.makedirs(output_dir, exist_ok=True)

    transcript = raw.get("transcript", [])
    if not transcript:
        typer.echo(f"Warning: Empty transcript for {video_id}", err=True)

    storage_data = [
        {
            "start_time": chunk["start"],
            "duration": chunk["duration"],
            "text": _sanitize_tab(chunk["text"]),
        }
        for chunk in transcript
    ]
    storage_path = output_dir / f"{video_id}_storage.json"
    with open(storage_path, "w", encoding="utf-8") as f:
        json.dump(storage_data, f, ensure_ascii=False, indent=2)

    video_path = output_dir / f"{video_id}_video.csv"
    with open(video_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(
            [
                _sanitize_tab(video_id),
                _sanitize_tab(raw["title"]),
                _sanitize_tab(raw["channel_name"]),
                _sanitize_tab(raw["published_at"]),
            ]
        )

    subtitle_path = output_dir / f"{video_id}_subtitle.csv"
    with open(subtitle_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t")
        for chunk in transcript:
            writer.writerow(
                [
                    _sanitize_tab(video_id),
                    chunk["start"],
                    _sanitize_tab(chunk["text"]),
                ]
            )

    typer.echo(f"Built 3 artifacts for {video_id} in {output_dir}", err=True)
