"""E2E pipeline integration test — verifies list → fetch → build → push data flow."""

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()

VIDEO_ID = "test_pipeline_01"

MOCK_RAW_JSON = {
    "video_id": VIDEO_ID,
    "title": "파이프라인 테스트 영상",
    "channel_name": "테스트 채널",
    "published_at": "2024-06-15T00:00:00Z",
    "transcript": [
        {"start": 0.0, "duration": 2.5, "text": "안녕하세요"},
        {"start": 2.5, "duration": 3.0, "text": "반갑습니다"},
    ],
}

MOCK_TRANSCRIPT = [
    {"start": 0.0, "duration": 2.5, "text": "안녕하세요"},
    {"start": 2.5, "duration": 3.0, "text": "반갑습니다"},
]

# yt-dlp --dump-json mock data
MOCK_DUMP_JSON = {
    "id": VIDEO_ID,
    "title": "파이프라인 테스트 영상",
    "channel": "테스트 채널",
    "upload_date": "20240615",
    "subtitles": {
        "ko": [
            {"ext": "json3", "url": "https://example.com/subtitle.json3"},
        ]
    },
    "automatic_captions": {},
}

MOCK_JSON3_DATA = {
    "events": [
        {"tStartMs": 0, "dDurationMs": 2500, "segs": [{"utf8": "안녕하세요"}]},
        {"tStartMs": 2500, "dDurationMs": 3000, "segs": [{"utf8": "반갑습니다"}]},
    ]
}


def _mock_dump_json_result(dump_json=None):
    """Build a subprocess.CompletedProcess for yt-dlp --dump-json."""
    if dump_json is None:
        dump_json = MOCK_DUMP_JSON
    return subprocess.CompletedProcess(
        args=[], returncode=0, stdout=json.dumps(dump_json, ensure_ascii=False), stderr=""
    )


def _mock_urllib_open(json3_data=None):
    """Create a mock opener for urllib.request that returns json3 data."""
    if json3_data is None:
        json3_data = MOCK_JSON3_DATA

    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(json3_data, ensure_ascii=False).encode("utf-8")
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    mock_opener = MagicMock()
    mock_opener.open.return_value = mock_response

    return mock_opener


def _make_mock_conn() -> tuple[MagicMock, MagicMock]:
    """Build a mock psycopg2 connection with cursor context manager support."""
    mock_cursor = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cm.__exit__ = MagicMock(return_value=False)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cm

    return mock_conn, mock_cursor


class TestE2EPipeline:
    """Test the full CLI pipeline with mocked external APIs."""

    def test_full_pipeline_data_flow(self, tmp_path: Path) -> None:
        """list → fetch → build → push: data flows correctly through all stages."""
        raw_json_path = tmp_path / f"{VIDEO_ID}_raw.json"
        build_dir = tmp_path / "build"
        build_dir.mkdir()

        # Stage 1: list — mock yt-dlp to return our test video ID
        mock_list_result = subprocess.CompletedProcess(
            args=[], returncode=0, stdout=f"{VIDEO_ID}\n", stderr=""
        )
        with patch("subprocess.run", return_value=mock_list_result):
            result = runner.invoke(app, ["list", "https://youtube.com/@test", "--limit", "1"])
        assert result.exit_code == 0
        assert VIDEO_ID in result.output

        # Stage 2: fetch — mock yt-dlp --dump-json + urllib json3 download
        mock_opener = _mock_urllib_open()
        with (
            patch("subprocess.run", return_value=_mock_dump_json_result()),
            patch(
                "kcontext_cli.commands.fetch.urllib.request.build_opener",
                return_value=mock_opener,
            ),
        ):
            result = runner.invoke(app, ["fetch", VIDEO_ID, "-o", str(raw_json_path)])
        assert result.exit_code == 0
        assert raw_json_path.exists()

        # Verify raw JSON structure
        raw_data = json.loads(raw_json_path.read_text(encoding="utf-8"))
        assert raw_data["video_id"] == VIDEO_ID
        assert raw_data["published_at"] == "2024-06-15T00:00:00Z"
        assert len(raw_data["transcript"]) == 2

        # Stage 3: build — pure transformation, no mocks needed
        result = runner.invoke(app, ["build", str(raw_json_path), "-d", str(build_dir)])
        assert result.exit_code == 0

        storage_file = build_dir / f"{VIDEO_ID}_storage.json"
        video_csv = build_dir / f"{VIDEO_ID}_video.csv"
        subtitle_csv = build_dir / f"{VIDEO_ID}_subtitle.csv"

        assert storage_file.exists()
        assert video_csv.exists()
        assert subtitle_csv.exists()

        # Verify storage JSON
        storage_data = json.loads(storage_file.read_text(encoding="utf-8"))
        assert len(storage_data) == 2
        assert "start_time" in storage_data[0]
        assert "duration" in storage_data[0]
        assert "text" in storage_data[0]

        # Stage 4: push — mock Supabase Storage and psycopg2
        mock_supabase = MagicMock()
        mock_bucket = MagicMock()
        mock_supabase.storage.from_.return_value = mock_bucket

        mock_conn, _mock_cursor = _make_mock_conn()

        with (
            patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
            patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
        ):
            result = runner.invoke(
                app,
                ["push", "-s", str(storage_file), "-vc", str(video_csv), "-sc", str(subtitle_csv)],
            )
        assert result.exit_code == 0
        mock_bucket.upload.assert_called_once()
        mock_conn.commit.assert_called_once()

    def test_pipeline_skips_video_without_manual_cc(self, tmp_path: Path) -> None:
        """fetch should fail gracefully when video has no manual Korean CC."""
        raw_json_path = tmp_path / f"{VIDEO_ID}_raw.json"

        dump_json_no_ko = {**MOCK_DUMP_JSON, "subtitles": {}}
        with patch("subprocess.run", return_value=_mock_dump_json_result(dump_json_no_ko)):
            result = runner.invoke(app, ["fetch", VIDEO_ID, "-o", str(raw_json_path)])

        assert result.exit_code == 1
        assert not raw_json_path.exists()

    def test_pipeline_handles_korean_text_throughout(self, tmp_path: Path) -> None:
        """Korean text must survive the full pipeline without corruption."""
        korean_text = '괄호(brackets) 따옴표"quotes" 한국어'
        video_id = "korean_test_01"
        raw_json_path = tmp_path / f"{video_id}_raw.json"
        build_dir = tmp_path / "build"
        build_dir.mkdir()

        dump_json_korean = {
            "id": video_id,
            "title": korean_text,
            "channel": "테스트 채널",
            "upload_date": "20240615",
            "subtitles": {"ko": [{"ext": "json3", "url": "https://example.com/subtitle.json3"}]},
            "automatic_captions": {},
        }
        json3_korean = {
            "events": [
                {"tStartMs": 0, "dDurationMs": 2500, "segs": [{"utf8": korean_text}]},
            ]
        }

        mock_opener = _mock_urllib_open(json3_korean)
        with (
            patch("subprocess.run", return_value=_mock_dump_json_result(dump_json_korean)),
            patch(
                "kcontext_cli.commands.fetch.urllib.request.build_opener",
                return_value=mock_opener,
            ),
        ):
            result = runner.invoke(app, ["fetch", video_id, "-o", str(raw_json_path)])
        assert result.exit_code == 0

        raw_content = raw_json_path.read_text(encoding="utf-8")
        assert "괄호" in raw_content
        assert "따옴표" in raw_content
        assert "한국어" in raw_content
        assert "\\u" not in raw_content

        # Build artifacts
        build_result = runner.invoke(app, ["build", str(raw_json_path), "-d", str(build_dir)])
        assert build_result.exit_code == 0

        storage_file = build_dir / f"{video_id}_storage.json"
        assert storage_file.exists()

        storage_content = storage_file.read_text(encoding="utf-8")
        # Korean text preserved in storage JSON without unicode escaping
        assert "괄호" in storage_content
        assert "\\u" not in storage_content

    def test_build_artifacts_schema_correctness(self, tmp_path: Path) -> None:
        """build command must produce artifacts with correct schema from raw JSON."""
        raw_json_path = tmp_path / f"{VIDEO_ID}_raw.json"
        build_dir = tmp_path / "build"
        build_dir.mkdir()

        # Write raw JSON directly (skip fetch, test build in isolation)
        raw_json_path.write_text(
            json.dumps(MOCK_RAW_JSON, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        result = runner.invoke(app, ["build", str(raw_json_path), "-d", str(build_dir)])
        assert result.exit_code == 0

        # Validate storage.json schema
        storage_file = build_dir / f"{VIDEO_ID}_storage.json"
        storage_data = json.loads(storage_file.read_text(encoding="utf-8"))
        assert isinstance(storage_data, list)
        assert len(storage_data) == 2
        for item in storage_data:
            assert "start_time" in item
            assert "duration" in item
            assert "text" in item
            assert isinstance(item["start_time"], float)
            assert isinstance(item["duration"], float)
            assert isinstance(item["text"], str)

        # Validate video.csv has correct tab-delimited columns
        video_csv = build_dir / f"{VIDEO_ID}_video.csv"
        video_rows = video_csv.read_text(encoding="utf-8").strip().splitlines()
        assert len(video_rows) >= 1
        cols = video_rows[0].split("\t")
        assert len(cols) == 4
        assert cols[0] == VIDEO_ID
        assert cols[1] == "파이프라인 테스트 영상"
        assert cols[2] == "테스트 채널"
        assert cols[3] == "2024-06-15T00:00:00Z"

        # Validate subtitle.csv has correct tab-delimited columns
        subtitle_csv = build_dir / f"{VIDEO_ID}_subtitle.csv"
        subtitle_rows = subtitle_csv.read_text(encoding="utf-8").strip().splitlines()
        assert len(subtitle_rows) == 2
        for row in subtitle_rows:
            sub_cols = row.split("\t")
            assert len(sub_cols) == 3
            assert sub_cols[0] == VIDEO_ID
