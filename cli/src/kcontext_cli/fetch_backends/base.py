"""Shared models and helpers for fetch backends."""

from __future__ import annotations

import pathlib  # noqa: TC003
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

FetchBackendName = Literal["ytdlp", "decodo-scraper"]
DEFAULT_FETCH_BACKEND: FetchBackendName = "ytdlp"
DECODO_SCRAPER_FETCH_BACKEND: FetchBackendName = "decodo-scraper"
YTDLP_FETCH_BACKEND: FetchBackendName = "ytdlp"
FETCH_BACKEND_OPTION_HELP = (
    "Fetch backend to use. "
    "'ytdlp' downloads subtitles from YouTube directly. "
    "'decodo-scraper' fetches manual subtitles and metadata via Decodo Web Scraping API."
)


class FetchBackendError(Exception):
    """User-facing fetch backend failure."""

    def __init__(
        self,
        message: str,
        *,
        error_class: str | None = None,
        action: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.error_class = error_class
        self.action = action


@dataclass(frozen=True)
class VideoMetadata:
    """Normalized metadata shared across fetch backends."""

    video_id: str
    title: str
    channel_name: str
    published_at: str
    audio_language_code: str
    channel_id: str | None = None
    uploader_id: str | None = None
    uploader_url: str | None = None
    duration_sec: int | float | None = None
    thumbnail_url: str | None = None
    description: str | None = None
    categories: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    source_backend: FetchBackendName = DEFAULT_FETCH_BACKEND
    fetched_at: str = ""

    def to_metadata_raw_dict(self) -> dict[str, object]:
        return {
            "video_id": self.video_id,
            "title": self.title,
            "channel_name": self.channel_name,
            "published_at": self.published_at,
            "audio_language_code": self.audio_language_code,
            "channel_id": self.channel_id,
            "uploader_id": self.uploader_id,
            "uploader_url": self.uploader_url,
            "duration_sec": self.duration_sec,
            "thumbnail_url": self.thumbnail_url,
            "description": self.description,
            "categories": self.categories,
            "tags": self.tags,
            "source_backend": self.source_backend,
            "fetched_at": self.fetched_at,
        }


@dataclass(frozen=True)
class FetchResult:
    """Normalized fetch output for subtitle raw and metadata sidecar."""

    metadata: VideoMetadata
    transcript: list[dict[str, float | str]]


def normalize_fetch_backend_name(raw_backend: str | None) -> FetchBackendName:
    backend = (raw_backend or DEFAULT_FETCH_BACKEND).strip().lower()
    if backend == YTDLP_FETCH_BACKEND:
        return YTDLP_FETCH_BACKEND
    if backend == DECODO_SCRAPER_FETCH_BACKEND:
        return DECODO_SCRAPER_FETCH_BACKEND

    raise ValueError(
        f"Invalid fetch backend: {raw_backend!r}. "
        f"Expected {YTDLP_FETCH_BACKEND!r} or {DECODO_SCRAPER_FETCH_BACKEND!r}."
    )


def parse_upload_date(upload_date: str) -> str:
    """Convert YYYYMMDD to ISO 8601 format."""
    return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00Z"


def make_metadata_output_path(output: pathlib.Path, video_id: str) -> pathlib.Path:
    """Return the sidecar metadata raw path for a subtitle raw output path."""
    return output.with_name(f"{video_id}_metadata_raw.json")


def utc_now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string with Z suffix."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
