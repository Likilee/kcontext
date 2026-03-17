"""Helpers for building searchable subtitle text."""

from __future__ import annotations

import re

BRACKET_NOTE_PATTERN = re.compile(r"\([^()]*\)|（[^（）]*）|\[[^\[\]]*\]|［[^［］]*］")
WHITESPACE_PATTERN = re.compile(r"\s+")


def normalize_search_text(text: str) -> str:
    """Remove non-spoken bracket notes and normalize whitespace for search."""
    text_without_notes = BRACKET_NOTE_PATTERN.sub(" ", text)
    return WHITESPACE_PATTERN.sub(" ", text_without_notes).strip()
