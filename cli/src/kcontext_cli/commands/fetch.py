"""Fetch video metadata and Korean subtitles from YouTube."""

from __future__ import annotations

import json
import pathlib  # noqa: TC003

import typer

from kcontext_cli.fetch_backends import decodo_scraper_backend, ytdlp_backend
from kcontext_cli.fetch_backends.base import (
    DEFAULT_FETCH_BACKEND,
    FETCH_BACKEND_OPTION_HELP,
    FetchBackendError,
    make_metadata_output_path,
    normalize_fetch_backend_name,
)
from kcontext_cli.network.proxy import (
    YOUTUBE_PROXY_OPTION_HELP,
    classify_proxy_failure_message,
    describe_proxy_target,
    resolve_youtube_proxy_url,
)


def fetch_subtitle(
    video_id: str = typer.Argument(help="YouTube video ID"),
    output: pathlib.Path = typer.Option(  # noqa: B008
        ...,
        "-o",
        "--output",
        help="Output path for raw JSON file",
    ),
    fetch_backend: str = typer.Option(
        DEFAULT_FETCH_BACKEND,
        "--fetch-backend",
        help=FETCH_BACKEND_OPTION_HELP,
    ),
    youtube_proxy_url: str | None = typer.Option(
        None,
        "--youtube-proxy-url",
        help=YOUTUBE_PROXY_OPTION_HELP,
    ),
) -> None:
    """Fetch video metadata and Korean subtitles, write raw JSON."""
    try:
        normalized_backend = normalize_fetch_backend_name(fetch_backend)
    except ValueError as exc:
        typer.echo(f"Error: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    resolved_proxy_url: str | None = None
    if normalized_backend == "ytdlp":
        try:
            resolved_proxy_url = resolve_youtube_proxy_url(youtube_proxy_url)
        except ValueError as exc:
            typer.echo(f"Error: {exc}", err=True)
            raise typer.Exit(code=1) from exc

        if resolved_proxy_url is not None:
            proxy_target = describe_proxy_target(resolved_proxy_url) or "<invalid-proxy>"
            typer.echo(f"Using YouTube proxy: {proxy_target}", err=True)

    typer.echo(f"Using fetch backend: {normalized_backend}", err=True)
    typer.echo(f"Fetching video data for {video_id}...", err=True)
    typer.echo(f"Downloading Korean subtitles for {video_id}...", err=True)

    try:
        if normalized_backend == "ytdlp":
            fetched = ytdlp_backend.fetch(video_id=video_id, youtube_proxy_url=resolved_proxy_url)
        else:
            fetched = decodo_scraper_backend.fetch(video_id=video_id, youtube_proxy_url=None)
    except FetchBackendError as exc:
        _emit_fetch_failure(
            exc.message,
            youtube_proxy_url=resolved_proxy_url,
            error_class=exc.error_class,
            action=exc.action,
        )
        raise typer.Exit(code=1) from exc

    if not fetched.transcript:
        typer.echo(f"Error: Subtitle is empty for {video_id}", err=True)
        raise typer.Exit(code=1)

    subtitle_raw_data = {
        "video_id": fetched.metadata.video_id,
        "title": fetched.metadata.title,
        "channel_name": fetched.metadata.channel_name,
        "published_at": fetched.metadata.published_at,
        "transcript": fetched.transcript,
    }
    metadata_raw_data = fetched.metadata.to_metadata_raw_dict()
    metadata_output = make_metadata_output_path(output, fetched.metadata.video_id)

    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", encoding="utf-8") as file_obj:
        json.dump(subtitle_raw_data, file_obj, ensure_ascii=False, indent=2)

    with open(metadata_output, "w", encoding="utf-8") as file_obj:
        json.dump(metadata_raw_data, file_obj, ensure_ascii=False, indent=2)

    typer.echo(f"Saved {len(fetched.transcript)} subtitle chunks to {output}", err=True)
    typer.echo(f"Saved metadata sidecar to {metadata_output}", err=True)


def _emit_fetch_failure(
    message: str,
    youtube_proxy_url: str | None,
    *,
    error_class: str | None = None,
    action: str | None = None,
) -> None:
    resolved_error_class = error_class or classify_proxy_failure_message(message)
    prefix = f"Error [{resolved_error_class}]" if resolved_error_class is not None else "Error"
    detail = message if action is None else f"Failed to {action}: {message}"

    if youtube_proxy_url is None:
        typer.echo(f"{prefix}: {detail}", err=True)
        return

    proxy_target = describe_proxy_target(youtube_proxy_url) or "<invalid-proxy>"
    typer.echo(
        f"{prefix}: {detail} via proxy {proxy_target}",
        err=True,
    )
