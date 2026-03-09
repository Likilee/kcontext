"""Fetch video metadata and Korean subtitles from YouTube."""

import json
import subprocess
import urllib.request
from pathlib import Path

import typer

from kcontext_cli.network.proxy import (
    YOUTUBE_PROXY_OPTION_HELP,
    build_ytdlp_proxy_args,
    resolve_youtube_proxy_url,
)
from kcontext_cli.subtitle.parser import parse_json3_to_chunks


def _parse_upload_date(upload_date: str) -> str:
    """Convert YYYYMMDD to ISO 8601 format."""
    return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00Z"


def _fetch_video_data(
    video_id: str,
    youtube_proxy_url: str | None,
) -> dict:
    """Fetch video metadata and subtitle info using yt-dlp --dump-json.

    Returns the full JSON object from yt-dlp, which contains:
    - id, title, channel, upload_date (metadata)
    - subtitles (manual subtitles dict, keyed by language)
    - automatic_captions (auto-generated subtitles dict)
    """
    try:
        command = [
            "yt-dlp",
            *build_ytdlp_proxy_args(youtube_proxy_url),
            "--dump-json",
            "--skip-download",
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError as err:
        typer.echo("Error: yt-dlp is not installed.", err=True)
        raise typer.Exit(code=1) from err
    except subprocess.TimeoutExpired as err:
        typer.echo("Error: yt-dlp timed out.", err=True)
        raise typer.Exit(code=1) from err

    if result.returncode != 0:
        message = result.stderr.strip()
        if youtube_proxy_url is None:
            typer.echo(f"Error: Failed to fetch video data: {message}", err=True)
        else:
            typer.echo(
                f"Error: Failed to fetch video data via proxy {youtube_proxy_url}: {message}",
                err=True,
            )
        raise typer.Exit(code=1)

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as err:
        typer.echo(f"Error: Failed to parse yt-dlp JSON output: {err}", err=True)
        raise typer.Exit(code=1) from err


def _download_json3_subtitle(
    subtitle_url: str,
    youtube_proxy_url: str | None,
) -> dict:
    """Download json3 subtitle content from the given URL."""
    try:
        req = urllib.request.Request(subtitle_url)
        if youtube_proxy_url is not None:
            proxy_handler = urllib.request.ProxyHandler(
                {
                    "http": youtube_proxy_url,
                    "https": youtube_proxy_url,
                }
            )
            opener = urllib.request.build_opener(proxy_handler)
        else:
            opener = urllib.request.build_opener()

        with opener.open(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
        return json.loads(content)
    except Exception as exc:
        if youtube_proxy_url is None:
            typer.echo(f"Error: Failed to download subtitle: {exc}", err=True)
        else:
            typer.echo(
                f"Error: Failed to download subtitle via proxy {youtube_proxy_url}: {exc}",
                err=True,
            )
        raise typer.Exit(code=1) from exc


def _extract_json3_url(subtitles_ko: list[dict]) -> str | None:
    """Extract json3 format URL from the subtitle entries."""
    for entry in subtitles_ko:
        if entry.get("ext") == "json3":
            return entry.get("url")
    return None


def fetch_subtitle(
    video_id: str = typer.Argument(help="YouTube video ID"),
    output: Path = typer.Option(..., "-o", "--output", help="Output path for raw JSON file"),  # noqa: B008
    youtube_proxy_url: str | None = typer.Option(
        None,
        "--youtube-proxy-url",
        help=YOUTUBE_PROXY_OPTION_HELP,
    ),
) -> None:
    """Fetch video metadata and Korean subtitles, write raw JSON."""
    try:
        resolved_proxy_url = resolve_youtube_proxy_url(youtube_proxy_url)
    except ValueError as exc:
        typer.echo(f"Error: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    if resolved_proxy_url is not None:
        typer.echo(f"Using YouTube proxy: {resolved_proxy_url}", err=True)

    typer.echo(f"Fetching video data for {video_id}...", err=True)
    video_data = _fetch_video_data(video_id, resolved_proxy_url)

    # Check for manual Korean subtitles
    manual_subs = video_data.get("subtitles") or {}
    ko_entries = manual_subs.get("ko")
    if not ko_entries:
        typer.echo(f"Error: No manual Korean subtitle found for {video_id}", err=True)
        raise typer.Exit(code=1)

    # Find json3 URL
    json3_url = _extract_json3_url(ko_entries)
    if json3_url is None:
        typer.echo(f"Error: No json3 format subtitle available for {video_id}", err=True)
        raise typer.Exit(code=1)

    # Download and parse json3
    typer.echo(f"Downloading Korean subtitles for {video_id}...", err=True)
    json3_data = _download_json3_subtitle(json3_url, resolved_proxy_url)
    transcript_chunks = parse_json3_to_chunks(json3_data)

    if not transcript_chunks:
        typer.echo(f"Error: Subtitle is empty for {video_id}", err=True)
        raise typer.Exit(code=1)

    # Extract metadata
    vid_id = video_data.get("id", video_id)
    title = video_data.get("title", "")
    channel_name = video_data.get("channel", "")
    upload_date = video_data.get("upload_date", "")
    published_at = _parse_upload_date(upload_date) if upload_date else ""

    raw_data = {
        "video_id": vid_id,
        "title": title,
        "channel_name": channel_name,
        "published_at": published_at,
        "transcript": transcript_chunks,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=2)

    typer.echo(
        f"Saved {len(raw_data['transcript'])} subtitle chunks to {output}",
        err=True,
    )
