"""Tests for YouTube proxy utilities."""

from unittest.mock import patch

import pytest

from kcontext_cli.network.proxy import (
    build_ytdlp_proxy_args,
    build_ytt_proxy_config,
    resolve_youtube_proxy_url,
)


def test_resolve_proxy_prefers_cli_value() -> None:
    with patch.dict(
        "os.environ",
        {"KCONTEXT_YOUTUBE_PROXY_URL": "http://env-proxy:8118"},
        clear=False,
    ):
        assert resolve_youtube_proxy_url("http://cli-proxy:8118") == "http://cli-proxy:8118"


def test_resolve_proxy_uses_env_when_cli_missing() -> None:
    with patch.dict(
        "os.environ",
        {"KCONTEXT_YOUTUBE_PROXY_URL": "http://env-proxy:8118"},
        clear=False,
    ):
        assert resolve_youtube_proxy_url(None) == "http://env-proxy:8118"


def test_resolve_proxy_rejects_non_http_scheme() -> None:
    with pytest.raises(ValueError):
        resolve_youtube_proxy_url("socks5://127.0.0.1:9050")


def test_build_ytdlp_proxy_args() -> None:
    assert build_ytdlp_proxy_args(None) == []
    assert build_ytdlp_proxy_args("http://127.0.0.1:8118") == ["--proxy", "http://127.0.0.1:8118"]


def test_build_ytt_proxy_config() -> None:
    proxy_config = build_ytt_proxy_config("http://127.0.0.1:8118")
    assert proxy_config is not None
    assert proxy_config.to_requests_dict() == {
        "http": "http://127.0.0.1:8118",
        "https": "http://127.0.0.1:8118",
    }
