"""Push built artifacts to Supabase DB and Storage."""

import typer


def push_data(
    storage_json: str = typer.Option(..., "-s", help="Path to storage JSON file"),
    video_csv: str = typer.Option(..., "-vc", help="Path to video CSV file"),
    subtitle_csv: str = typer.Option(..., "-sc", help="Path to subtitle CSV file"),
) -> None:
    """Push built artifacts to Supabase DB and Storage."""
    typer.echo(f"[Not implemented] push: storage={storage_json}", err=True)
    typer.echo(f"  video={video_csv}, subtitle={subtitle_csv}", err=True)
    raise typer.Exit(code=1)
