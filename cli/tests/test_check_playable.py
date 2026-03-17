"""Regression tests for the playable CSV filtering script."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from types import ModuleType


def _load_check_playable_module() -> ModuleType:
    module_path = Path(__file__).resolve().parents[2] / "scripts" / "check_playable.py"
    spec = importlib.util.spec_from_file_location("check_playable_script", module_path)
    if spec is None or spec.loader is None:
        raise AssertionError(f"Failed to load module spec for {module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_dedupe_rows_by_video_id_preserves_first_seen_order() -> None:
    module = _load_check_playable_module()

    rows = [
        {
            "channel_id": "ch001",
            "channel_name": "JTBC Drama",
            "video_id": "c_HVeR6UdyE",
            "auto_caption_lang": "ko",
            "manual_langs": "en;ko",
        },
        {
            "channel_id": "ch002",
            "channel_name": "SMTOWN",
            "video_id": "2u2nxA29bKg",
            "auto_caption_lang": "",
            "manual_langs": "ja;ko",
        },
        {
            "channel_id": "ch999",
            "channel_name": "Duplicate",
            "video_id": "c_HVeR6UdyE",
            "auto_caption_lang": "en",
            "manual_langs": "ko",
        },
    ]

    deduped_rows = module.dedupe_rows_by_video_id(rows)

    assert deduped_rows == [
        {
            "channel_id": "ch001",
            "channel_name": "JTBC Drama",
            "video_id": "c_HVeR6UdyE",
            "auto_caption_lang": "ko",
            "manual_langs": "en;ko",
        },
        {
            "channel_id": "ch002",
            "channel_name": "SMTOWN",
            "video_id": "2u2nxA29bKg",
            "auto_caption_lang": "",
            "manual_langs": "ja;ko",
        },
    ]


def test_load_preserved_metadata_keeps_extra_columns(tmp_path: Path) -> None:
    module = _load_check_playable_module()
    filtered_csv = tmp_path / "manual_ko_subtitle_videos_filtered.csv"
    filtered_csv.write_text(
        "\n".join(
            [
                "channel_id,channel_name,video_id,auto_caption_lang,manual_langs",
                "ch001,JTBC Drama,c_HVeR6UdyE,ko,en;ko",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    unplayable_csv = tmp_path / "unplayable_videos.csv"
    unplayable_csv.write_text(
        "\n".join(
            [
                "channel_id,channel_name,video_id,manual_langs,status",
                "ch002,SMTOWN,2u2nxA29bKg,ja;ko,401",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    preserved_fieldnames, metadata_by_video_id = module.load_preserved_metadata(
        base_fieldnames=["channel_id", "channel_name", "video_id"],
        existing_paths=[filtered_csv, unplayable_csv],
    )

    assert preserved_fieldnames == ["auto_caption_lang", "manual_langs"]
    assert metadata_by_video_id == {
        "c_HVeR6UdyE": {
            "auto_caption_lang": "ko",
            "manual_langs": "en;ko",
        },
        "2u2nxA29bKg": {
            "manual_langs": "ja;ko",
        },
    }


def test_merge_preserved_metadata_fills_extra_columns_on_output_rows() -> None:
    module = _load_check_playable_module()

    merged_rows = module.merge_preserved_metadata(
        rows=[
            {
                "channel_id": "ch001",
                "channel_name": "JTBC Drama",
                "video_id": "c_HVeR6UdyE",
            },
            {
                "channel_id": "ch002",
                "channel_name": "SMTOWN",
                "video_id": "2u2nxA29bKg",
            },
        ],
        preserved_fieldnames=["auto_caption_lang", "manual_langs"],
        metadata_by_video_id={
            "c_HVeR6UdyE": {
                "auto_caption_lang": "ko",
                "manual_langs": "en;ko",
            },
        },
    )

    assert merged_rows == [
        {
            "channel_id": "ch001",
            "channel_name": "JTBC Drama",
            "video_id": "c_HVeR6UdyE",
            "auto_caption_lang": "ko",
            "manual_langs": "en;ko",
        },
        {
            "channel_id": "ch002",
            "channel_name": "SMTOWN",
            "video_id": "2u2nxA29bKg",
            "auto_caption_lang": "",
            "manual_langs": "",
        },
    ]
