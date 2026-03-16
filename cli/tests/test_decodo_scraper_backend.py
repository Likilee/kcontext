import pytest

from kcontext_cli.fetch_backends import decodo_scraper_backend
from kcontext_cli.fetch_backends.base import FetchBackendError
from kcontext_cli.network.decodo_scraper_api import DecodoScraperApiError, _classify_api_failure

MOCK_SUBTITLES_PAYLOAD = {
    "results": [
        {
            "content": {
                "auto_generated": {
                    "en": {
                        "events": [
                            {
                                "tStartMs": 0,
                                "dDurationMs": 1000,
                                "segs": [{"utf8": "auto"}],
                            }
                        ]
                    }
                },
                "uploader_provided": {
                    "ko": {
                        "events": [
                            {
                                "tStartMs": 0,
                                "dDurationMs": 1200,
                                "segs": [{"utf8": "안녕하세요"}],
                            },
                            {
                                "tStartMs": 1200,
                                "dDurationMs": 1300,
                                "segs": [{"utf8": "반갑습니다"}],
                            },
                        ]
                    }
                },
            }
        }
    ]
}

MOCK_METADATA_PAYLOAD = {
    "results": [
        {
            "content": {
                "results": {
                    "id": "test_abc123",
                    "title": "Decodo 제목",
                    "channel": "Decodo 채널",
                    "upload_date": "20240615",
                    "channel_id": "channel_123",
                    "uploader_id": "@decodo",
                    "uploader_url": "https://youtube.com/@decodo",
                    "duration": 222,
                    "description": "설명",
                    "categories": ["Education"],
                    "tags": ["tag1", "tag2"],
                    "thumbnails": [
                        {"url": "https://example.com/small.jpg"},
                        {"url": "https://example.com/large.jpg"},
                    ],
                }
            }
        }
    ]
}


def test_decodo_scraper_fetch_normalizes_payload(mocker) -> None:
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.resolve_decodo_scraper_api_config",
        return_value=object(),
    )
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.post_scrape_request",
        side_effect=[MOCK_SUBTITLES_PAYLOAD, MOCK_METADATA_PAYLOAD],
    )

    result = decodo_scraper_backend.fetch(
        "test_abc123",
        default_audio_language_code="ko",
    )

    assert result.metadata.video_id == "test_abc123"
    assert result.metadata.title == "Decodo 제목"
    assert result.metadata.channel_name == "Decodo 채널"
    assert result.metadata.published_at == "2024-06-15T00:00:00Z"
    assert result.metadata.channel_id == "channel_123"
    assert result.metadata.uploader_id == "@decodo"
    assert result.metadata.uploader_url == "https://youtube.com/@decodo"
    assert result.metadata.duration_sec == 222
    assert result.metadata.thumbnail_url == "https://example.com/large.jpg"
    assert result.metadata.description == "설명"
    assert result.metadata.categories == ["Education"]
    assert result.metadata.tags == ["tag1", "tag2"]
    assert result.metadata.source_backend == "decodo-scraper"
    assert len(result.transcript) == 2
    assert result.transcript[0]["text"] == "안녕하세요"


def test_decodo_scraper_requires_uploader_provided_ko(mocker) -> None:
    payload_without_manual_ko = {
        "results": [
            {
                "content": {
                    "auto_generated": {"ko": {"events": []}},
                    "uploader_provided": {"en": {"events": []}},
                }
            }
        ]
    }
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.resolve_decodo_scraper_api_config",
        return_value=object(),
    )
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.post_scrape_request",
        side_effect=[payload_without_manual_ko, MOCK_METADATA_PAYLOAD],
    )

    with pytest.raises(FetchBackendError, match="No manual Korean subtitle found"):
        decodo_scraper_backend.fetch(
            "test_abc123",
            default_audio_language_code="ko",
        )


def test_decodo_scraper_accepts_manual_ko_variant_key(mocker) -> None:
    payload_with_manual_ko_variant = {
        "results": [
            {
                "content": {
                    "uploader_provided": {
                        "ko-FmoQciUtYSc": {
                            "events": [
                                {
                                    "tStartMs": 0,
                                    "dDurationMs": 1200,
                                    "segs": [{"utf8": "제가 그렇게 불렀나요ㅋㅋㅋ"}],
                                }
                            ]
                        },
                        "en-FmoQciUtYSc": {"events": []},
                    }
                }
            }
        ]
    }
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.resolve_decodo_scraper_api_config",
        return_value=object(),
    )
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.post_scrape_request",
        side_effect=[payload_with_manual_ko_variant, MOCK_METADATA_PAYLOAD],
    )

    result = decodo_scraper_backend.fetch(
        "test_abc123",
        default_audio_language_code="ko",
    )

    assert result.transcript[0]["text"] == "제가 그렇게 불렀나요ㅋㅋㅋ"


def test_decodo_scraper_rejects_unexpected_metadata_shape(mocker) -> None:
    bad_metadata_payload = {"results": [{"content": {"results": []}}]}
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.resolve_decodo_scraper_api_config",
        return_value=object(),
    )
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.post_scrape_request",
        side_effect=[MOCK_SUBTITLES_PAYLOAD, bad_metadata_payload],
    )

    with pytest.raises(FetchBackendError, match="metadata response is missing results"):
        decodo_scraper_backend.fetch(
            "test_abc123",
            default_audio_language_code="ko",
        )


def test_decodo_scraper_surfaces_decodo_target_failure(mocker) -> None:
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.resolve_decodo_scraper_api_config",
        return_value=object(),
    )
    mocker.patch(
        "kcontext_cli.fetch_backends.decodo_scraper_backend.post_scrape_request",
        side_effect=DecodoScraperApiError(
            "We were not able to scrape the target. (status_code=613, task_id=7437926550256772097)",
            error_class="api_target_failed",
        ),
    )

    with pytest.raises(FetchBackendError) as exc_info:
        decodo_scraper_backend.fetch(
            "test_abc123",
            default_audio_language_code="ko",
        )

    assert exc_info.value.error_class == "api_target_failed"
    assert "status_code=613" in str(exc_info.value)
    assert "task_id=7437926550256772097" in str(exc_info.value)


def test_classify_api_failure_for_decodo_root_failed_status() -> None:
    payload = {
        "root": {
            "status": "failed",
            "status_code": 613,
            "message": "We were not able to scrape the target.",
            "task_id": "7437926550256772097",
        }
    }

    assert _classify_api_failure(payload) == "api_target_failed"


def test_classify_api_failure_for_decodo_top_level_failed_status() -> None:
    payload = {
        "status": "failed",
        "status_code": 613,
        "message": "We were not able to scrape the target.",
        "task_id": "7437926550256772097",
    }

    assert _classify_api_failure(payload) == "api_target_failed"
