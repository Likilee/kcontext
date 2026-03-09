"""Parse YouTube json3 subtitle format into transcript chunks."""

from __future__ import annotations


def parse_json3_to_chunks(json3_data: dict) -> list[dict[str, float | str]]:
    """Convert YouTube json3 subtitle data to a list of transcript chunks.

    Each chunk has:
        - start (float): Start time in seconds.
        - duration (float): Duration in seconds.
        - text (str): Subtitle text.

    Empty events (style/layout-only) and events without text segments are filtered out.
    """
    events = json3_data.get("events", [])
    chunks: list[dict[str, float | str]] = []

    for event in events:
        segs = event.get("segs")
        if not segs:
            continue

        text = "".join(seg.get("utf8", "") for seg in segs).strip()
        if not text:
            continue

        t_start_ms = event.get("tStartMs", 0)
        d_duration_ms = event.get("dDurationMs", 0)

        chunks.append(
            {
                "start": round(t_start_ms / 1000.0, 3),
                "duration": round(d_duration_ms / 1000.0, 3),
                "text": text,
            }
        )

    return chunks
