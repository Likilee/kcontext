"""Extract video IDs from a YouTube channel or playlist URL."""

import json
import subprocess
from pathlib import Path

import typer

from kcontext_cli.network.proxy import (
    YOUTUBE_PROXY_OPTION_HELP,
    build_ytdlp_proxy_args,
    classify_proxy_failure_message,
    describe_proxy_target,
    resolve_youtube_proxy_url,
)

PROBE_CACHE_FILE_OPTION = typer.Option(
    Path(".kcontext_manual_ko_probe_cache.json"),
    "--probe-cache-file",
    help="Path to manual Korean subtitle probe cache file.",
)


def _run_ytdlp_list(url: str, playlist_end: int, youtube_proxy_url: str | None) -> list[str]:
    try:
        command = [
            "yt-dlp",
            *build_ytdlp_proxy_args(youtube_proxy_url),
            "--flat-playlist",
            "--print",
            "id",
            "--playlist-end",
            str(playlist_end),
            url,
        ]
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError as err:
        typer.echo("Error: yt-dlp is not installed. Run: pip install yt-dlp", err=True)
        raise typer.Exit(code=1) from err
    except subprocess.TimeoutExpired as err:
        typer.echo("Error: yt-dlp timed out after 120 seconds", err=True)
        raise typer.Exit(code=1) from err

    if result.returncode != 0:
        message = result.stderr.strip()
        _emit_list_failure("yt-dlp failed", message, youtube_proxy_url)
        raise typer.Exit(code=1)

    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _has_manual_ko_subtitle(video_id: str, youtube_proxy_url: str | None) -> bool:
    """Check if a video has manually created Korean subtitles using yt-dlp."""
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
        typer.echo(f"Error: yt-dlp timed out probing subtitles for {video_id}", err=True)
        raise typer.Exit(code=1) from err

    if result.returncode != 0:
        message = result.stderr.strip()
        if youtube_proxy_url is None:
            typer.echo(f"Warning: Failed to probe subtitles for {video_id}: {message}", err=True)
            return False
        _emit_list_failure(f"probe subtitles for {video_id}", message, youtube_proxy_url)
        raise typer.Exit(code=1)

    try:
        video_data = json.loads(result.stdout)
    except json.JSONDecodeError:
        typer.echo(f"Warning: Failed to parse yt-dlp output for {video_id}", err=True)
        return False

    manual_subs = video_data.get("subtitles") or {}
    return "ko" in manual_subs


def _load_probe_cache(cache_file: Path) -> dict[str, bool]:
    if not cache_file.exists():
        return {}
    try:
        with open(cache_file, encoding="utf-8") as file_obj:
            raw = json.load(file_obj)
        if not isinstance(raw, dict):
            return {}
        cache: dict[str, bool] = {}
        for key, value in raw.items():
            if isinstance(key, str) and isinstance(value, bool):
                cache[key] = value
        return cache
    except Exception:
        return {}


def _save_probe_cache(cache_file: Path, cache: dict[str, bool]) -> None:
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_file, "w", encoding="utf-8") as file_obj:
        json.dump(cache, file_obj, ensure_ascii=False, indent=2, sort_keys=True)


def _emit_list_failure(action: str, message: str, youtube_proxy_url: str | None) -> None:
    error_class = classify_proxy_failure_message(message)
    prefix = f"Error [{error_class}]" if error_class is not None else "Error"

    if youtube_proxy_url is None:
        typer.echo(f"{prefix}: {action}: {message}", err=True)
        return

    proxy_target = describe_proxy_target(youtube_proxy_url) or "<invalid-proxy>"
    typer.echo(f"{prefix}: {action} via proxy {proxy_target}: {message}", err=True)


def list_videos(
    url: str = typer.Argument(help="YouTube channel or playlist URL"),
    limit: int = typer.Option(50, "--limit", min=1, help="Maximum number of video IDs to extract"),
    manual_ko_only: bool = typer.Option(
        False,
        "--manual-ko-only",
        help="Only output videos that have manually created Korean subtitles.",
    ),
    probe_max_candidates: int = typer.Option(
        300,
        "--probe-max-candidates",
        min=1,
        help="Maximum candidate videos to scan when --manual-ko-only is enabled.",
    ),
    probe_cache_file: Path = PROBE_CACHE_FILE_OPTION,
    no_probe_cache: bool = typer.Option(
        False,
        "--no-probe-cache",
        help="Disable loading/saving manual Korean probe cache.",
    ),
    youtube_proxy_url: str | None = typer.Option(
        None,
        "--youtube-proxy-url",
        help=YOUTUBE_PROXY_OPTION_HELP,
    ),
) -> None:
    """Extract video IDs from a YouTube channel or playlist URL."""
    try:
        resolved_proxy_url = resolve_youtube_proxy_url(youtube_proxy_url)
    except ValueError as exc:
        typer.echo(f"Error: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    if resolved_proxy_url is not None:
        proxy_target = describe_proxy_target(resolved_proxy_url) or "<invalid-proxy>"
        typer.echo(f"Using YouTube proxy: {proxy_target}", err=True)

    if manual_ko_only:
        candidate_limit = max(limit, probe_max_candidates)
        typer.echo(
            f"Extracting candidate video IDs from {url} "
            f"(target limit: {limit}, probe max: {candidate_limit})",
            err=True,
        )
    else:
        candidate_limit = limit
        typer.echo(f"Extracting video IDs from {url} (limit: {limit})", err=True)

    video_ids = _run_ytdlp_list(url, candidate_limit, resolved_proxy_url)

    if manual_ko_only and video_ids:
        typer.echo("Filtering candidates with manual Korean subtitles...", err=True)
        probe_cache = _load_probe_cache(probe_cache_file) if not no_probe_cache else {}
        cache_hits = 0
        cache_misses = 0
        cache_updated = False

        filtered_ids: list[str] = []
        for video_id in video_ids:
            if len(filtered_ids) >= limit:
                break
            if video_id in probe_cache:
                cache_hits += 1
            else:
                cache_misses += 1
                probe_cache[video_id] = _has_manual_ko_subtitle(video_id, resolved_proxy_url)
                cache_updated = True

            if probe_cache.get(video_id, False):
                filtered_ids.append(video_id)

        video_ids = filtered_ids

        if not no_probe_cache and cache_updated:
            _save_probe_cache(probe_cache_file, probe_cache)
        if not no_probe_cache:
            typer.echo(
                f"Probe cache: hits={cache_hits}, misses={cache_misses}, file={probe_cache_file}",
                err=True,
            )
        typer.echo(
            f"Found {len(video_ids)} videos with manual Korean subtitles.",
            err=True,
        )

    if not video_ids:
        if manual_ko_only:
            typer.echo(
                f"Warning: No videos with manual Korean subtitles found for {url}",
                err=True,
            )
        else:
            typer.echo(f"Warning: No video IDs found for {url}", err=True)
        raise typer.Exit(code=0)

    for video_id in video_ids:
        typer.echo(video_id)
