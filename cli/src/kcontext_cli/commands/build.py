"""Build artifacts from raw JSON for Supabase DB and Storage."""

import typer


def build_artifacts(
    input_path: str = typer.Argument(help="Path to raw JSON file"),
    output_dir: str = typer.Option(..., "-d", help="Output directory for artifacts"),
) -> None:
    """Build DB and Storage artifacts from raw subtitle JSON."""
    typer.echo(f"[Not implemented] build: input={input_path}, output_dir={output_dir}", err=True)
    raise typer.Exit(code=1)
