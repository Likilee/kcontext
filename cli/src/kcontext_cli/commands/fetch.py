"""Fetch subtitle and metadata for a single YouTube video."""

import typer


def fetch_subtitle(
    video_id: str = typer.Argument(help="YouTube video ID"),
    output: str = typer.Option(..., "-o", help="Output path for raw JSON file"),
) -> None:
    """Fetch subtitle and metadata for a single YouTube video."""
    typer.echo(f"[Not implemented] fetch: video_id={video_id}, output={output}", err=True)
    raise typer.Exit(code=1)
