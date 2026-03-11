"""Tests for the push-metadata command."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()


def create_metadata_artifact(tmp_path: Path, video_id: str = "test_vid01") -> Path:
    metadata_storage = tmp_path / f"{video_id}_metadata_storage.json"
    metadata_storage.write_text(
        json.dumps(
            {
                "video_id": video_id,
                "title": "테스트 제목",
                "channel_name": "테스트 채널",
                "published_at": "2024-06-15T00:00:00Z",
                "channel_id": "channel_123",
                "uploader_id": "@tester",
                "uploader_url": "https://youtube.com/@tester",
                "duration_sec": 123,
                "thumbnail_url": "https://example.com/thumb.jpg",
                "description": "설명",
                "categories": ["Education"],
                "tags": ["korean"],
                "source_backend": "decodo-scraper",
                "fetched_at": "2026-03-12T00:00:00Z",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return metadata_storage


def test_push_metadata_uploads_to_video_metadata_bucket(tmp_path: Path) -> None:
    metadata_storage = create_metadata_artifact(tmp_path)
    mock_storage_bucket = MagicMock()
    mock_supabase = MagicMock()
    mock_supabase.storage.from_.return_value = mock_storage_bucket

    with patch("kcontext_cli.commands.push_metadata.create_client", return_value=mock_supabase):
        result = runner.invoke(app, ["push-metadata", "-m", str(metadata_storage)])

    assert result.exit_code == 0
    mock_supabase.storage.from_.assert_called_once_with("video-metadata")
    upload_call = mock_storage_bucket.upload.call_args
    assert upload_call.kwargs["path"] == "test_vid01.json"
    assert upload_call.kwargs["file_options"] == {
        "content-type": "application/json",
        "upsert": "true",
    }


def test_push_metadata_rejects_missing_video_id(tmp_path: Path) -> None:
    metadata_storage = tmp_path / "broken_metadata_storage.json"
    metadata_storage.write_text('{"title": "missing id"}', encoding="utf-8")

    result = runner.invoke(app, ["push-metadata", "-m", str(metadata_storage)])

    assert result.exit_code == 1
