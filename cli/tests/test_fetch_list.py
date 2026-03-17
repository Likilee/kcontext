"""Tests for the fetch-list command."""

from pathlib import Path
from unittest.mock import patch

import typer
from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()
DEFAULT_AUDIO_LANGUAGE_CODE = "ko"


def _write_ids_file(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_fetch_list_success(tmp_path: Path) -> None:
    ids_file = tmp_path / "video_ids.txt"
    out_dir = tmp_path / "raw"
    _write_ids_file(ids_file, ["vid1", "vid2"])

    called = []

    def fake_fetch(
        video_id: str,
        output: Path,
        fetch_backend: str = "ytdlp",
        youtube_proxy_url: str | None = None,
        default_audio_language_code: str = DEFAULT_AUDIO_LANGUAGE_CODE,
    ) -> None:
        called.append(video_id)
        assert fetch_backend == "ytdlp"
        assert default_audio_language_code == DEFAULT_AUDIO_LANGUAGE_CODE
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("{}", encoding="utf-8")

    with patch("kcontext_cli.commands.fetch_list.fetch.fetch_subtitle", side_effect=fake_fetch):
        result = runner.invoke(
            app,
            [
                "fetch-list",
                str(ids_file),
                "-d",
                str(out_dir),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    assert called == ["vid1", "vid2"]
    assert (out_dir / "vid1_raw.json").exists()
    assert (out_dir / "vid2_raw.json").exists()


def test_fetch_list_continues_on_error(tmp_path: Path) -> None:
    ids_file = tmp_path / "video_ids.txt"
    out_dir = tmp_path / "raw"
    _write_ids_file(ids_file, ["fail_id", "ok_id"])

    called = []

    def fake_fetch(
        video_id: str,
        output: Path,
        fetch_backend: str = "ytdlp",
        youtube_proxy_url: str | None = None,
        default_audio_language_code: str = DEFAULT_AUDIO_LANGUAGE_CODE,
    ) -> None:
        called.append(video_id)
        assert default_audio_language_code == DEFAULT_AUDIO_LANGUAGE_CODE
        if video_id == "fail_id":
            raise typer.Exit(code=1)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("{}", encoding="utf-8")

    with patch("kcontext_cli.commands.fetch_list.fetch.fetch_subtitle", side_effect=fake_fetch):
        result = runner.invoke(
            app,
            [
                "fetch-list",
                str(ids_file),
                "-d",
                str(out_dir),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    assert called == ["fail_id", "ok_id"]
    assert (out_dir / "ok_id_raw.json").exists()


def test_fetch_list_strict_stops_on_error(tmp_path: Path) -> None:
    ids_file = tmp_path / "video_ids.txt"
    out_dir = tmp_path / "raw"
    _write_ids_file(ids_file, ["fail_id", "ok_id"])

    called = []

    def fake_fetch(
        video_id: str,
        output: Path,
        fetch_backend: str = "ytdlp",
        youtube_proxy_url: str | None = None,
        default_audio_language_code: str = DEFAULT_AUDIO_LANGUAGE_CODE,
    ) -> None:
        called.append(video_id)
        assert default_audio_language_code == DEFAULT_AUDIO_LANGUAGE_CODE
        if video_id == "fail_id":
            raise typer.Exit(code=1)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("{}", encoding="utf-8")

    with patch("kcontext_cli.commands.fetch_list.fetch.fetch_subtitle", side_effect=fake_fetch):
        result = runner.invoke(
            app,
            [
                "fetch-list",
                str(ids_file),
                "-d",
                str(out_dir),
                "--strict",
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    assert called == ["fail_id"]
    assert not (out_dir / "ok_id_raw.json").exists()


def test_fetch_list_missing_file(tmp_path: Path) -> None:
    out_dir = tmp_path / "raw"
    result = runner.invoke(
        app,
        [
            "fetch-list",
            str(tmp_path / "missing_video_ids.txt"),
            "-d",
            str(out_dir),
            "--default-audio-language-code",
            DEFAULT_AUDIO_LANGUAGE_CODE,
        ],
    )
    assert result.exit_code == 1


def test_fetch_list_passes_proxy_to_fetch(tmp_path: Path) -> None:
    ids_file = tmp_path / "video_ids.txt"
    out_dir = tmp_path / "raw"
    _write_ids_file(ids_file, ["vid1"])
    captured_proxy_urls: list[str | None] = []

    def fake_fetch(
        video_id: str,
        output: Path,
        fetch_backend: str = "ytdlp",
        youtube_proxy_url: str | None = None,
        default_audio_language_code: str = DEFAULT_AUDIO_LANGUAGE_CODE,
    ) -> None:
        assert fetch_backend == "ytdlp"
        assert default_audio_language_code == DEFAULT_AUDIO_LANGUAGE_CODE
        captured_proxy_urls.append(youtube_proxy_url)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("{}", encoding="utf-8")

    with patch("kcontext_cli.commands.fetch_list.fetch.fetch_subtitle", side_effect=fake_fetch):
        result = runner.invoke(
            app,
            [
                "fetch-list",
                str(ids_file),
                "-d",
                str(out_dir),
                "--youtube-proxy-url",
                "http://127.0.0.1:8118",
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    assert captured_proxy_urls == ["http://127.0.0.1:8118"]


def test_fetch_list_passes_fetch_backend(tmp_path: Path) -> None:
    ids_file = tmp_path / "video_ids.txt"
    out_dir = tmp_path / "raw"
    _write_ids_file(ids_file, ["vid1"])
    captured_backends: list[str] = []

    def fake_fetch(
        video_id: str,
        output: Path,
        fetch_backend: str = "ytdlp",
        youtube_proxy_url: str | None = None,
        default_audio_language_code: str = DEFAULT_AUDIO_LANGUAGE_CODE,
    ) -> None:
        del video_id, youtube_proxy_url
        assert default_audio_language_code == DEFAULT_AUDIO_LANGUAGE_CODE
        captured_backends.append(fetch_backend)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("{}", encoding="utf-8")

    with patch("kcontext_cli.commands.fetch_list.fetch.fetch_subtitle", side_effect=fake_fetch):
        result = runner.invoke(
            app,
            [
                "fetch-list",
                str(ids_file),
                "-d",
                str(out_dir),
                "--fetch-backend",
                "decodo-scraper",
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    assert captured_backends == ["decodo-scraper"]
