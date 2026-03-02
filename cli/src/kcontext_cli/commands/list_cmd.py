"""Extract video IDs from a YouTube channel or playlist URL."""

import typer


def list_videos(
    url: str = typer.Argument(help="YouTube channel or playlist URL"),
    limit: int = typer.Option(50, help="Maximum number of video IDs to extract"),
) -> None:
    """Extract video IDs from a YouTube channel or playlist URL."""
    typer.echo(f"[Not implemented] list: url={url}, limit={limit}", err=True)
    raise typer.Exit(code=1)
