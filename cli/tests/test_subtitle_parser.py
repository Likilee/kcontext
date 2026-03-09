"""Tests for the subtitle json3 parser."""

from kcontext_cli.subtitle.parser import parse_json3_to_chunks


def test_parse_basic_events() -> None:
    json3 = {
        "events": [
            {"tStartMs": 1958, "dDurationMs": 375, "segs": [{"utf8": "할까?"}]},
            {"tStartMs": 2333, "dDurationMs": 958, "segs": [{"utf8": "저번 주에도 했잖아!"}]},
        ]
    }
    result = parse_json3_to_chunks(json3)
    assert len(result) == 2
    assert result[0] == {"start": 1.958, "duration": 0.375, "text": "할까?"}
    assert result[1] == {"start": 2.333, "duration": 0.958, "text": "저번 주에도 했잖아!"}


def test_parse_filters_empty_events() -> None:
    json3 = {
        "events": [
            {"tStartMs": 0, "dDurationMs": 0},
            {"tStartMs": 1000, "dDurationMs": 500, "segs": [{"utf8": "텍스트"}]},
            {"tStartMs": 2000, "dDurationMs": 300, "segs": []},
        ]
    }
    result = parse_json3_to_chunks(json3)
    assert len(result) == 1
    assert result[0]["text"] == "텍스트"


def test_parse_filters_whitespace_only_events() -> None:
    json3 = {
        "events": [
            {"tStartMs": 0, "dDurationMs": 100, "segs": [{"utf8": "  \n  "}]},
            {"tStartMs": 1000, "dDurationMs": 500, "segs": [{"utf8": "실제 텍스트"}]},
        ]
    }
    result = parse_json3_to_chunks(json3)
    assert len(result) == 1
    assert result[0]["text"] == "실제 텍스트"


def test_parse_joins_multiple_segs() -> None:
    json3 = {
        "events": [
            {
                "tStartMs": 5000,
                "dDurationMs": 2000,
                "segs": [
                    {"utf8": "여러 "},
                    {"utf8": "세그먼트를 "},
                    {"utf8": "합칩니다"},
                ],
            },
        ]
    }
    result = parse_json3_to_chunks(json3)
    assert len(result) == 1
    assert result[0]["text"] == "여러 세그먼트를 합칩니다"


def test_parse_empty_events_list() -> None:
    assert parse_json3_to_chunks({"events": []}) == []


def test_parse_no_events_key() -> None:
    assert parse_json3_to_chunks({}) == []


def test_parse_rounding() -> None:
    json3 = {
        "events": [
            {"tStartMs": 1, "dDurationMs": 1, "segs": [{"utf8": "a"}]},
        ]
    }
    result = parse_json3_to_chunks(json3)
    assert result[0]["start"] == 0.001
    assert result[0]["duration"] == 0.001
