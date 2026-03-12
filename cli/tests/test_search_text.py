import pytest

from kcontext_cli.subtitle.search_text import normalize_search_text


@pytest.mark.parametrize(
    ("raw_text", "expected"),
    [
        ("(배고프다) 뭐 먹을래?", "뭐 먹을래?"),
        ("[웃음]", ""),
        ("（한숨）", ""),
        ("［박수］", ""),
        ("안녕 [속마음] 하고 있어", "안녕 하고 있어"),
        ("안녕   (속마음)\t 하고 있어", "안녕 하고 있어"),
        ("(하품) [웃음] 진짜 졸리다", "진짜 졸리다"),
        ("닫히지 않은 (메모", "닫히지 않은 (메모"),
    ],
)
def test_normalize_search_text(raw_text: str, expected: str) -> None:
    assert normalize_search_text(raw_text) == expected
