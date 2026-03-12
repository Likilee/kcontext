from pathlib import Path
from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()
DEFAULT_AUDIO_LANGUAGE_CODE = "ko"


def create_artifact_files(tmp_path: Path, video_id: str = "test_vid01") -> tuple[Path, Path, Path]:
    storage = tmp_path / f"{video_id}_storage.json"
    storage.write_text(
        '[{"start_time": 0.0, "duration": 2.5, "text": "안녕하세요"}]', encoding="utf-8"
    )

    video_csv = tmp_path / f"{video_id}_video.csv"
    video_csv.write_text(
        f"{video_id}\t테스트 제목\t테스트 채널\t2024-06-15T00:00:00Z\tko\n", encoding="utf-8"
    )

    subtitle_csv = tmp_path / f"{video_id}_subtitle.csv"
    subtitle_csv.write_text(f"{video_id}\t0.0\t안녕하세요\n", encoding="utf-8")

    return storage, video_csv, subtitle_csv


def create_db_mocks() -> tuple[MagicMock, MagicMock]:
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda _s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return mock_conn, mock_cursor


def test_push_uploads_storage_json(tmp_path: Path) -> None:
    storage, video_csv, subtitle_csv = create_artifact_files(tmp_path)

    mock_storage_bucket = MagicMock()
    mock_supabase = MagicMock()
    mock_supabase.storage.from_.return_value = mock_storage_bucket
    mock_conn, _ = create_db_mocks()

    with (
        patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
        patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
    ):
        result = runner.invoke(
            app,
            [
                "push",
                "-s",
                str(storage),
                "-vc",
                str(video_csv),
                "-sc",
                str(subtitle_csv),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    mock_supabase.storage.from_.assert_called_once_with("subtitles")
    mock_storage_bucket.upload.assert_called_once()
    upload_call = mock_storage_bucket.upload.call_args
    assert upload_call.kwargs["path"] == "test_vid01.json"
    assert upload_call.kwargs["file_options"] == {
        "content-type": "application/json",
        "upsert": "true",
    }


def test_push_upserts_video_metadata(tmp_path: Path) -> None:
    storage, video_csv, subtitle_csv = create_artifact_files(tmp_path)
    mock_supabase = MagicMock()
    mock_conn, mock_cursor = create_db_mocks()

    with (
        patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
        patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
    ):
        result = runner.invoke(
            app,
            [
                "push",
                "-s",
                str(storage),
                "-vc",
                str(video_csv),
                "-sc",
                str(subtitle_csv),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    executed_sqls = [str(call.args[0]) for call in mock_cursor.execute.call_args_list if call.args]
    assert any("INSERT INTO video" in sql and "ON CONFLICT" in sql for sql in executed_sqls)
    video_upsert_call = mock_cursor.execute.call_args_list[0]
    assert video_upsert_call.args[1][-1] == "ko"


def test_push_atomic_replace_subtitles(tmp_path: Path) -> None:
    storage, video_csv, subtitle_csv = create_artifact_files(tmp_path)
    mock_supabase = MagicMock()
    mock_conn, mock_cursor = create_db_mocks()

    with (
        patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
        patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
    ):
        result = runner.invoke(
            app,
            [
                "push",
                "-s",
                str(storage),
                "-vc",
                str(video_csv),
                "-sc",
                str(subtitle_csv),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    delete_calls = [
        call
        for call in mock_cursor.execute.call_args_list
        if "DELETE FROM subtitle" in str(call.args[0])
    ]
    assert len(delete_calls) == 1
    mock_cursor.copy_expert.assert_called_once()
    mock_conn.commit.assert_called_once()


def test_push_rollback_on_db_error(tmp_path: Path) -> None:
    import psycopg2 as pg2

    storage, video_csv, subtitle_csv = create_artifact_files(tmp_path)
    mock_supabase = MagicMock()
    mock_conn, mock_cursor = create_db_mocks()
    mock_cursor.execute.side_effect = pg2.Error("DB failure")

    with (
        patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
        patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
    ):
        result = runner.invoke(
            app,
            [
                "push",
                "-s",
                str(storage),
                "-vc",
                str(video_csv),
                "-sc",
                str(subtitle_csv),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 1
    mock_conn.rollback.assert_called_once()
    mock_conn.commit.assert_not_called()


def test_push_missing_files(tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        [
            "push",
            "-s",
            str(tmp_path / "missing_storage.json"),
            "-vc",
            str(tmp_path / "missing_video.csv"),
            "-sc",
            str(tmp_path / "missing_subtitle.csv"),
            "--default-audio-language-code",
            DEFAULT_AUDIO_LANGUAGE_CODE,
        ],
    )

    assert result.exit_code == 1


def test_push_storage_before_db(tmp_path: Path) -> None:
    storage, video_csv, subtitle_csv = create_artifact_files(tmp_path)
    call_order: list[str] = []

    mock_storage_bucket = MagicMock()

    def track_upload(**_kwargs: str) -> MagicMock:
        call_order.append("storage_upload")
        return MagicMock()

    mock_storage_bucket.upload.side_effect = track_upload

    mock_supabase = MagicMock()
    mock_supabase.storage.from_.return_value = mock_storage_bucket
    mock_conn, mock_cursor = create_db_mocks()

    def track_execute(_sql: str, *_args: object) -> None:
        call_order.append("db_execute")

    mock_cursor.execute.side_effect = track_execute

    with (
        patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
        patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
    ):
        result = runner.invoke(
            app,
            [
                "push",
                "-s",
                str(storage),
                "-vc",
                str(video_csv),
                "-sc",
                str(subtitle_csv),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    assert call_order[0] == "storage_upload"
    assert "db_execute" in call_order


def test_push_closes_connection_on_success(tmp_path: Path) -> None:
    storage, video_csv, subtitle_csv = create_artifact_files(tmp_path)
    mock_supabase = MagicMock()
    mock_conn, _ = create_db_mocks()

    with (
        patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
        patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
    ):
        result = runner.invoke(
            app,
            [
                "push",
                "-s",
                str(storage),
                "-vc",
                str(video_csv),
                "-sc",
                str(subtitle_csv),
                "--default-audio-language-code",
                DEFAULT_AUDIO_LANGUAGE_CODE,
            ],
        )

    assert result.exit_code == 0
    mock_conn.close.assert_called_once()


def test_push_uses_default_audio_language_code_for_legacy_video_csv(tmp_path: Path) -> None:
    video_id = "legacy_vid01"
    storage = tmp_path / f"{video_id}_storage.json"
    storage.write_text(
        '[{"start_time": 0.0, "duration": 2.5, "text": "안녕하세요"}]', encoding="utf-8"
    )
    video_csv = tmp_path / f"{video_id}_video.csv"
    video_csv.write_text(
        f"{video_id}\t테스트 제목\t테스트 채널\t2024-06-15T00:00:00Z\n",
        encoding="utf-8",
    )
    subtitle_csv = tmp_path / f"{video_id}_subtitle.csv"
    subtitle_csv.write_text(f"{video_id}\t0.0\t안녕하세요\n", encoding="utf-8")

    mock_supabase = MagicMock()
    mock_conn, mock_cursor = create_db_mocks()

    with (
        patch("kcontext_cli.commands.push.create_client", return_value=mock_supabase),
        patch("kcontext_cli.commands.push.psycopg2.connect", return_value=mock_conn),
    ):
        result = runner.invoke(
            app,
            [
                "push",
                "-s",
                str(storage),
                "-vc",
                str(video_csv),
                "-sc",
                str(subtitle_csv),
                "--default-audio-language-code",
                "ko-KR",
            ],
        )

    assert result.exit_code == 0
    video_upsert_call = mock_cursor.execute.call_args_list[0]
    assert video_upsert_call.args[1][-1] == "ko"
