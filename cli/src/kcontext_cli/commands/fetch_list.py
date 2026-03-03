"""Batch-fetch raw JSON files from a list of YouTube video IDs."""

from pathlib import Path

import typer

from kcontext_cli.commands import fetch
from kcontext_cli.network.proxy import YOUTUBE_PROXY_OPTION_HELP, resolve_youtube_proxy_url


def _load_video_ids(video_ids_file: Path) -> list[str]:
    if not video_ids_file.exists():
        typer.echo(f"Error: Video ID file not found: {video_ids_file}", err=True)
        raise typer.Exit(code=1)

    with open(video_ids_file, encoding="utf-8") as file_obj:
        video_ids = [
            line.strip() for line in file_obj if line.strip() and not line.strip().startswith("#")
        ]

    if not video_ids:
        typer.echo(f"Error: No video IDs found in {video_ids_file}", err=True)
        raise typer.Exit(code=1)

    return video_ids


def fetch_list(
    video_ids_file: Path = typer.Argument(help="Text file with one YouTube video ID per line"),  # noqa: B008
    output_dir: Path = typer.Option(..., "-d", "--dir", help="Output directory for raw JSON files"),  # noqa: B008
    strict: bool = typer.Option(
        False,
        "--strict",
        help="Exit with code 1 on the first failed fetch.",
    ),
    youtube_proxy_url: str | None = typer.Option(
        None,
        "--youtube-proxy-url",
        help=YOUTUBE_PROXY_OPTION_HELP,
    ),
) -> None:
    """Fetch raw JSON files for all video IDs listed in a text file."""
    try:
        resolved_proxy_url = resolve_youtube_proxy_url(youtube_proxy_url)
    except ValueError as exc:
        typer.echo(f"Error: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    if resolved_proxy_url is not None:
        typer.echo(f"Using YouTube proxy: {resolved_proxy_url}", err=True)

    video_ids = _load_video_ids(video_ids_file)
    output_dir.mkdir(parents=True, exist_ok=True)

    success_count = 0
    failed_ids: list[str] = []
    total = len(video_ids)

    for index, video_id in enumerate(video_ids, start=1):
        typer.echo(f"[{index}/{total}] Processing {video_id}", err=True)
        output_path = output_dir / f"{video_id}_raw.json"
        try:
            fetch.fetch_subtitle(
                video_id=video_id,
                output=output_path,
                youtube_proxy_url=resolved_proxy_url,
            )
            success_count += 1
        except typer.Exit as exc:
            failed_ids.append(video_id)
            if strict:
                typer.echo("Error: Stopped due to --strict mode.", err=True)
                raise typer.Exit(code=1) from exc

    typer.echo(
        f"Completed fetch-list: success={success_count}, failed={len(failed_ids)}",
        err=True,
    )
    if failed_ids:
        typer.echo(f"Failed video IDs: {', '.join(failed_ids)}", err=True)
        if success_count == 0:
            raise typer.Exit(code=1)
