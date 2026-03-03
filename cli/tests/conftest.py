"""Shared test fixtures for kcontext CLI tests."""

import pytest

SAMPLE_RAW_JSON = {
    "video_id": "test_abc123",
    "title": "테스트 영상 제목",
    "channel_name": "테스트 채널",
    "published_at": "2024-06-15T00:00:00Z",
    "transcript": [
        {"start": 0.0, "duration": 2.5, "text": "안녕하세요 여러분"},
        {"start": 2.5, "duration": 3.0, "text": "오늘은 정말 좋은 날씨네요"},
        {"start": 5.5, "duration": 2.3, "text": "진짜 행복해요"},
    ],
}

SAMPLE_YTDLP_OUTPUT = "dQw4w9WgXcQ\nabc123def\nxyz789ghi\n"

SAMPLE_TRANSCRIPT = [
    {"start": 0.0, "duration": 2.5, "text": "안녕하세요 여러분"},
    {"start": 2.5, "duration": 3.0, "text": "오늘은 정말 좋은 날씨네요"},
    {"start": 5.5, "duration": 2.3, "text": "진짜 행복해요"},
]


@pytest.fixture()
def sample_raw_json() -> dict:
    """Return sample raw JSON matching the fetch output schema."""
    return SAMPLE_RAW_JSON.copy()


@pytest.fixture()
def tmp_workspace(tmp_path):
    """Return a temporary workspace directory."""
    return tmp_path
