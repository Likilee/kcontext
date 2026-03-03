"""Utilities for resolving and applying YouTube proxy settings."""

import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from youtube_transcript_api.proxies import GenericProxyConfig

load_dotenv()

YOUTUBE_PROXY_ENV_VAR = "KCONTEXT_YOUTUBE_PROXY_URL"
YOUTUBE_PROXY_OPTION_HELP = (
    "HTTP/HTTPS proxy URL for YouTube requests. "
    "Use http://127.0.0.1:8118 for dperson/torproxy. "
    "Overrides KCONTEXT_YOUTUBE_PROXY_URL."
)


def resolve_youtube_proxy_url(cli_proxy_url: str | None) -> str | None:
    """Resolve proxy URL from CLI option first, then environment variable."""
    raw_value = cli_proxy_url if cli_proxy_url is not None else os.getenv(YOUTUBE_PROXY_ENV_VAR)
    if raw_value is None:
        return None

    proxy_url = raw_value.strip()
    if not proxy_url:
        return None

    _validate_proxy_url(proxy_url)
    return proxy_url


def _validate_proxy_url(proxy_url: str) -> None:
    parsed = urlparse(proxy_url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(
            f"Invalid YouTube proxy URL: {proxy_url!r}. "
            "Only HTTP/HTTPS proxies are supported (use http://127.0.0.1:8118 for torproxy)."
        )
    if parsed.hostname is None or not parsed.netloc:
        raise ValueError(f"Invalid YouTube proxy URL: {proxy_url!r}.")


def build_ytdlp_proxy_args(proxy_url: str | None) -> list[str]:
    """Return yt-dlp proxy CLI args."""
    if proxy_url is None:
        return []
    return ["--proxy", proxy_url]


def build_ytt_proxy_config(proxy_url: str | None) -> GenericProxyConfig | None:
    """Return youtube-transcript-api proxy config."""
    if proxy_url is None:
        return None
    return GenericProxyConfig(http_url=proxy_url, https_url=proxy_url)
