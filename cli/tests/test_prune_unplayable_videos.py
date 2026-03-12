"""Tests for unplayable-video pruning helpers."""

from __future__ import annotations

import importlib
import inspect
import os
from typing import TYPE_CHECKING, Any

import pytest

if TYPE_CHECKING:
    from pathlib import Path


def _import_module(module_name: str) -> Any:
    return importlib.import_module(module_name)


def _resolve_symbol(module: Any, names: list[str]) -> Any:
    for name in names:
        if hasattr(module, name):
            return getattr(module, name)
    available = ", ".join(sorted(name for name in dir(module) if not name.startswith("_")))
    raise AssertionError(f"Expected one of {names!r} in {module.__name__}. Available: {available}")


def _resolve_optional_symbol(module_names: list[str], symbol_names: list[str]) -> Any | None:
    for module_name in module_names:
        try:
            module = _import_module(module_name)
        except ModuleNotFoundError:
            continue
        for symbol_name in symbol_names:
            if hasattr(module, symbol_name):
                return getattr(module, symbol_name)
    return None


def _coerce_row(row: Any) -> dict[str, str]:
    if isinstance(row, dict):
        return {str(key): str(value) for key, value in row.items()}

    result: dict[str, str] = {}
    for field in ("channel_id", "channel_name", "video_id", "status"):
        if hasattr(row, field):
            result[field] = str(getattr(row, field))
    return result


def _call_freshness_guard(
    guard: Any,
    *,
    selected_csv: Path,
    raw_csv: Path,
    filtered_csv: Path,
) -> None:
    signature = inspect.signature(guard)
    params = list(signature.parameters)

    if params == ["selected_csv", "raw_csv", "filtered_csv"]:
        guard(selected_csv=selected_csv, raw_csv=raw_csv, filtered_csv=filtered_csv)
        return
    if params == ["selected_path", "raw_path", "filtered_path"]:
        guard(selected_path=selected_csv, raw_path=raw_csv, filtered_path=filtered_csv)
        return
    if len(params) == 3:
        guard(selected_csv, raw_csv, filtered_csv)
        return

    raise AssertionError(
        f"Unsupported freshness guard signature for {guard.__module__}.{guard.__name__}: {params}"
    )


def test_load_unplayable_rows_reads_expected_columns(tmp_path: Path) -> None:
    prune_module = _import_module("kcontext_cli.prune_unplayable_videos")
    load_rows = _resolve_symbol(
        prune_module,
        [
            "load_unplayable_rows",
            "load_unplayable_entries",
            "load_prune_rows",
        ],
    )

    csv_path = tmp_path / "unplayable_videos.csv"
    csv_path.write_text(
        "\n".join(
            [
                "channel_id,channel_name,video_id,status",
                "ch001,Channel One,video000001A,401",
                "ch002,Channel Two,video000002B,404",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    rows = load_rows(csv_path)

    assert len(rows) == 2
    first = _coerce_row(rows[0])
    second = _coerce_row(rows[1])
    assert first["channel_id"] == "ch001"
    assert first["channel_name"] == "Channel One"
    assert first["video_id"] == "video000001A"
    assert first["status"] == "401"
    assert second["video_id"] == "video000002B"
    assert second["status"] == "404"


def test_load_unplayable_rows_rejects_missing_required_columns(tmp_path: Path) -> None:
    prune_module = _import_module("kcontext_cli.prune_unplayable_videos")
    load_rows = _resolve_symbol(
        prune_module,
        [
            "load_unplayable_rows",
            "load_unplayable_entries",
            "load_prune_rows",
        ],
    )

    csv_path = tmp_path / "bad_unplayable_videos.csv"
    csv_path.write_text(
        "\n".join(
            [
                "channel_id,video_id",
                "ch001,video000001A",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with pytest.raises((ValueError, SystemExit), match="channel_name|status|required"):
        load_rows(csv_path)


def test_filtered_csv_freshness_guard_allows_current_filtered_file(tmp_path: Path) -> None:
    guard = _resolve_optional_symbol(
        [
            "kcontext_cli.manual_csv_source",
            "kcontext_cli.manual_csv_guard",
            "kcontext_cli.prune_unplayable_videos",
        ],
        [
            "ensure_filtered_csv_is_fresh",
            "validate_filtered_csv_is_fresh",
            "assert_filtered_csv_is_fresh",
        ],
    )
    if guard is None:
        pytest.skip("No freshness guard helper exported")

    raw_csv = tmp_path / "manual_ko_subtitle_videos.csv"
    filtered_csv = tmp_path / "manual_ko_subtitle_videos_filtered.csv"
    raw_csv.write_text("channel_id,channel_name,video_id\n", encoding="utf-8")
    filtered_csv.write_text("channel_id,channel_name,video_id\n", encoding="utf-8")

    now = 1_700_000_100
    os.utime(raw_csv, (now, now))
    os.utime(filtered_csv, (now + 60, now + 60))

    _call_freshness_guard(
        guard,
        selected_csv=filtered_csv,
        raw_csv=raw_csv,
        filtered_csv=filtered_csv,
    )


def test_filtered_csv_freshness_guard_rejects_stale_filtered_file(tmp_path: Path) -> None:
    guard = _resolve_optional_symbol(
        [
            "kcontext_cli.manual_csv_source",
            "kcontext_cli.manual_csv_guard",
            "kcontext_cli.prune_unplayable_videos",
        ],
        [
            "ensure_filtered_csv_is_fresh",
            "validate_filtered_csv_is_fresh",
            "assert_filtered_csv_is_fresh",
        ],
    )
    if guard is None:
        pytest.skip("No freshness guard helper exported")

    raw_csv = tmp_path / "manual_ko_subtitle_videos.csv"
    filtered_csv = tmp_path / "manual_ko_subtitle_videos_filtered.csv"
    raw_csv.write_text("channel_id,channel_name,video_id\n", encoding="utf-8")
    filtered_csv.write_text("channel_id,channel_name,video_id\n", encoding="utf-8")

    now = 1_700_000_100
    os.utime(filtered_csv, (now, now))
    os.utime(raw_csv, (now + 60, now + 60))

    with pytest.raises((ValueError, SystemExit), match="check_playable|filtered|stale|newer"):
        _call_freshness_guard(
            guard,
            selected_csv=filtered_csv,
            raw_csv=raw_csv,
            filtered_csv=filtered_csv,
        )


def test_status_count_helper_summarizes_rows_when_present() -> None:
    count_helper = _resolve_optional_symbol(
        ["kcontext_cli.prune_unplayable_videos"],
        [
            "count_rows_by_status",
            "build_status_counts",
        ],
    )
    if count_helper is None:
        pytest.skip("No status count helper exported")

    rows = [
        {
            "channel_id": "ch001",
            "channel_name": "One",
            "video_id": "video000001A",
            "status": "401",
        },
        {
            "channel_id": "ch002",
            "channel_name": "Two",
            "video_id": "video000002B",
            "status": "404",
        },
        {
            "channel_id": "ch003",
            "channel_name": "Three",
            "video_id": "video000003C",
            "status": "401",
        },
    ]

    counts = count_helper(rows)

    assert counts["401"] == 2
    assert counts["404"] == 1


def test_storage_delete_batch_helper_batches_exact_object_names_when_present() -> None:
    batch_helper = _resolve_optional_symbol(
        ["kcontext_cli.prune_unplayable_videos"],
        [
            "build_storage_delete_batches",
            "chunk_storage_delete_names",
        ],
    )
    if batch_helper is None:
        pytest.skip("No storage delete batching helper exported")

    video_ids = [
        "video000001A",
        "video000002B",
        "video000003C",
    ]

    params = list(inspect.signature(batch_helper).parameters)
    if params == ["video_ids", "batch_size"]:
        batches = batch_helper(video_ids, batch_size=2)
    elif params == ["names", "batch_size"]:
        batches = batch_helper([f"{video_id}.json" for video_id in video_ids], batch_size=2)
    elif len(params) == 2:
        batches = batch_helper(video_ids, 2)
    else:
        raise AssertionError(
            f"Unsupported batch helper signature for {batch_helper.__name__}: {params}"
        )

    normalized = [list(batch) for batch in batches]
    assert normalized == [
        ["video000001A.json", "video000002B.json"],
        ["video000003C.json"],
    ]
