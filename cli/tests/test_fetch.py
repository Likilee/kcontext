import json
import subprocess
from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()

# Simulates the JSON output of `yt-dlp --dump-json`
MOCK_DUMP_JSON = {
    "id": "test_abc123",
    "title": "테스트 영상 제목",
    "channel": "테스트 채널",
    "upload_date": "20240615",
    "subtitles": {
        "ko": [
            {"ext": "json3", "url": "https://example.com/subtitle.json3"},
            {"ext": "srt", "url": "https://example.com/subtitle.srt"},
        ]
    },
    "automatic_captions": {},
}

# Simulates YouTube json3 subtitle data
MOCK_JSON3_DATA = {
    "events": [
        {"tStartMs": 0, "dDurationMs": 2500, "segs": [{"utf8": "안녕하세요 여러분"}]},
        {"tStartMs": 2500, "dDurationMs": 3000, "segs": [{"utf8": "오늘은 정말 좋은 날씨네요"}]},
        {"tStartMs": 5500, "dDurationMs": 2300, "segs": [{"utf8": "진짜 행복해요"}]},
    ]
}


def _mock_subprocess_ok():
    return subprocess.CompletedProcess(
        args=[], returncode=0, stdout=json.dumps(MOCK_DUMP_JSON, ensure_ascii=False), stderr=""
    )


def _mock_urllib_open(json3_data=None):
    """Create a mock for urllib.request that returns json3 data."""
    if json3_data is None:
        json3_data = MOCK_JSON3_DATA

    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(json3_data, ensure_ascii=False).encode("utf-8")
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    mock_opener = MagicMock()
    mock_opener.open.return_value = mock_response

    return mock_opener


def test_fetch_success(tmp_path):
    output_file = tmp_path / "out.json"

    mock_opener = _mock_urllib_open()
    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch("kcontext_cli.commands.fetch.urllib.request.build_opener", return_value=mock_opener),
    ):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 0
    assert output_file.exists()
    data = json.loads(output_file.read_text(encoding="utf-8"))
    assert data["video_id"] == "test_abc123"
    assert data["title"] == "테스트 영상 제목"
    assert data["channel_name"] == "테스트 채널"
    assert data["published_at"] == "2024-06-15T00:00:00Z"
    assert len(data["transcript"]) == 3


def test_fetch_output_preserves_korean(tmp_path):
    output_file = tmp_path / "korean.json"

    mock_opener = _mock_urllib_open()
    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch("kcontext_cli.commands.fetch.urllib.request.build_opener", return_value=mock_opener),
    ):
        runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    raw_content = output_file.read_text(encoding="utf-8")
    assert "안녕하세요" in raw_content
    assert "\\u" not in raw_content


def test_fetch_no_manual_cc(tmp_path):
    output_file = tmp_path / "out.json"
    dump_json_no_ko = {**MOCK_DUMP_JSON, "subtitles": {}}

    mock_result = subprocess.CompletedProcess(
        args=[], returncode=0, stdout=json.dumps(dump_json_no_ko, ensure_ascii=False), stderr=""
    )

    with patch("subprocess.run", return_value=mock_result):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_invalid_video_id(tmp_path):
    output_file = tmp_path / "out.json"
    mock_subprocess_result = subprocess.CompletedProcess(
        args=[], returncode=1, stdout="", stderr="ERROR: Video unavailable"
    )

    with patch("subprocess.run", return_value=mock_subprocess_result):
        result = runner.invoke(app, ["fetch", "invalid_id", "-o", str(output_file)])

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_transcript_schema(tmp_path):
    output_file = tmp_path / "out.json"

    mock_opener = _mock_urllib_open()
    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch("kcontext_cli.commands.fetch.urllib.request.build_opener", return_value=mock_opener),
    ):
        runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

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
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_empty_subtitle(tmp_path):
    output_file = tmp_path / "out.json"
    empty_json3 = {"events": []}

    mock_opener = _mock_urllib_open(empty_json3)
    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch("kcontext_cli.commands.fetch.urllib.request.build_opener", return_value=mock_opener),
    ):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_uses_proxy_for_ytdlp(tmp_path):
    output_file = tmp_path / "out.json"
    proxy_url = "http://127.0.0.1:8118"

    mock_opener = _mock_urllib_open()
    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()) as mock_subprocess,
        patch("kcontext_cli.commands.fetch.urllib.request.build_opener", return_value=mock_opener),
        patch("kcontext_cli.commands.fetch.urllib.request.ProxyHandler") as mock_proxy_handler,
    ):
        result = runner.invoke(
            app,
            ["fetch", "test_abc123", "-o", str(output_file), "--youtube-proxy-url", proxy_url],
        )

    assert result.exit_code == 0
    called_args = mock_subprocess.call_args.args[0]
    assert "--proxy" in called_args
    assert proxy_url in called_args

    # Verify ProxyHandler was called with the proxy URL
    mock_proxy_handler.assert_called_once_with({"http": proxy_url, "https": proxy_url})


def test_fetch_uses_proxy_from_env(tmp_path):
    output_file = tmp_path / "out.json"
    proxy_url = "http://127.0.0.1:8118"

    mock_opener = _mock_urllib_open()
    with (
        patch.dict("os.environ", {"KCONTEXT_YOUTUBE_PROXY_URL": proxy_url}, clear=False),
        patch("subprocess.run", return_value=_mock_subprocess_ok()) as mock_subprocess,
        patch("kcontext_cli.commands.fetch.urllib.request.build_opener", return_value=mock_opener),
        patch("kcontext_cli.commands.fetch.urllib.request.ProxyHandler") as mock_proxy_handler,
    ):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 0
    called_args = mock_subprocess.call_args.args[0]
    assert "--proxy" in called_args
    assert proxy_url in called_args

    mock_proxy_handler.assert_called_once_with({"http": proxy_url, "https": proxy_url})


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
            ],
        )

    assert result.exit_code == 1
    assert not output_file.exists()
    mock_subprocess.assert_not_called()
