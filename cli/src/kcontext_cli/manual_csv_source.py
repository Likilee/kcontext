"""Helpers for selecting and validating manual CSV ingest sources."""

from __future__ import annotations

import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
RAW_MANUAL_KO_CSV_PATH = REPO_ROOT / "docs" / "manual_ko_subtitle_videos.csv"
FILTERED_MANUAL_KO_CSV_PATH = REPO_ROOT / "docs" / "manual_ko_subtitle_videos_filtered.csv"


def ensure_filtered_csv_is_fresh(
    selected_csv_path: Path,
    raw_csv_path: Path = RAW_MANUAL_KO_CSV_PATH,
    filtered_csv_path: Path = FILTERED_MANUAL_KO_CSV_PATH,
) -> None:
    """Abort when the default filtered CSV is older than the raw source list."""
    resolved_selected = selected_csv_path.expanduser().resolve()
    resolved_filtered = filtered_csv_path.expanduser().resolve()

    if resolved_selected != resolved_filtered:
        return

    if not filtered_csv_path.exists():
        raise ValueError(
            f"Filtered CSV not found: {filtered_csv_path}. Run scripts/check_playable.py first."
        )

    if not raw_csv_path.exists():
        return

    if raw_csv_path.stat().st_mtime > filtered_csv_path.stat().st_mtime:
        raise ValueError(
            "Filtered manual CSV is stale. "
            f"Source CSV {raw_csv_path} is newer than {filtered_csv_path}. "
            "Re-run scripts/check_playable.py before ingesting."
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selected", required=True, help="CSV path selected for ingest")
    parser.add_argument(
        "--raw",
        default=str(RAW_MANUAL_KO_CSV_PATH),
        help=f"Path to raw CSV source (default: {RAW_MANUAL_KO_CSV_PATH})",
    )
    parser.add_argument(
        "--filtered",
        default=str(FILTERED_MANUAL_KO_CSV_PATH),
        help=f"Path to filtered CSV source (default: {FILTERED_MANUAL_KO_CSV_PATH})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        ensure_filtered_csv_is_fresh(
            selected_csv_path=Path(args.selected),
            raw_csv_path=Path(args.raw),
            filtered_csv_path=Path(args.filtered),
        )
    except ValueError as exc:
        raise SystemExit(f"Error: {exc}") from exc

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
