"""Tests for manual CSV validation helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from kcontext_cli.manual_csv import load_unique_video_ids

if TYPE_CHECKING:
    from pathlib import Path


def test_load_unique_video_ids_allows_extra_metadata_columns(tmp_path: Path) -> None:
    csv_path = tmp_path / "manual_ko_subtitle_videos_filtered.csv"
    csv_path.write_text(
        "\n".join(
            [
                "channel_id,channel_name,video_id,auto_caption_lang,manual_langs",
                "ch001,JTBC Drama,c_HVeR6UdyE,ko,en;ko",
                "ch002,SMTOWN,2u2nxA29bKg,,ja;ko",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    ordered_ids = load_unique_video_ids(csv_path)

    assert ordered_ids == ["c_HVeR6UdyE", "2u2nxA29bKg"]


def test_load_unique_video_ids_rejects_missing_required_columns(tmp_path: Path) -> None:
    csv_path = tmp_path / "manual_ko_subtitle_videos_filtered.csv"
    csv_path.write_text(
        "\n".join(
            [
                "channel_id,channel_name,auto_caption_lang",
                "ch001,JTBC Drama,ko",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="expected CSV columns"):
        load_unique_video_ids(csv_path)


def test_load_unique_video_ids_deduplicates_repeated_rows(tmp_path: Path) -> None:
    csv_path = tmp_path / "manual_ko_subtitle_videos_filtered.csv"
    csv_path.write_text(
        "\n".join(
            [
                "channel_id,channel_name,video_id,auto_caption_lang,manual_langs",
                "ch001,JTBC Drama,c_HVeR6UdyE,ko,en;ko",
                "ch001,JTBC Drama,c_HVeR6UdyE,ko,en;ko",
                "ch002,SMTOWN,2u2nxA29bKg,,ja;ko",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    ordered_ids = load_unique_video_ids(csv_path)

    assert ordered_ids == ["c_HVeR6UdyE", "2u2nxA29bKg"]
