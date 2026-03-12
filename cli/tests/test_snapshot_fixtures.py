from __future__ import annotations

import io
import json
import pathlib  # noqa: TC003
from urllib.error import HTTPError

from typer.testing import CliRunner

from kcontext_cli.main import app

runner = CliRunner()


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False


def _fake_json_response(payload: object) -> _FakeResponse:
    return _FakeResponse(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def test_snapshot_fixtures_writes_raw_fixture(tmp_path: pathlib.Path, monkeypatch) -> None:
    env_file = tmp_path / ".env.remote"
    env_file.write_text(
        "\n".join(
            [
                "REMOTE_SUPABASE_URL=https://example.supabase.co",
                "REMOTE_SUPABASE_SERVICE_ROLE_KEY=test-service-role",
            ]
        ),
        encoding="utf-8",
    )

    responses = [
        _fake_json_response(
            [
                {
                    "id": "abc123xyz89",
                    "title": "실전 뉴스",
                    "channel_name": "테스트 채널",
                    "published_at": "2026-03-10T00:00:00+00:00",
                    "audio_language_code": "ko",
                }
            ]
        ),
        _fake_json_response(
            [
                {
                    "start_time": 0.0,
                    "duration": 1.5,
                    "text": "전분당 담합 의혹입니다",
                }
            ]
        ),
    ]

    def fake_urlopen(req, timeout=30):  # noqa: ANN001
        del timeout
        assert req.full_url in {
            "https://example.supabase.co/rest/v1/video?id=eq.abc123xyz89&select=id,title,channel_name,published_at,audio_language_code",
            "https://example.supabase.co/storage/v1/object/public/subtitles/abc123xyz89.json",
        }
        return responses.pop(0)

    monkeypatch.setattr("kcontext_cli.commands.snapshot_fixtures.request.urlopen", fake_urlopen)

    result = runner.invoke(
        app,
        [
            "snapshot-fixtures",
            "--env-file",
            str(env_file),
            "--dir",
            str(tmp_path),
            "--video-id",
            "abc123xyz89",
            "--default-audio-language-code",
            "ko",
        ],
    )

    assert result.exit_code == 0
    fixture = json.loads((tmp_path / "abc123xyz89_raw.json").read_text(encoding="utf-8"))
    assert fixture == {
        "video_id": "abc123xyz89",
        "title": "실전 뉴스",
        "channel_name": "테스트 채널",
        "published_at": "2026-03-10T00:00:00+00:00",
        "audio_language_code": "ko",
        "transcript": [
            {
                "start": 0.0,
                "duration": 1.5,
                "text": "전분당 담합 의혹입니다",
            }
        ],
    }


def test_snapshot_fixtures_prunes_unrequested_raw_files(
    tmp_path: pathlib.Path, monkeypatch
) -> None:
    env_file = tmp_path / ".env.remote"
    env_file.write_text(
        "\n".join(
            [
                "REMOTE_SUPABASE_URL=https://example.supabase.co",
                "REMOTE_SUPABASE_SERVICE_ROLE_KEY=test-service-role",
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "oldvideo0001_raw.json").write_text("{}", encoding="utf-8")

    responses = [
        _fake_json_response(
            [
                {
                    "id": "newvideo0011",
                    "title": "새 영상",
                    "channel_name": "테스트 채널",
                    "published_at": "2026-03-11T00:00:00+00:00",
                    "audio_language_code": "ko",
                }
            ]
        ),
        _fake_json_response([]),
    ]

    monkeypatch.setattr(
        "kcontext_cli.commands.snapshot_fixtures.request.urlopen",
        lambda req, timeout=30: responses.pop(0),
    )

    result = runner.invoke(
        app,
        [
            "snapshot-fixtures",
            "--env-file",
            str(env_file),
            "--dir",
            str(tmp_path),
            "--video-id",
            "newvideo0011",
            "--default-audio-language-code",
            "ko",
            "--prune-existing",
        ],
    )

    assert result.exit_code == 0
    assert not (tmp_path / "oldvideo0001_raw.json").exists()
    assert (tmp_path / "newvideo0011_raw.json").exists()


def test_snapshot_fixtures_reports_http_error(tmp_path: pathlib.Path, monkeypatch) -> None:
    env_file = tmp_path / ".env.remote"
    env_file.write_text(
        "\n".join(
            [
                "REMOTE_SUPABASE_URL=https://example.supabase.co",
                "REMOTE_SUPABASE_SERVICE_ROLE_KEY=test-service-role",
            ]
        ),
        encoding="utf-8",
    )

    def fake_urlopen(req, timeout=30):  # noqa: ANN001
        del req, timeout
        raise HTTPError(
            url="https://example.supabase.co/rest/v1/video",
            code=404,
            msg="Not Found",
            hdrs=None,
            fp=None,
        )

    monkeypatch.setattr("kcontext_cli.commands.snapshot_fixtures.request.urlopen", fake_urlopen)

    result = runner.invoke(
        app,
        [
            "snapshot-fixtures",
            "--env-file",
            str(env_file),
            "--dir",
            str(tmp_path),
            "--video-id",
            "missingid001",
            "--default-audio-language-code",
            "ko",
        ],
    )

    assert result.exit_code == 1
    assert "HTTP 404" in result.output
