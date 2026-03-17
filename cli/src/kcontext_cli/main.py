"""tubelang CLI - YouTube subtitle data pipeline."""

import typer

from kcontext_cli.commands import (
    build,
    build_metadata,
    fetch,
    fetch_list,
    list_cmd,
    push,
    push_metadata,
    snapshot_fixtures,
)

app = typer.Typer(
    name="tubelang",
    help="tubelang data pipeline: fetch, build, push YouTube subtitle data to Supabase.",
    no_args_is_help=True,
)

app.command(name="list")(list_cmd.list_videos)
app.command(name="fetch")(fetch.fetch_subtitle)
app.command(name="fetch-list")(fetch_list.fetch_list)
app.command(name="build")(build.build_artifacts)
app.command(name="build-metadata")(build_metadata.build_metadata_artifact)
app.command(name="push")(push.push_data)
app.command(name="push-metadata")(push_metadata.push_metadata)
app.command(name="snapshot-fixtures")(snapshot_fixtures.snapshot_fixtures)

if __name__ == "__main__":
    app()
