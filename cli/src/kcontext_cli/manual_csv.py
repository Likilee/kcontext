"""Helpers for validating and reading manual CSV source files."""

from __future__ import annotations

import csv
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

REQUIRED_MANUAL_CSV_COLUMNS = {"channel_id", "channel_name", "video_id"}
VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")


def load_unique_video_ids(csv_path: Path) -> list[str]:
    """Return unique video IDs from a manual CSV while allowing extra metadata columns."""
    with csv_path.open(encoding="utf-8") as file_obj:
        reader = csv.DictReader(file_obj)
        fieldnames = set(reader.fieldnames or [])
        missing_columns = sorted(REQUIRED_MANUAL_CSV_COLUMNS - fieldnames)
        if missing_columns:
            raise ValueError(
                "expected CSV columns to include "
                f"{sorted(REQUIRED_MANUAL_CSV_COLUMNS)}, got {reader.fieldnames!r}"
            )

        seen_video_ids: set[str] = set()
        ordered_ids: list[str] = []
        for line_no, row in enumerate(reader, start=2):
            video_id = (row.get("video_id") or "").strip()
            if not video_id:
                raise ValueError(f"missing video_id on line {line_no}")
            if not VIDEO_ID_PATTERN.fullmatch(video_id):
                raise ValueError(f"invalid video_id {video_id!r} on line {line_no}")
            if video_id in seen_video_ids:
                continue
            seen_video_ids.add(video_id)
            ordered_ids.append(video_id)

    return ordered_ids
