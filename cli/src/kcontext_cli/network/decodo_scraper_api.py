"""HTTP client for Decodo Web Scraping API."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

DECODO_SCRAPER_API_URL_ENV_VAR = "DECODO_SCRAPER_API_URL"
DECODO_SCRAPER_API_BASIC_TOKEN_ENV_VAR = "DECODO_SCRAPER_API_BASIC_TOKEN"
DEFAULT_DECODO_SCRAPER_API_URL = "https://scraper-api.decodo.com/v2/scrape"


class DecodoScraperApiError(Exception):
    """Raised when the Decodo scraper API request or response fails."""

    def __init__(self, message: str, *, error_class: str) -> None:
        super().__init__(message)
        self.message = message
        self.error_class = error_class


@dataclass(frozen=True)
class DecodoScraperApiConfig:
    api_url: str
    basic_token: str


def resolve_decodo_scraper_api_config() -> DecodoScraperApiConfig:
    api_url = os.getenv(DECODO_SCRAPER_API_URL_ENV_VAR, DEFAULT_DECODO_SCRAPER_API_URL).strip()
    basic_token = os.getenv(DECODO_SCRAPER_API_BASIC_TOKEN_ENV_VAR, "").strip()
    if not basic_token:
        raise ValueError(
            "Decodo scraper backend requires DECODO_SCRAPER_API_BASIC_TOKEN to be set."
        )
    if not api_url:
        raise ValueError("Decodo scraper backend requires a non-empty API URL.")
    return DecodoScraperApiConfig(api_url=api_url, basic_token=basic_token)


def post_scrape_request(
    *,
    config: DecodoScraperApiConfig,
    target: str,
    query: str,
) -> dict:
    payload = {"target": target, "query": query}
    request = urllib.request.Request(
        config.api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Authorization": f"Basic {config.basic_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise DecodoScraperApiError(
            body or str(err),
            error_class=_classify_http_error(err.code, body),
        ) from err
    except (urllib.error.URLError, TimeoutError) as err:
        raise DecodoScraperApiError(str(err), error_class="api_unreachable") from err

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as err:
        raise DecodoScraperApiError(
            f"Failed to parse Decodo API response: {err}",
            error_class="api_unexpected_schema",
        ) from err

    return parsed


def _classify_http_error(status_code: int, body: str) -> str:
    normalized = body.lower()
    if status_code in (401, 403, 407):
        return "api_auth_failed"
    if status_code == 429:
        return "api_rate_limited"
    if status_code == 402:
        return "api_budget_exhausted"
    if (
        "quota" in normalized
        or "budget" in normalized
        or "traffic" in normalized
        or "balance" in normalized
        or "subscription" in normalized
        or "upgrade" in normalized
        or "payment" in normalized
    ):
        return "api_budget_exhausted"
    return "api_unexpected_schema"
