"""Utilities for resolving and applying YouTube proxy settings."""

import os
from urllib.parse import quote, urlparse

from dotenv import load_dotenv

load_dotenv()

YOUTUBE_PROXY_ENV_VAR = "KCONTEXT_YOUTUBE_PROXY_URL"
YOUTUBE_PROXY_PROVIDER_ENV_VAR = "KCONTEXT_YOUTUBE_PROXY_PROVIDER"
GENERIC_PROXY_PROVIDER = "generic"
DECODO_PROXY_PROVIDER = "decodo"
DECODO_PROXY_SCHEME_ENV_VAR = "DECODO_PROXY_SCHEME"
DECODO_PROXY_HOST_ENV_VAR = "DECODO_PROXY_HOST"
DECODO_PROXY_PORT_ENV_VAR = "DECODO_PROXY_PORT"
DECODO_PROXY_USERNAME_ENV_VAR = "DECODO_PROXY_USERNAME"
DECODO_PROXY_PASSWORD_ENV_VAR = "DECODO_PROXY_PASSWORD"
YOUTUBE_PROXY_OPTION_HELP = (
    "HTTP/HTTPS proxy URL for YouTube requests. "
    "Use http://127.0.0.1:8118 for dperson/torproxy. "
    "Overrides KCONTEXT_YOUTUBE_PROXY_URL."
)


def resolve_youtube_proxy_url(cli_proxy_url: str | None) -> str | None:
    """Resolve proxy URL from CLI option first, then environment variable."""
    if cli_proxy_url is not None:
        proxy_url = cli_proxy_url.strip()
        if not proxy_url:
            return None
        _validate_proxy_url(proxy_url)
        return proxy_url

    raw_env_proxy_url = os.getenv(YOUTUBE_PROXY_ENV_VAR)
    if raw_env_proxy_url is not None:
        proxy_url = raw_env_proxy_url.strip()
        if not proxy_url:
            return None
        _validate_proxy_url(proxy_url)
        return proxy_url

    provider = (
        (os.getenv(YOUTUBE_PROXY_PROVIDER_ENV_VAR, GENERIC_PROXY_PROVIDER) or "").strip().lower()
    )
    if not provider or provider == GENERIC_PROXY_PROVIDER:
        return None

    if provider != DECODO_PROXY_PROVIDER:
        raise ValueError(
            f"Invalid YouTube proxy provider: {provider!r}. "
            f"Expected {GENERIC_PROXY_PROVIDER!r} or {DECODO_PROXY_PROVIDER!r}."
        )

    return _build_decodo_proxy_url()


def describe_proxy_target(proxy_url: str | None) -> str | None:
    """Return a redacted host:port representation for logs and summaries."""
    if proxy_url is None:
        return None

    parsed = urlparse(proxy_url)
    if parsed.hostname is None:
        return None
    if parsed.port is None:
        return parsed.hostname
    return f"{parsed.hostname}:{parsed.port}"


def classify_proxy_failure_message(message: str) -> str | None:
    """Classify common proxy and upstream failures for log parsing."""
    normalized = message.lower()

    if (
        "407" in normalized
        or "proxy authentication required" in normalized
        or "proxy auth" in normalized
        or "authentication failed" in normalized
        or "auth failed" in normalized
    ):
        return "proxy_auth_failed"

    if "youtube blocked" in normalized or "429" in normalized or "too many requests" in normalized:
        return "rate_limited"

    if (
        "connection refused" in normalized
        or "proxyconnect tcp" in normalized
        or "proxy connect" in normalized
        or "tunnel connection failed" in normalized
        or "timed out" in normalized
        or "name or service not known" in normalized
        or "temporary failure in name resolution" in normalized
        or "nodename nor servname provided" in normalized
        or "failed to establish a new connection" in normalized
        or "connection reset by peer" in normalized
        or "network is unreachable" in normalized
    ):
        return "proxy_unreachable"

    return None


def _build_decodo_proxy_url() -> str:
    scheme = os.getenv(DECODO_PROXY_SCHEME_ENV_VAR, "http").strip().lower()
    host = os.getenv(DECODO_PROXY_HOST_ENV_VAR, "").strip()
    port_raw = os.getenv(DECODO_PROXY_PORT_ENV_VAR, "").strip()
    username = os.getenv(DECODO_PROXY_USERNAME_ENV_VAR, "").strip()
    password = os.getenv(DECODO_PROXY_PASSWORD_ENV_VAR, "").strip()

    missing_fields: list[str] = []
    if not host:
        missing_fields.append(DECODO_PROXY_HOST_ENV_VAR)
    if not port_raw:
        missing_fields.append(DECODO_PROXY_PORT_ENV_VAR)
    if not username:
        missing_fields.append(DECODO_PROXY_USERNAME_ENV_VAR)
    if not password:
        missing_fields.append(DECODO_PROXY_PASSWORD_ENV_VAR)
    if missing_fields:
        raise ValueError(
            "Decodo proxy is selected but required environment variables are missing: "
            + ", ".join(missing_fields)
        )

    if scheme not in ("http", "https"):
        raise ValueError(
            f"Invalid Decodo proxy scheme: {scheme!r}. Only 'http' or 'https' are supported."
        )

    try:
        port = int(port_raw)
    except ValueError as exc:
        raise ValueError(f"Invalid Decodo proxy port: {port_raw!r}. Expected an integer.") from exc

    if port < 1 or port > 65535:
        raise ValueError(
            f"Invalid Decodo proxy port: {port_raw!r}. Expected a value between 1 and 65535."
        )

    proxy_url = f"{scheme}://{quote(username, safe='')}:{quote(password, safe='')}@{host}:{port}"
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
