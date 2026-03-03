import csv
import os
from pathlib import Path

import psycopg2
import typer
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "54322")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "postgres")
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_JSON_OPTION = typer.Option(..., "-s", "--storage", help="Path to _storage.json file")
VIDEO_CSV_OPTION = typer.Option(..., "-vc", "--video-csv", help="Path to _video.csv file")
SUBTITLE_CSV_OPTION = typer.Option(..., "-sc", "--subtitle-csv", help="Path to _subtitle.csv file")


def push_data(
    storage_json: Path = STORAGE_JSON_OPTION,
    video_csv: Path = VIDEO_CSV_OPTION,
    subtitle_csv: Path = SUBTITLE_CSV_OPTION,
) -> None:
    """Upload storage JSON and upsert video/subtitle data into Supabase."""
    for path, name in (
        (storage_json, "storage JSON"),
        (video_csv, "video CSV"),
        (subtitle_csv, "subtitle CSV"),
    ):
        if not path.exists():
            typer.echo(f"Error: {name} file not found: {path}", err=True)
            raise typer.Exit(code=1)

    video_id = storage_json.name.replace("_storage.json", "")

    typer.echo(f"Uploading {storage_json.name} to Storage...", err=True)
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        with open(storage_json, "rb") as file_obj:
            supabase.storage.from_("subtitles").upload(
                path=f"{video_id}.json",
                file=file_obj,
                file_options={"content-type": "application/json", "upsert": "true"},
            )
    except Exception as exc:
        typer.echo(f"Error: Storage upload failed: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    typer.echo("Connecting to database...", err=True)
    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME,
        )

        typer.echo("Upserting video metadata...", err=True)
        with open(video_csv, encoding="utf-8") as file_obj:
            reader = csv.reader(file_obj, delimiter="\t")
            for row in reader:
                if len(row) < 4:
                    continue
                video_row_id, title, channel_name, published_at = row[0], row[1], row[2], row[3]
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO video (id, title, channel_name, published_at)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            title = EXCLUDED.title,
                            channel_name = EXCLUDED.channel_name,
                            published_at = EXCLUDED.published_at
                        """,
                        (video_row_id, title, channel_name, published_at),
                    )

        typer.echo("Replacing subtitles...", err=True)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM subtitle WHERE video_id = %s", (video_id,))
            with open(subtitle_csv, encoding="utf-8") as file_obj:
                cur.copy_expert(
                    "COPY subtitle (video_id, start_time, text) "
                    "FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t')",
                    file_obj,
                )

        conn.commit()
        typer.echo(f"Successfully pushed data for {video_id}", err=True)
    except psycopg2.Error as exc:
        typer.echo(f"Error: Database operation failed: {exc}", err=True)
        if conn is not None:
            conn.rollback()
        raise typer.Exit(code=1) from exc
    except Exception as exc:
        typer.echo(f"Error: Unexpected error: {exc}", err=True)
        if conn is not None:
            conn.rollback()
        raise typer.Exit(code=1) from exc
    finally:
        if conn is not None:
            conn.close()
