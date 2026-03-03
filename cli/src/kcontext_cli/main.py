"""kcontext CLI - YouTube subtitle data pipeline."""

import typer

from kcontext_cli.commands import build, fetch, fetch_list, list_cmd, push

app = typer.Typer(
    name="kcontext",
    help="kcontext data pipeline: fetch, build, push YouTube subtitle data to Supabase.",
    no_args_is_help=True,
)

app.command(name="list")(list_cmd.list_videos)
app.command(name="fetch")(fetch.fetch_subtitle)
app.command(name="fetch-list")(fetch_list.fetch_list)
app.command(name="build")(build.build_artifacts)
app.command(name="push")(push.push_data)

if __name__ == "__main__":
    app()
