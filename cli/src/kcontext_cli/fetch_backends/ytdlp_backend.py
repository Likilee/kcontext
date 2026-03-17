"""yt-dlp fetch backend implementation."""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from kcontext_cli.audio_language import resolve_audio_language_code
from kcontext_cli.fetch_backends.base import (
    FetchBackendError,
    FetchResult,
    VideoMetadata,
    parse_upload_date,
    utc_now_iso,
)
from kcontext_cli.network.proxy import build_ytdlp_proxy_args, classify_proxy_failure_message
from kcontext_cli.subtitle.parser import parse_json3_to_chunks

YTDLP_SUBTITLE_LANGUAGE = "ko"
YTDLP_SUBTITLE_FORMAT = "json3"
YTDLP_EXTRACTOR_ARGS = "youtube:skip=translated_subs"
YTDLP_METADATA_TEMPLATE = (
    "%(.{id,title,channel,upload_date,channel_id,uploader_id,uploader_url,"
    "duration,description,categories,tags,thumbnail,language})j"
)


def fetch(
    video_id: str,
    youtube_proxy_url: str | None,
    *,
    default_audio_language_code: str,
) -> FetchResult:
    """Fetch minimal metadata and manual Korean subtitles via yt-dlp."""
    with tempfile.TemporaryDirectory(prefix=f"kcontext-fetch-{video_id}-") as tmp_dir:
        temp_dir = Path(tmp_dir)
        output_template = temp_dir / "%(id)s.%(ext)s"
        command = [
            "yt-dlp",
            *build_ytdlp_proxy_args(youtube_proxy_url),
            "--no-simulate",
            "--skip-download",
            "--write-subs",
            "--sub-langs",
            YTDLP_SUBTITLE_LANGUAGE,
            "--sub-format",
            YTDLP_SUBTITLE_FORMAT,
            "--extractor-args",
            YTDLP_EXTRACTOR_ARGS,
            "--output",
            str(output_template),
            "--print",
            YTDLP_METADATA_TEMPLATE,
            f"https://www.youtube.com/watch?v={video_id}",
        ]

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=30,
            )
        except FileNotFoundError as err:
            raise FetchBackendError("yt-dlp is not installed.") from err
        except subprocess.TimeoutExpired as err:
            raise FetchBackendError("yt-dlp timed out.") from err

        if result.returncode != 0:
            message = result.stderr.strip()
            raise FetchBackendError(
                message,
                action="fetch video data",
                error_class=classify_proxy_failure_message(message),
            )

        metadata = _normalize_metadata(
            video_id,
            _parse_ytdlp_metadata(result.stdout),
            default_audio_language_code=default_audio_language_code,
        )
        subtitle_path = _find_json3_subtitle_file(temp_dir)
        if subtitle_path is None:
            raise FetchBackendError(f"No manual Korean subtitle found for {video_id}")

        try:
            json3_data = json.loads(subtitle_path.read_text(encoding="utf-8"))
        except OSError as err:
            raise FetchBackendError(f"Failed to read subtitle file: {err}") from err
        except json.JSONDecodeError as err:
            raise FetchBackendError(f"Failed to parse subtitle json3: {err}") from err

    return FetchResult(
        metadata=metadata,
        transcript=parse_json3_to_chunks(json3_data),
    )


def _parse_ytdlp_metadata(stdout: str) -> dict:
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if not lines:
        raise FetchBackendError("yt-dlp did not emit metadata JSON.")

    try:
        return json.loads(lines[-1])
    except json.JSONDecodeError as err:
        raise FetchBackendError(f"Failed to parse yt-dlp metadata JSON: {err}") from err


def _find_json3_subtitle_file(directory: Path) -> Path | None:
    preferred_matches = sorted(directory.glob("*.ko.json3"))
    if preferred_matches:
        return preferred_matches[0]

    fallback_matches = sorted(directory.glob("*.json3"))
    if fallback_matches:
        return fallback_matches[0]

    return None


def _normalize_metadata(
    video_id: str,
    metadata: dict,
    *,
    default_audio_language_code: str,
) -> VideoMetadata:
    upload_date = str(metadata.get("upload_date") or "").strip()
    categories = metadata.get("categories")
    tags = metadata.get("tags")

    return VideoMetadata(
        video_id=str(metadata.get("id") or video_id),
        title=str(metadata.get("title") or ""),
        channel_name=str(metadata.get("channel") or ""),
        published_at=parse_upload_date(upload_date) if upload_date else "",
        audio_language_code=resolve_audio_language_code(
            metadata.get("language"),
            default_audio_language_code=default_audio_language_code,
        ),
        channel_id=_optional_str(metadata.get("channel_id")),
        uploader_id=_optional_str(metadata.get("uploader_id")),
        uploader_url=_optional_str(metadata.get("uploader_url")),
        duration_sec=_optional_number(metadata.get("duration")),
        thumbnail_url=_optional_str(metadata.get("thumbnail")),
        description=_optional_str(metadata.get("description")),
        categories=_string_list(categories),
        tags=_string_list(tags),
        source_backend="ytdlp",
        fetched_at=utc_now_iso(),
    )


def _optional_number(value: object) -> int | float | None:
    if isinstance(value, (int, float)):
        return value
    return None


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in (str(entry).strip() for entry in value) if item]
