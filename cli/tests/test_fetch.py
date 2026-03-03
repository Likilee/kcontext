import json
import subprocess
from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()

MOCK_YTDLP_OUTPUT = "test_abc123\n테스트 영상 제목\n테스트 채널\n20240615\n"

MOCK_TRANSCRIPT_DICTS = [
    {"start": 0.0, "duration": 2.5, "text": "안녕하세요 여러분"},
    {"start": 2.5, "duration": 3.0, "text": "오늘은 정말 좋은 날씨네요"},
    {"start": 5.5, "duration": 2.3, "text": "진짜 행복해요"},
]


def _make_mock_ytt(chunks):
    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = chunks

    mock_transcript_list = MagicMock()
    mock_transcript_list.find_manually_created_transcript.return_value = mock_transcript

    mock_ytt = MagicMock()
    mock_ytt.list.return_value = mock_transcript_list

    return mock_ytt


def _mock_subprocess_ok():
    return subprocess.CompletedProcess(args=[], returncode=0, stdout=MOCK_YTDLP_OUTPUT, stderr="")


def test_fetch_success(tmp_path):
    output_file = tmp_path / "out.json"
    mock_ytt = _make_mock_ytt(MOCK_TRANSCRIPT_DICTS)

    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ),
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
    mock_ytt = _make_mock_ytt(MOCK_TRANSCRIPT_DICTS)

    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ),
    ):
        runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    raw_content = output_file.read_text(encoding="utf-8")
    assert "안녕하세요" in raw_content
    assert "\\u" not in raw_content


def test_fetch_no_manual_cc(tmp_path):
    from youtube_transcript_api import NoTranscriptFound

    output_file = tmp_path / "out.json"

    mock_transcript_list = MagicMock()
    mock_transcript_list.find_manually_created_transcript.side_effect = NoTranscriptFound(
        "test_abc123", ["ko"], []
    )
    mock_ytt = MagicMock()
    mock_ytt.list.return_value = mock_transcript_list

    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()) as mock_subprocess,
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ),
    ):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 1
    assert not output_file.exists()
    assert mock_subprocess.call_count == 0


def test_fetch_invalid_video_id(tmp_path):
    output_file = tmp_path / "out.json"
    mock_subprocess_result = subprocess.CompletedProcess(
        args=[], returncode=1, stdout="", stderr="ERROR: Video unavailable"
    )
    mock_ytt = _make_mock_ytt(MOCK_TRANSCRIPT_DICTS)

    with (
        patch("subprocess.run", return_value=mock_subprocess_result),
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ),
    ):
        result = runner.invoke(app, ["fetch", "invalid_id", "-o", str(output_file)])

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_transcript_schema(tmp_path):
    output_file = tmp_path / "out.json"
    mock_ytt = _make_mock_ytt(MOCK_TRANSCRIPT_DICTS)

    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ),
    ):
        runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    data = json.loads(output_file.read_text(encoding="utf-8"))
    first_chunk = data["transcript"][0]
    assert "start" in first_chunk
    assert "duration" in first_chunk
    assert "text" in first_chunk
    assert isinstance(first_chunk["start"], float)
    assert isinstance(first_chunk["duration"], float)
    assert isinstance(first_chunk["text"], str)


def test_fetch_ytdlp_not_installed(tmp_path):
    output_file = tmp_path / "out.json"
    mock_ytt = _make_mock_ytt(MOCK_TRANSCRIPT_DICTS)

    with (
        patch("subprocess.run", side_effect=FileNotFoundError),
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ),
    ):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 1
    assert not output_file.exists()


def test_fetch_object_style_chunks(tmp_path):
    output_file = tmp_path / "out.json"

    class FakeSnippet:
        def __init__(self, start: float, duration: float, text: str) -> None:
            self.start = start
            self.duration = duration
            self.text = text

    object_chunks = [
        FakeSnippet(0.0, 2.5, "안녕하세요"),
        FakeSnippet(2.5, 3.0, "반갑습니다"),
    ]

    mock_ytt = _make_mock_ytt(object_chunks)

    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()),
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ),
    ):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 0
    data = json.loads(output_file.read_text(encoding="utf-8"))
    assert len(data["transcript"]) == 2
    assert data["transcript"][0]["text"] == "안녕하세요"
    assert data["transcript"][0]["start"] == 0.0
    assert data["transcript"][1]["duration"] == 3.0


def test_fetch_uses_proxy_for_ytdlp_and_ytt(tmp_path):
    output_file = tmp_path / "out.json"
    mock_ytt = _make_mock_ytt(MOCK_TRANSCRIPT_DICTS)
    proxy_url = "http://127.0.0.1:8118"

    with (
        patch("subprocess.run", return_value=_mock_subprocess_ok()) as mock_subprocess,
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ) as mock_ytt_api,
    ):
        result = runner.invoke(
            app,
            [
                "fetch",
                "test_abc123",
                "-o",
                str(output_file),
                "--youtube-proxy-url",
                proxy_url,
            ],
        )

    assert result.exit_code == 0
    called_args = mock_subprocess.call_args.args[0]
    assert "--proxy" in called_args
    assert proxy_url in called_args

    proxy_config = mock_ytt_api.call_args.kwargs["proxy_config"]
    assert proxy_config is not None
    assert proxy_config.to_requests_dict() == {"http": proxy_url, "https": proxy_url}


def test_fetch_uses_proxy_from_env(tmp_path):
    output_file = tmp_path / "out.json"
    mock_ytt = _make_mock_ytt(MOCK_TRANSCRIPT_DICTS)
    proxy_url = "http://127.0.0.1:8118"

    with (
        patch.dict("os.environ", {"KCONTEXT_YOUTUBE_PROXY_URL": proxy_url}, clear=False),
        patch("subprocess.run", return_value=_mock_subprocess_ok()) as mock_subprocess,
        patch(
            "kcontext_cli.commands.fetch.YouTubeTranscriptApi",
            return_value=mock_ytt,
        ) as mock_ytt_api,
    ):
        result = runner.invoke(app, ["fetch", "test_abc123", "-o", str(output_file)])

    assert result.exit_code == 0
    called_args = mock_subprocess.call_args.args[0]
    assert "--proxy" in called_args
    assert proxy_url in called_args

    proxy_config = mock_ytt_api.call_args.kwargs["proxy_config"]
    assert proxy_config is not None
    assert proxy_config.to_requests_dict() == {"http": proxy_url, "https": proxy_url}


def test_fetch_rejects_non_http_proxy_url(tmp_path):
    output_file = tmp_path / "out.json"

    with (
        patch("subprocess.run") as mock_subprocess,
        patch("kcontext_cli.commands.fetch.YouTubeTranscriptApi") as mock_ytt_api,
    ):
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
    mock_ytt_api.assert_not_called()
