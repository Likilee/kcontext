"""Helpers for resolving uploader-provided Korean subtitle track variants."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping
    from pathlib import Path

MANUAL_KO_EXACT_CODE = "ko"
MANUAL_KO_VARIANT_PREFIX = "ko-"


def is_manual_korean_track_code(language_code: object) -> bool:
    """Return True when the language code denotes an uploader-provided Korean track."""
    if not isinstance(language_code, str):
        return False
    normalized = language_code.strip().lower()
    return normalized == MANUAL_KO_EXACT_CODE or normalized.startswith(MANUAL_KO_VARIANT_PREFIX)


def find_manual_korean_track_key(tracks: Mapping[str, object]) -> str | None:
    """Return the best matching uploader-provided Korean track key from a mapping."""
    candidates = [key for key in tracks if is_manual_korean_track_code(key)]
    if not candidates:
        return None

    return min(candidates, key=_manual_korean_track_sort_key)


def find_manual_korean_subtitle_file(paths: Iterable[Path]) -> Path | None:
    """Return the deterministic best Korean subtitle json3 file from a path collection."""
    ranked_paths = []
    for path in paths:
        language_code = extract_subtitle_language_code(path)
        if not is_manual_korean_track_code(language_code):
            continue
        ranked_paths.append((language_code, path))

    if not ranked_paths:
        return None

    _language_code, selected_path = min(
        ranked_paths,
        key=lambda item: (_manual_korean_track_sort_key(item[0]), item[1].name),
    )
    return selected_path


def extract_subtitle_language_code(path: Path) -> str | None:
    """Extract the subtitle language segment from a yt-dlp subtitle filename."""
    if path.suffix != ".json3":
        return None

    stem = path.stem
    if "." not in stem:
        return None

    _video_id, language_code = stem.split(".", 1)
    normalized = language_code.strip().lower()
    return normalized or None


def _manual_korean_track_sort_key(language_code: str) -> tuple[int, str]:
    return (0 if language_code == MANUAL_KO_EXACT_CODE else 1, language_code)
