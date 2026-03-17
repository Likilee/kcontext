"""Helpers for resolving audio language codes across CLI commands."""

from __future__ import annotations

AUDIO_LANGUAGE_CODE_OPTION_HELP = (
    "Fallback audio language code to use when source metadata or legacy artifacts omit it."
)


def normalize_audio_language_code(value: object) -> str:
    """Normalize a language tag to its primary subtag."""
    text = str(value or "").strip().lower().replace("_", "-")
    if not text:
        return ""
    return text.split("-", maxsplit=1)[0] or ""


def resolve_audio_language_code(
    value: object,
    *,
    default_audio_language_code: str,
) -> str:
    """Return a normalized language code, falling back to a required default."""
    normalized_default = normalize_audio_language_code(default_audio_language_code)
    if not normalized_default:
        raise ValueError("default_audio_language_code must not be empty")

    normalized_value = normalize_audio_language_code(value)
    return normalized_value or normalized_default
