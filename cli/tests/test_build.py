"""Tests for the build command."""

import csv
import json

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()


def test_build_produces_three_artifacts(sample_raw_json, tmp_workspace):
    input_file = tmp_workspace / "test_abc123_raw.json"
    input_file.write_text(json.dumps(sample_raw_json, ensure_ascii=False), encoding="utf-8")

    result = runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])

    assert result.exit_code == 0
    assert (tmp_workspace / "test_abc123_storage.json").exists()
    assert (tmp_workspace / "test_abc123_video.csv").exists()
    assert (tmp_workspace / "test_abc123_subtitle.csv").exists()


def test_build_storage_json_format(sample_raw_json, tmp_workspace):
    input_file = tmp_workspace / "test_abc123_raw.json"
    input_file.write_text(json.dumps(sample_raw_json, ensure_ascii=False), encoding="utf-8")

    runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])

    data = json.loads((tmp_workspace / "test_abc123_storage.json").read_text(encoding="utf-8"))
    assert isinstance(data, list)
    assert len(data) == 3
    first = data[0]
    assert "start_time" in first
    assert "duration" in first
    assert "text" in first
    assert isinstance(first["start_time"], float)
    assert isinstance(first["duration"], float)


def test_build_video_csv_format(sample_raw_json, tmp_workspace):
    input_file = tmp_workspace / "test_abc123_raw.json"
    input_file.write_text(json.dumps(sample_raw_json, ensure_ascii=False), encoding="utf-8")

    runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])

    content = (tmp_workspace / "test_abc123_video.csv").read_text(encoding="utf-8")
    rows = list(csv.reader(content.splitlines(), delimiter="\t"))
    assert len(rows) == 1
    assert rows[0][0] == "test_abc123"
    assert rows[0][1] == "테스트 영상 제목"
    assert rows[0][2] == "테스트 채널"
    assert rows[0][3] == "2024-06-15T00:00:00Z"


def test_build_subtitle_csv_format(sample_raw_json, tmp_workspace):
    input_file = tmp_workspace / "test_abc123_raw.json"
    input_file.write_text(json.dumps(sample_raw_json, ensure_ascii=False), encoding="utf-8")

    runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])

    content = (tmp_workspace / "test_abc123_subtitle.csv").read_text(encoding="utf-8")
    rows = list(csv.reader(content.splitlines(), delimiter="\t"))
    assert len(rows) == 3
    assert rows[0][0] == "test_abc123"
    assert rows[0][1] == "0.0"
    assert rows[0][2] == "안녕하세요 여러분"


def test_build_korean_text_preserved(sample_raw_json, tmp_workspace):
    input_file = tmp_workspace / "test_abc123_raw.json"
    input_file.write_text(json.dumps(sample_raw_json, ensure_ascii=False), encoding="utf-8")

    runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])

    raw_content = (tmp_workspace / "test_abc123_storage.json").read_text(encoding="utf-8")
    assert "안녕하세요" in raw_content
    assert "\\u" not in raw_content


def test_build_invalid_input(tmp_workspace):
    result = runner.invoke(
        app, ["build", str(tmp_workspace / "nonexistent.json"), "-d", str(tmp_workspace)]
    )
    assert result.exit_code == 1

    bad_json = tmp_workspace / "bad.json"
    bad_json.write_text("not valid json", encoding="utf-8")
    result = runner.invoke(app, ["build", str(bad_json), "-d", str(tmp_workspace)])
    assert result.exit_code == 1


def test_build_tab_in_text_sanitized(tmp_workspace):
    raw_with_tab = {
        "video_id": "test_tab",
        "title": "제목\t탭포함",
        "channel_name": "채널",
        "published_at": "2024-06-15T00:00:00Z",
        "transcript": [
            {"start": 0.0, "duration": 2.5, "text": "안녕\t하세요"},
        ],
    }
    input_file = tmp_workspace / "test_tab_raw.json"
    input_file.write_text(json.dumps(raw_with_tab, ensure_ascii=False), encoding="utf-8")

    result = runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])
    assert result.exit_code == 0

    video_content = (tmp_workspace / "test_tab_video.csv").read_text(encoding="utf-8")
    rows = list(csv.reader(video_content.splitlines(), delimiter="\t"))
    assert rows[0][1] == "제목 탭포함"

    storage_data = json.loads((tmp_workspace / "test_tab_storage.json").read_text(encoding="utf-8"))
    assert storage_data[0]["text"] == "안녕 하세요"


def test_build_missing_required_keys(tmp_workspace):
    incomplete = {"video_id": "test", "title": "Test"}
    input_file = tmp_workspace / "incomplete_raw.json"
    input_file.write_text(json.dumps(incomplete), encoding="utf-8")

    result = runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])
    assert result.exit_code == 1


def test_build_storage_json_renames_start_to_start_time(sample_raw_json, tmp_workspace):
    input_file = tmp_workspace / "test_abc123_raw.json"
    input_file.write_text(json.dumps(sample_raw_json, ensure_ascii=False), encoding="utf-8")

    runner.invoke(app, ["build", str(input_file), "-d", str(tmp_workspace)])

    data = json.loads((tmp_workspace / "test_abc123_storage.json").read_text(encoding="utf-8"))
    for item in data:
        assert "start_time" in item
        assert "start" not in item
    assert data[0]["start_time"] == 0.0
    assert data[1]["start_time"] == 2.5
    assert data[2]["start_time"] == 5.5
