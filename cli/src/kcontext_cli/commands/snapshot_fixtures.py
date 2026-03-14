"""Snapshot checked-in raw fixtures from Supabase video rows and subtitle storage."""

from __future__ import annotations

import json
import os
import pathlib  # noqa: TC003
from urllib import error, parse, request

import typer
from dotenv import load_dotenv

from kcontext_cli.audio_language import (
    AUDIO_LANGUAGE_CODE_OPTION_HELP,
    resolve_audio_language_code,
)

VIDEO_ID_OPTION = typer.Option(
    ...,
    "--video-id",
    help="Video ID to snapshot from Supabase into a checked-in raw fixture.",
)


def _resolve_env_value(explicit_value: str | None, *env_names: str) -> str | None:
    if explicit_value:
        return explicit_value

    for env_name in env_names:
        value = os.getenv(env_name)
        if value:
            return value

    return None


def _fetch_json(url: str, *, headers: dict[str, str]) -> object:
    req = request.Request(url, headers=headers)
    with request.urlopen(req, timeout=30) as response:
        return json.load(response)


def _fetch_video_row(
    supabase_url: str,
    secret_key: str,
    video_id: str,
) -> dict[str, object]:
    encoded_video_id = parse.quote(video_id, safe="")
    url = (
        f"{supabase_url.rstrip('/')}/rest/v1/video"
        f"?id=eq.{encoded_video_id}"
        "&select=id,title,channel_name,published_at,audio_language_code"
    )
    payload = _fetch_json(
        url,
        headers={
            "apikey": secret_key,
        },
    )
    if not isinstance(payload, list) or not payload:
        raise ValueError(f"Video not found in Supabase: {video_id}")

    row = payload[0]
    if not isinstance(row, dict):
        raise ValueError(f"Unexpected video payload for {video_id}: {row!r}")

    return row


def _fetch_storage_transcript(supabase_url: str, video_id: str) -> list[dict[str, object]]:
    url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/subtitles/{video_id}.json"
    payload = _fetch_json(url, headers={})
    if not isinstance(payload, list):
        raise ValueError(f"Unexpected transcript payload for {video_id}: {payload!r}")

    normalized_chunks: list[dict[str, object]] = []
    for chunk in payload:
        if not isinstance(chunk, dict):
            raise ValueError(f"Unexpected transcript chunk for {video_id}: {chunk!r}")

        normalized_chunks.append(
            {
                "start": chunk["start_time"],
                "duration": chunk["duration"],
                "text": chunk["text"],
            }
        )

    return normalized_chunks


def _build_raw_fixture(
    video_row: dict[str, object],
    transcript: list[dict[str, object]],
    *,
    default_audio_language_code: str,
) -> dict[str, object]:
    video_id = str(video_row["id"])
    title = str(video_row["title"])
    channel_name = str(video_row["channel_name"])
    published_at = str(video_row["published_at"])
    audio_language_code = resolve_audio_language_code(
        video_row.get("audio_language_code"),
        default_audio_language_code=default_audio_language_code,
    )

    return {
        "video_id": video_id,
        "title": title,
        "channel_name": channel_name,
        "published_at": published_at,
        "audio_language_code": audio_language_code,
        "transcript": transcript,
    }


def snapshot_fixtures(
    video_ids: list[str] = VIDEO_ID_OPTION,
    output_dir: pathlib.Path = typer.Option(  # noqa: B008
        ...,
        "-d",
        "--dir",
        help="Output directory for checked-in raw fixtures.",
    ),
    env_file: pathlib.Path | None = typer.Option(  # noqa: B008
        None,
        "--env-file",
        help="Optional dotenv file to load before resolving Supabase credentials.",
    ),
    supabase_url: str | None = typer.Option(
        None,
        "--supabase-url",
        help=(
            "Supabase project URL. Defaults to REMOTE_SUPABASE_URL, "
            "NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_URL."
        ),
    ),
    secret_key: str | None = typer.Option(
        None,
        "--secret-key",
        help=("Secret API key. Defaults to REMOTE_SUPABASE_SECRET_KEY or SUPABASE_SECRET_KEY."),
    ),
    default_audio_language_code: str = typer.Option(
        ...,
        "--default-audio-language-code",
        help=AUDIO_LANGUAGE_CODE_OPTION_HELP,
    ),
    prune_existing: bool = typer.Option(
        False,
        "--prune-existing",
        help=(
            "Delete other *_raw.json fixtures in the output directory "
            "before writing the requested set."
        ),
    ),
) -> None:
    """Snapshot live Supabase video rows plus subtitle storage into raw fixture JSON files."""
    if env_file is not None:
        load_dotenv(env_file, override=False)

    resolved_supabase_url = _resolve_env_value(
        supabase_url,
        "REMOTE_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_URL",
    )
    resolved_secret_key = _resolve_env_value(
        secret_key,
        "REMOTE_SUPABASE_SECRET_KEY",
        "SUPABASE_SECRET_KEY",
    )

    if not resolved_supabase_url:
        typer.echo("Error: Supabase URL is required.", err=True)
        raise typer.Exit(code=1)
    if not resolved_secret_key:
        typer.echo("Error: Secret API key is required.", err=True)
        raise typer.Exit(code=1)

    output_dir.mkdir(parents=True, exist_ok=True)

    requested_ids = set(video_ids)
    if prune_existing:
        for existing_fixture in output_dir.glob("*_raw.json"):
            if existing_fixture.stem.removesuffix("_raw") not in requested_ids:
                existing_fixture.unlink()

    for video_id in video_ids:
        typer.echo(f"Snapshotting raw fixture for {video_id}...", err=True)
        try:
            video_row = _fetch_video_row(
                resolved_supabase_url,
                resolved_secret_key,
                video_id,
            )
            transcript = _fetch_storage_transcript(resolved_supabase_url, video_id)
            raw_fixture = _build_raw_fixture(
                video_row,
                transcript,
                default_audio_language_code=default_audio_language_code,
            )
        except (ValueError, KeyError) as exc:
            typer.echo(f"Error: {exc}", err=True)
            raise typer.Exit(code=1) from exc
        except error.HTTPError as exc:
            typer.echo(
                f"Error: HTTP {exc.code} while snapshotting {video_id}: {exc.reason}",
                err=True,
            )
            raise typer.Exit(code=1) from exc
        except error.URLError as exc:
            typer.echo(
                f"Error: Network failure while snapshotting {video_id}: {exc.reason}",
                err=True,
            )
            raise typer.Exit(code=1) from exc

        output_path = output_dir / f"{video_id}_raw.json"
        output_path.write_text(
            json.dumps(raw_fixture, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        typer.echo(f"Saved fixture to {output_path}", err=True)
