"""Tests for the build-metadata command."""

import json

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()
DEFAULT_AUDIO_LANGUAGE_CODE = "ko"


def _sample_metadata_raw() -> dict[str, object]:
    return {
        "video_id": "test_abc123",
        "title": "테스트 영상 제목",
        "channel_name": "테스트 채널",
        "published_at": "2024-06-15T00:00:00Z",
        "audio_language_code": "ko",
        "channel_id": "channel_123",
        "uploader_id": "@tester",
        "uploader_url": "https://youtube.com/@tester",
        "duration_sec": 123,
        "thumbnail_url": "https://example.com/thumb.jpg",
        "description": "설명",
        "categories": ["Education"],
        "tags": ["korean", "test"],
        "source_backend": "ytdlp",
        "fetched_at": "2026-03-12T00:00:00Z",
    }


def test_build_metadata_produces_storage_artifact(tmp_path) -> None:
    input_file = tmp_path / "test_abc123_metadata_raw.json"
    input_file.write_text(
        json.dumps(_sample_metadata_raw(), ensure_ascii=False),
        encoding="utf-8",
    )

    result = runner.invoke(
        app,
        [
            "build-metadata",
            str(input_file),
            "-d",
            str(tmp_path),
            "--default-audio-language-code",
            DEFAULT_AUDIO_LANGUAGE_CODE,
        ],
    )

    assert result.exit_code == 0
    assert (tmp_path / "test_abc123_metadata_storage.json").exists()


def test_build_metadata_preserves_normalized_payload(tmp_path) -> None:
    input_file = tmp_path / "test_abc123_metadata_raw.json"
    payload = _sample_metadata_raw()
    input_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    runner.invoke(
        app,
        [
            "build-metadata",
            str(input_file),
            "-d",
            str(tmp_path),
            "--default-audio-language-code",
            DEFAULT_AUDIO_LANGUAGE_CODE,
        ],
    )

    storage_payload = json.loads(
        (tmp_path / "test_abc123_metadata_storage.json").read_text(encoding="utf-8")
    )
    assert storage_payload == payload


def test_build_metadata_rejects_missing_keys(tmp_path) -> None:
    input_file = tmp_path / "bad_metadata_raw.json"
    input_file.write_text(json.dumps({"video_id": "bad"}), encoding="utf-8")

    result = runner.invoke(
        app,
        [
            "build-metadata",
            str(input_file),
            "-d",
            str(tmp_path),
            "--default-audio-language-code",
            DEFAULT_AUDIO_LANGUAGE_CODE,
        ],
    )

    assert result.exit_code == 1


def test_build_metadata_uses_default_audio_language_code_for_legacy_sidecar(tmp_path) -> None:
    input_file = tmp_path / "legacy_metadata_raw.json"
    payload = _sample_metadata_raw()
    del payload["audio_language_code"]
    input_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    result = runner.invoke(
        app,
        [
            "build-metadata",
            str(input_file),
            "-d",
            str(tmp_path),
            "--default-audio-language-code",
            "ko-KR",
        ],
    )

    assert result.exit_code == 0
    storage_payload = json.loads(
        (tmp_path / "test_abc123_metadata_storage.json").read_text(encoding="utf-8")
    )
    assert storage_payload["audio_language_code"] == "ko"
