"""Tests for YouTube proxy utilities."""

from unittest.mock import patch

import pytest

from kcontext_cli.network.proxy import (
    build_ytdlp_proxy_args,
    classify_proxy_failure_message,
    describe_proxy_target,
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


def test_resolve_proxy_uses_decodo_env_when_configured() -> None:
    with patch.dict(
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
    ):
        assert resolve_youtube_proxy_url(None) == "http://user-name:pa%3Ass@gate.decodo.local:10001"


def test_resolve_proxy_rejects_missing_decodo_env_fields() -> None:
    with (
        patch.dict(
            "os.environ",
            {
                "KCONTEXT_YOUTUBE_PROXY_PROVIDER": "decodo",
                "DECODO_PROXY_HOST": "gate.decodo.local",
                "DECODO_PROXY_PORT": "10001",
            },
            clear=True,
        ),
        pytest.raises(ValueError, match="DECODO_PROXY_USERNAME"),
    ):
        resolve_youtube_proxy_url(None)


def test_resolve_proxy_rejects_non_http_scheme() -> None:
    with pytest.raises(ValueError):
        resolve_youtube_proxy_url("socks5://127.0.0.1:9050")


def test_build_ytdlp_proxy_args() -> None:
    assert build_ytdlp_proxy_args(None) == []
    assert build_ytdlp_proxy_args("http://127.0.0.1:8118") == ["--proxy", "http://127.0.0.1:8118"]


def test_describe_proxy_target_redacts_credentials() -> None:
    assert (
        describe_proxy_target("http://user:password@proxy.example.com:10001")
        == "proxy.example.com:10001"
    )


def test_classify_proxy_failure_message() -> None:
    assert classify_proxy_failure_message("HTTP Error 429: Too Many Requests") == "rate_limited"
    assert (
        classify_proxy_failure_message("Proxy Authentication Required (407)") == "proxy_auth_failed"
    )
    assert (
        classify_proxy_failure_message("Connection refused by upstream proxy")
        == "proxy_unreachable"
    )
