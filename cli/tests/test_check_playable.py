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
