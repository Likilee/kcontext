"""Fetch video metadata and Korean subtitles from YouTube."""

import json
import subprocess
from pathlib import Path

import typer
from youtube_transcript_api import (
    IpBlocked,
    NoTranscriptFound,
    RequestBlocked,
    YouTubeTranscriptApi,
)

from kcontext_cli.network.proxy import (
    YOUTUBE_PROXY_OPTION_HELP,
    build_ytdlp_proxy_args,
    build_ytt_proxy_config,
    resolve_youtube_proxy_url,
)


def _parse_upload_date(upload_date: str) -> str:
    """Convert YYYYMMDD to ISO 8601 format."""
    return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00Z"


def _fetch_manual_korean_chunks(
    video_id: str,
    youtube_proxy_url: str | None,
) -> list[dict[str, float | str]]:
    try:
        ytt = YouTubeTranscriptApi(proxy_config=build_ytt_proxy_config(youtube_proxy_url))
        transcript_list = ytt.list(video_id)
        transcript = transcript_list.find_manually_created_transcript(["ko"])
        chunks = transcript.fetch()
    except NoTranscriptFound as err:
        typer.echo(f"Error: No manual Korean subtitle found for {video_id}", err=True)
        raise typer.Exit(code=1) from err
    except (IpBlocked, RequestBlocked) as err:
        if youtube_proxy_url is None:
            typer.echo(
                "Error: YouTube blocked subtitle requests. "
                "Try --youtube-proxy-url or KCONTEXT_YOUTUBE_PROXY_URL.",
                err=True,
            )
        else:
            typer.echo(
                f"Error: YouTube blocked subtitle requests via proxy {youtube_proxy_url}: {err}",
                err=True,
            )
        raise typer.Exit(code=1) from err
    except Exception as exc:
        if youtube_proxy_url is None:
            typer.echo(f"Error: Failed to fetch subtitles: {exc}", err=True)
        else:
            typer.echo(
                f"Error: Failed to fetch subtitles via proxy {youtube_proxy_url}: {exc}",
                err=True,
            )
        raise typer.Exit(code=1) from exc

    transcript_chunks: list[dict[str, float | str]] = []
    for chunk in chunks:
        if isinstance(chunk, dict):
            transcript_chunks.append(
                {
                    "start": chunk["start"],
                    "duration": chunk["duration"],
                    "text": chunk["text"],
                }
            )
        else:
            transcript_chunks.append(
                {
                    "start": chunk.start,
                    "duration": chunk.duration,
                    "text": chunk.text,
                }
            )
    return transcript_chunks


def _fetch_video_metadata(
    video_id: str,
    youtube_proxy_url: str | None,
) -> tuple[str, str, str, str]:
    try:
        command = [
            "yt-dlp",
            *build_ytdlp_proxy_args(youtube_proxy_url),
            "--print",
            "%(id)s",
            "--print",
            "%(title)s",
            "--print",
            "%(channel)s",
            "--print",
            "%(upload_date)s",
            "--skip-download",
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        meta_result = subprocess.run(
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

    if meta_result.returncode != 0:
        message = meta_result.stderr.strip()
        if youtube_proxy_url is None:
            typer.echo(f"Error: Failed to fetch video metadata: {message}", err=True)
        else:
            typer.echo(
                f"Error: Failed to fetch video metadata via proxy {youtube_proxy_url}: {message}",
                err=True,
            )
        raise typer.Exit(code=1)

    lines = meta_result.stdout.strip().splitlines()
    if len(lines) < 4:
        typer.echo(f"Error: Unexpected yt-dlp output: {meta_result.stdout!r}", err=True)
        raise typer.Exit(code=1)

    vid_id, title, channel_name, upload_date = lines[0], lines[1], lines[2], lines[3]
    return vid_id, title, channel_name, _parse_upload_date(upload_date)


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

    typer.echo(f"Fetching Korean subtitles for {video_id}...", err=True)
    transcript_chunks = _fetch_manual_korean_chunks(video_id, resolved_proxy_url)

    typer.echo(f"Fetching metadata for {video_id}...", err=True)
    vid_id, title, channel_name, published_at = _fetch_video_metadata(video_id, resolved_proxy_url)

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
