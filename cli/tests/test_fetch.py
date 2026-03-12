import json
import subprocess
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

from kcontext_cli.fetch_backends.base import FetchResult, VideoMetadata
from kcontext_cli.main import app

runner = CliRunner()
DEFAULT_AUDIO_LANGUAGE_CODE = "ko"

MOCK_METADATA_JSON = {
    "id": "test_abc123",
    "title": "테스트 영상 제목",
    "channel": "테스트 채널",
    "upload_date": "20240615",
    "language": "ko",
    "channel_id": "channel_123",
    "uploader_id": "@tester",
    "uploader_url": "https://youtube.com/@tester",
    "duration": 123,
    "description": "테스트 설명",
    "categories": ["Education"],
    "tags": ["korean", "test"],
    "thumbnail": "https://example.com/thumb.jpg",
}

MOCK_JSON3_DATA = {
    "events": [
        {"tStartMs": 0, "dDurationMs": 2500, "segs": [{"utf8": "안녕하세요 여러분"}]},
        {"tStartMs": 2500, "dDurationMs": 3000, "segs": [{"utf8": "오늘은 정말 좋은 날씨네요"}]},
        {"tStartMs": 5500, "dDurationMs": 2300, "segs": [{"utf8": "진짜 행복해요"}]},
    ]
}


def _write_mock_subtitle_file(command: list[str], video_id: str, json3_data: dict) -> None:
    output_template = Path(command[command.index("--output") + 1])
    subtitle_path = output_template.parent / f"{video_id}.ko.json3"
    subtitle_path.write_text(json.dumps(json3_data, ensure_ascii=False), encoding="utf-8")


def _mock_subprocess_fetch_ok(metadata=None, json3_data=None):
    """Create a subprocess mock that writes a json3 subtitle file."""
    if metadata is None:
        metadata = MOCK_METADATA_JSON
    if json3_data is None:
        json3_data = MOCK_JSON3_DATA

    def _run(command: list[str], **_kwargs):
        _write_mock_subtitle_file(command, metadata["id"], json3_data)
        return subprocess.CompletedProcess(
            args=command,
            returncode=0,
            stdout=json.dumps(metadata, ensure_ascii=False),
            stderr="",
        )

    return _run


def _decodo_fetch_result(video_id: str = "test_abc123") -> FetchResult:
    return FetchResult(
        metadata=VideoMetadata(
            video_id=video_id,
            title="Decodo 테스트 영상",
            channel_name="Decodo 채널",
            published_at="2024-06-15T00:00:00Z",
            audio_language_code="ko",
            channel_id="channel_456",
            uploader_id="@decodo",
            uploader_url="https://youtube.com/@decodo",
            duration_sec=321,
            thumbnail_url="https://example.com/decodo.jpg",
            description="Decodo 설명",
            categories=["Music"],
            tags=["decodo", "subtitle"],
            source_backend="decodo-scraper",
            fetched_at="2026-03-12T00:00:00Z",
        ),
        transcript=[
            {"start": 0.0, "duration": 1.2, "text": "첫 줄"},
            {"start": 1.2, "duration": 1.8, "text": "둘째 줄"},
        ],
    )


def test_fetch_success(tmp_path):
    output_file = tmp_path / "out.json"

    with patch("subprocess.run", side_effect=_mock_subprocess_fetch_ok()):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    assert output_file.exists()
    data = json.loads(output_file.read_text(encoding="utf-8"))
    assert data["video_id"] == "test_abc123"
    assert data["title"] == "테스트 영상 제목"
    assert data["channel_name"] == "테스트 채널"
    assert data["published_at"] == "2024-06-15T00:00:00Z"
    assert data["audio_language_code"] == "ko"
    assert len(data["transcript"]) == 3

    metadata_sidecar = tmp_path / "test_abc123_metadata_raw.json"
    assert metadata_sidecar.exists()
    metadata = json.loads(metadata_sidecar.read_text(encoding="utf-8"))
    assert metadata["video_id"] == "test_abc123"
    assert metadata["audio_language_code"] == "ko"
    assert metadata["channel_id"] == "channel_123"
    assert metadata["duration_sec"] == 123
    assert metadata["thumbnail_url"] == "https://example.com/thumb.jpg"
    assert metadata["source_backend"] == "ytdlp"


def test_fetch_output_preserves_korean(tmp_path):
    output_file = tmp_path / "korean.json"

    with patch("subprocess.run", side_effect=_mock_subprocess_fetch_ok()):
        runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    raw_content = output_file.read_text(encoding="utf-8")
    assert "안녕하세요" in raw_content
    assert "\\u" not in raw_content


def test_fetch_no_manual_cc(tmp_path):
    output_file = tmp_path / "out.json"
    mock_result = subprocess.CompletedProcess(
        args=[],
        returncode=0,
        stdout=json.dumps(MOCK_METADATA_JSON, ensure_ascii=False),
        stderr="",
    )

    with patch("subprocess.run", return_value=mock_result):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_invalid_video_id(tmp_path):
    output_file = tmp_path / "out.json"
    mock_subprocess_result = subprocess.CompletedProcess(
        args=[], returncode=1, stdout="", stderr="ERROR: Video unavailable"
    )

    with patch("subprocess.run", return_value=mock_subprocess_result):
        result = runner.invoke(
            app,
            [
                "fetch",
                "invalid_id",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_transcript_schema(tmp_path):
    output_file = tmp_path / "out.json"

    with patch("subprocess.run", side_effect=_mock_subprocess_fetch_ok()):
        runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    data = json.loads(output_file.read_text(encoding="utf-8"))
    first_chunk = data["transcript"][0]
    assert "start" in first_chunk
    assert "duration" in first_chunk
    assert "text" in first_chunk
    assert isinstance(first_chunk["start"], (int, float))
    assert isinstance(first_chunk["duration"], (int, float))
    assert isinstance(first_chunk["text"], str)


def test_fetch_ytdlp_not_installed(tmp_path):
    output_file = tmp_path / "out.json"

    with patch("subprocess.run", side_effect=FileNotFoundError):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_empty_subtitle(tmp_path):
    output_file = tmp_path / "out.json"
    empty_json3 = {"events": []}

    with patch("subprocess.run", side_effect=_mock_subprocess_fetch_ok(json3_data=empty_json3)):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_uses_proxy_for_ytdlp(tmp_path):
    output_file = tmp_path / "out.json"
    proxy_url = "http://127.0.0.1:8118"

    with patch("subprocess.run", side_effect=_mock_subprocess_fetch_ok()) as mock_subprocess:
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--youtube-proxy-url",
                proxy_url,
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    called_args = mock_subprocess.call_args.args[0]
    assert "--proxy" in called_args
    assert proxy_url in called_args


def test_fetch_uses_proxy_from_env(tmp_path):
    output_file = tmp_path / "out.json"
    proxy_url = "http://127.0.0.1:8118"

    with (
        patch.dict("os.environ", {"KCONTEXT_YOUTUBE_PROXY_URL": proxy_url}, clear=False),
        patch("subprocess.run", side_effect=_mock_subprocess_fetch_ok()) as mock_subprocess,
    ):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    called_args = mock_subprocess.call_args.args[0]
    assert "--proxy" in called_args
    assert proxy_url in called_args


def test_fetch_uses_decodo_proxy_from_env(tmp_path):
    output_file = tmp_path / "out.json"

    decodo_proxy_url = "http://user-name:pa%3Ass@gate.decodo.local:10001"
    with (
        patch.dict(
            "os.environ",
            {
                "KCONTEXT_YOUTUBE_PROXY_PROVIDER": "decodo",
                "DECODO_PROXY_SCHEME": "http",
                "DECODO_PROXY_HOST": "gate.decodo.local",
                "DECODO_PROXY_PORT": "10001",
                "DECODO_PROXY_USERNAME": "user-name",
                "DECODO_PROXY_PASSWORD": "pa:ss",
            },
            clear=False,
        ),
        patch("subprocess.run", side_effect=_mock_subprocess_fetch_ok()) as mock_subprocess,
    ):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    called_args = mock_subprocess.call_args.args[0]
    assert "--proxy" in called_args
    assert decodo_proxy_url in called_args
    assert "Using YouTube proxy: gate.decodo.local:10001" in result.output
    assert "pa:ss" not in result.output


def test_fetch_tags_proxy_auth_failure(tmp_path):
    output_file = tmp_path / "out.json"
    proxy_url = "http://user:password@proxy.example.com:10001"
    mock_subprocess_result = subprocess.CompletedProcess(
        args=[],
        returncode=1,
        stdout="",
        stderr="Proxy Authentication Required (407)",
    )

    with patch("subprocess.run", return_value=mock_subprocess_result):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--youtube-proxy-url",
                proxy_url,
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert "Error [proxy_auth_failed]" in result.output
    assert "proxy.example.com:10001" in result.output
    assert "user:password" not in result.output


def test_fetch_rejects_non_http_proxy_url(tmp_path):
    output_file = tmp_path / "out.json"

    with patch("subprocess.run") as mock_subprocess:
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--youtube-proxy-url",
                "socks5://127.0.0.1:9050",
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert not output_file.exists()
    mock_subprocess.assert_not_called()


def test_fetch_uses_decodo_scraper_backend(tmp_path):
    output_file = tmp_path / "out.json"

    with patch(
        "kcontext_cli.commands.fetch.decodo_scraper_backend.fetch",
        return_value=_decodo_fetch_result(),
    ) as mock_backend:
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--fetch-backend",
                "decodo-scraper",
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    mock_backend.assert_called_once_with(
        video_id="test_abc123",
        youtube_proxy_url=None,
        default_audio_language_code=DEFAULT_AUDIO_LANGUAGE_CODE,
    )
    data = json.loads(output_file.read_text(encoding="utf-8"))
    assert data["title"] == "Decodo 테스트 영상"
    assert data["audio_language_code"] == "ko"
    metadata = json.loads((tmp_path / "test_abc123_metadata_raw.json").read_text(encoding="utf-8"))
    assert metadata["source_backend"] == "decodo-scraper"
    assert metadata["audio_language_code"] == "ko"
    assert metadata["description"] == "Decodo 설명"


def test_fetch_decodo_scraper_tags_api_failure(tmp_path):
    output_file = tmp_path / "out.json"

    from kcontext_cli.fetch_backends.base import FetchBackendError

    with patch(
        "kcontext_cli.commands.fetch.decodo_scraper_backend.fetch",
        side_effect=FetchBackendError(
            "Decodo API rejected the request",
            error_class="api_auth_failed",
            action="fetch Decodo scraper API data",
        ),
    ):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--fetch-backend",
                "decodo-scraper",
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert "Error [api_auth_failed]" in result.output


def test_fetch_rejects_unknown_backend(tmp_path):
    output_file = tmp_path / "out.json"

    with patch("subprocess.run") as mock_subprocess:
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--fetch-backend",
                "unknown-backend",
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    mock_subprocess.assert_not_called()


def test_fetch_uses_default_audio_language_code_when_provider_omits_it(tmp_path):
    output_file = tmp_path / "out.json"
    metadata_without_language = {
        key: value for key, value in MOCK_METADATA_JSON.items() if key != "language"
    }

    with patch(
        "subprocess.run",
        side_effect=_mock_subprocess_fetch_ok(metadata=metadata_without_language),
    ):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--default-audio-language-code",
                "ko-KR",
            ],
        )

    assert result.exit_code == 0
    data = json.loads(output_file.read_text(encoding="utf-8"))
    assert data["audio_language_code"] == "ko"
