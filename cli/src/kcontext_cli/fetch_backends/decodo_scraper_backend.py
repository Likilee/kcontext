"""Decodo Web Scraping API fetch backend implementation."""

from __future__ import annotations

from kcontext_cli.audio_language import resolve_audio_language_code
from kcontext_cli.fetch_backends.base import (
    FetchBackendError,
    FetchResult,
    VideoMetadata,
    parse_upload_date,
    utc_now_iso,
)
from kcontext_cli.network.decodo_scraper_api import (
    DecodoScraperApiError,
    post_scrape_request,
    resolve_decodo_scraper_api_config,
)
from kcontext_cli.subtitle.manual_ko import find_manual_korean_track_key
from kcontext_cli.subtitle.parser import parse_json3_to_chunks

DECODO_METADATA_TARGET = "youtube_metadata"
DECODO_SUBTITLES_TARGET = "youtube_subtitles"


def fetch(
    video_id: str,
    youtube_proxy_url: str | None = None,
    *,
    default_audio_language_code: str,
) -> FetchResult:
    """Fetch manual Korean subtitles and metadata via Decodo scraper API."""
    del youtube_proxy_url

    try:
        config = resolve_decodo_scraper_api_config()
        subtitles_payload = post_scrape_request(
            config=config,
            target=DECODO_SUBTITLES_TARGET,
            query=video_id,
        )
        metadata_payload = post_scrape_request(
            config=config,
            target=DECODO_METADATA_TARGET,
            query=video_id,
        )
    except ValueError as err:
        raise FetchBackendError(str(err), error_class="api_auth_failed") from err
    except DecodoScraperApiError as err:
        raise FetchBackendError(
            err.message,
            action="fetch Decodo scraper API data",
            error_class=err.error_class,
        ) from err

    subtitle_json3 = _extract_manual_ko_subtitle(subtitles_payload, video_id)
    transcript = parse_json3_to_chunks(subtitle_json3)

    return FetchResult(
        metadata=_normalize_metadata(
            video_id,
            metadata_payload,
            default_audio_language_code=default_audio_language_code,
        ),
        transcript=transcript,
    )


def _extract_manual_ko_subtitle(payload: dict, video_id: str) -> dict:
    result = _first_result(payload)
    content = result.get("content")
    if not isinstance(content, dict):
        raise FetchBackendError(
            "Decodo scraper subtitles response content is missing. "
            f"{_describe_payload_shape(payload)}",
            error_class="api_unexpected_schema",
        )

    uploader_provided = content.get("uploader_provided")
    if not isinstance(uploader_provided, dict):
        raise FetchBackendError(f"No manual Korean subtitle found for {video_id}")

    manual_ko_key = find_manual_korean_track_key(uploader_provided)
    if manual_ko_key is None:
        raise FetchBackendError(f"No manual Korean subtitle found for {video_id}")

    manual_ko = uploader_provided.get(manual_ko_key)
    if not isinstance(manual_ko, dict):
        raise FetchBackendError(f"No manual Korean subtitle found for {video_id}")

    events = manual_ko.get("events")
    if not isinstance(events, list):
        raise FetchBackendError(
            f"Manual Korean subtitle payload for {video_id} is missing events. "
            f"{_describe_payload_shape(payload)}",
            error_class="api_unexpected_schema",
        )

    return manual_ko


def _normalize_metadata(
    video_id: str,
    payload: dict,
    *,
    default_audio_language_code: str,
) -> VideoMetadata:
    result = _first_result(payload)
    content = result.get("content")
    if not isinstance(content, dict):
        raise FetchBackendError(
            "Decodo scraper metadata response content is missing. "
            f"{_describe_payload_shape(payload)}",
            error_class="api_unexpected_schema",
        )

    raw_metadata = content.get("results")
    if not isinstance(raw_metadata, dict):
        raise FetchBackendError(
            "Decodo scraper metadata response is missing results. "
            f"{_describe_payload_shape(payload)}",
            error_class="api_unexpected_schema",
        )

    upload_date = str(raw_metadata.get("upload_date") or "").strip()
    thumbnails = raw_metadata.get("thumbnails")

    return VideoMetadata(
        video_id=str(raw_metadata.get("id") or video_id),
        title=str(raw_metadata.get("title") or ""),
        channel_name=str(raw_metadata.get("channel") or raw_metadata.get("uploader") or ""),
        published_at=parse_upload_date(upload_date) if upload_date else "",
        audio_language_code=resolve_audio_language_code(
            raw_metadata.get("language"),
            default_audio_language_code=default_audio_language_code,
        ),
        channel_id=_optional_str(raw_metadata.get("channel_id")),
        uploader_id=_optional_str(raw_metadata.get("uploader_id")),
        uploader_url=_optional_str(raw_metadata.get("uploader_url")),
        duration_sec=_optional_number(raw_metadata.get("duration")),
        thumbnail_url=_pick_thumbnail(raw_metadata.get("thumbnail"), thumbnails),
        description=_optional_str(raw_metadata.get("description")),
        categories=_string_list(raw_metadata.get("categories")),
        tags=_string_list(raw_metadata.get("tags")),
        source_backend="decodo-scraper",
        fetched_at=utc_now_iso(),
    )


def _first_result(payload: dict) -> dict:
    results = payload.get("results")
    if not isinstance(results, list) or not results or not isinstance(results[0], dict):
        raise FetchBackendError(
            f"Decodo scraper response is missing results. {_describe_payload_shape(payload)}",
            error_class="api_unexpected_schema",
        )
    return results[0]


def _describe_payload_shape(payload: object) -> str:
    if not isinstance(payload, dict):
        return f"payload_type={type(payload).__name__}"

    top_keys = sorted(str(key) for key in payload)
    results = payload.get("results")
    if not isinstance(results, list):
        return (
            f"payload_keys={top_keys} "
            f"results_type={type(results).__name__ if results is not None else 'None'}"
        )

    if not results:
        return f"payload_keys={top_keys} results_type=list results_len=0"

    first = results[0]
    if not isinstance(first, dict):
        return (
            f"payload_keys={top_keys} results_type=list results_len={len(results)} "
            f"first_type={type(first).__name__}"
        )

    first_keys = sorted(str(key) for key in first)
    content = first.get("content")
    if not isinstance(content, dict):
        return (
            f"payload_keys={top_keys} results_len={len(results)} "
            f"first_keys={first_keys} "
            f"content_type={type(content).__name__ if content is not None else 'None'}"
        )

    content_keys = sorted(str(key) for key in content)
    return (
        f"payload_keys={top_keys} results_len={len(results)} "
        f"first_keys={first_keys} content_keys={content_keys[:20]}"
    )


def _pick_thumbnail(primary: object, thumbnails: object) -> str | None:
    primary_text = _optional_str(primary)
    if primary_text:
        return primary_text

    if not isinstance(thumbnails, list):
        return None

    for entry in reversed(thumbnails):
        if isinstance(entry, dict):
            url = _optional_str(entry.get("url"))
            if url:
                return url
    return None


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
