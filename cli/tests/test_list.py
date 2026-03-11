"""Tests for the list command."""

import json
import subprocess
from unittest.mock import patch

import typer
from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()


def _extract_ids(output: str) -> list[str]:
    ignored_prefixes = (
        "Extracting",
        "Filtering",
        "Found",
        "Warning",
        "Error",
        "Probe cache",
        "Using YouTube proxy",
    )
    return [
        line
        for line in output.splitlines()
        if line.strip() and not line.startswith(ignored_prefixes)
    ]


def test_list_extracts_video_ids():
    mock_result = subprocess.CompletedProcess(
        args=[],
        returncode=0,
        stdout="id1\nid2\nid3\n",
        stderr="",
    )
    with patch("subprocess.run", return_value=mock_result):
        result = runner.invoke(app, ["list", "https://youtube.com/@channel"])
    assert result.exit_code == 0
    assert "id1" in result.output
    assert "id2" in result.output
    assert "id3" in result.output


def test_list_respects_limit():
    captured_args = []

    def mock_run(args, **kwargs):
        captured_args.extend(args)
        return subprocess.CompletedProcess(args=args, returncode=0, stdout="id1\n", stderr="")

    with patch("subprocess.run", side_effect=mock_run):
        result = runner.invoke(app, ["list", "https://youtube.com/@channel", "--limit", "10"])

    assert result.exit_code == 0
    assert "--playlist-end" in captured_args
    assert "10" in captured_args


def test_list_handles_invalid_url():
    mock_result = subprocess.CompletedProcess(
        args=[],
        returncode=1,
        stdout="",
        stderr="ERROR: Unable to download webpage",
    )
    with patch("subprocess.run", return_value=mock_result):
        result = runner.invoke(app, ["list", "not-a-url"])
    assert result.exit_code == 1


def test_list_handles_empty_results():
    mock_result = subprocess.CompletedProcess(
        args=[],
        returncode=0,
        stdout="",
        stderr="",
    )
    with patch("subprocess.run", return_value=mock_result):
        result = runner.invoke(app, ["list", "https://youtube.com/@emptychannel"])
    assert result.exit_code == 0
    output_lines = [
        line
        for line in result.output.splitlines()
        if line and not line.startswith(("Extracting", "Warning"))
    ]
    assert output_lines == []


def test_list_handles_ytdlp_not_installed():
    with patch("subprocess.run", side_effect=FileNotFoundError):
        result = runner.invoke(app, ["list", "https://youtube.com/@channel"])
    assert result.exit_code == 1


def test_list_handles_timeout():
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="yt-dlp", timeout=120)):
        result = runner.invoke(app, ["list", "https://youtube.com/@channel"])
    assert result.exit_code == 1


def test_list_manual_ko_only_filters_video_ids():
    mock_result = subprocess.CompletedProcess(
        args=[],
        returncode=0,
        stdout="id1\nid2\nid3\n",
        stderr="",
    )

    with (
        patch("subprocess.run", return_value=mock_result),
        patch(
            "kcontext_cli.commands.list_cmd._has_manual_ko_subtitle",
            side_effect=[True, False, True],
        ),
    ):
        result = runner.invoke(
            app,
            [
                "list",
                "https://youtube.com/@channel/videos",
                "--limit",
                "2",
                "--manual-ko-only",
                "--no-probe-cache",
            ],
        )

    assert result.exit_code == 0
    assert _extract_ids(result.output) == ["id1", "id3"]


def test_list_manual_ko_only_uses_probe_max_candidates():
    captured_args = []

    def mock_run(args, **kwargs):
        captured_args.extend(args)
        return subprocess.CompletedProcess(args=args, returncode=0, stdout="id1\n", stderr="")

    with (
        patch("subprocess.run", side_effect=mock_run),
        patch("kcontext_cli.commands.list_cmd._has_manual_ko_subtitle", return_value=True),
    ):
        result = runner.invoke(
            app,
            [
                "list",
                "https://youtube.com/@channel/videos",
                "--limit",
                "10",
                "--manual-ko-only",
                "--probe-max-candidates",
                "40",
                "--no-probe-cache",
            ],
        )

    assert result.exit_code == 0
    assert "--playlist-end" in captured_args
    assert "40" in captured_args


def test_list_manual_ko_only_uses_cache_file(tmp_path):
    cache_file = tmp_path / "probe_cache.json"
    cache_file.write_text(
        json.dumps({"id1": True, "id2": False}, ensure_ascii=False),
        encoding="utf-8",
    )
    mock_result = subprocess.CompletedProcess(
        args=[],
        returncode=0,
        stdout="id1\nid2\nid3\n",
        stderr="",
    )

    with (
        patch("subprocess.run", return_value=mock_result),
        patch(
            "kcontext_cli.commands.list_cmd._has_manual_ko_subtitle",
            side_effect=[True],
        ) as mock_probe,
    ):
        result = runner.invoke(
            app,
            [
                "list",
                "https://youtube.com/@channel/videos",
                "--limit",
                "2",
                "--manual-ko-only",
                "--probe-cache-file",
                str(cache_file),
            ],
        )

    assert result.exit_code == 0
    assert _extract_ids(result.output) == ["id1", "id3"]
    assert mock_probe.call_count == 1
    assert mock_probe.call_args.args == ("id3", None)


def test_list_uses_proxy_for_ytdlp():
    captured_args = []
    proxy_url = "http://127.0.0.1:8118"

    def mock_run(args, **kwargs):
        captured_args.extend(args)
        return subprocess.CompletedProcess(args=args, returncode=0, stdout="id1\n", stderr="")

    with patch("subprocess.run", side_effect=mock_run):
        result = runner.invoke(
            app,
            [
                "list",
                "https://youtube.com/@channel",
                "--youtube-proxy-url",
                proxy_url,
            ],
        )

    assert result.exit_code == 0
    assert "--proxy" in captured_args
    assert proxy_url in captured_args


def test_list_manual_ko_only_passes_proxy_to_probe():
    mock_result = subprocess.CompletedProcess(args=[], returncode=0, stdout="id1\n", stderr="")
    proxy_url = "http://127.0.0.1:8118"

    with (
        patch("subprocess.run", return_value=mock_result),
        patch(
            "kcontext_cli.commands.list_cmd._has_manual_ko_subtitle",
            return_value=True,
        ) as mock_probe,
    ):
        result = runner.invoke(
            app,
            [
                "list",
                "https://youtube.com/@channel/videos",
                "--limit",
                "1",
                "--manual-ko-only",
                "--no-probe-cache",
                "--youtube-proxy-url",
                proxy_url,
            ],
        )

    assert result.exit_code == 0
    assert mock_probe.call_count == 1
    assert mock_probe.call_args.args == ("id1", proxy_url)


def test_list_manual_ko_only_exits_on_proxy_probe_failure():
    mock_result = subprocess.CompletedProcess(args=[], returncode=0, stdout="id1\n", stderr="")
    proxy_url = "http://127.0.0.1:8118"

    with (
        patch("subprocess.run", return_value=mock_result),
        patch(
            "kcontext_cli.commands.list_cmd._has_manual_ko_subtitle",
            side_effect=typer.Exit(code=1),
        ),
    ):
        result = runner.invoke(
            app,
            [
                "list",
                "https://youtube.com/@channel/videos",
                "--limit",
                "1",
                "--manual-ko-only",
                "--no-probe-cache",
                "--youtube-proxy-url",
                proxy_url,
            ],
        )

    assert result.exit_code == 1


def test_list_redacts_proxy_in_output():
    mock_result = subprocess.CompletedProcess(args=[], returncode=0, stdout="id1\n", stderr="")
    proxy_url = "http://user:password@proxy.example.com:10001"

    with patch("subprocess.run", return_value=mock_result):
        result = runner.invoke(
            app,
            ["list", "https://youtube.com/@channel", "--youtube-proxy-url", proxy_url],
        )

    assert result.exit_code == 0
    assert "Using YouTube proxy: proxy.example.com:10001" in result.output
    assert "user:password" not in result.output


def test_list_tags_proxy_unreachable_failure():
    proxy_url = "http://user:password@proxy.example.com:10001"
    mock_result = subprocess.CompletedProcess(
        args=[],
        returncode=1,
        stdout="",
        stderr="Connection refused",
    )

    with patch("subprocess.run", return_value=mock_result):
        result = runner.invoke(
            app,
            ["list", "https://youtube.com/@channel", "--youtube-proxy-url", proxy_url],
        )

    assert result.exit_code == 1
    assert "Error [proxy_unreachable]" in result.output
    assert "proxy.example.com:10001" in result.output
