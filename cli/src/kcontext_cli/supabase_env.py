"""Helpers for resolving local Supabase credentials for CLI commands."""

from __future__ import annotations

import os

LOCAL_SUPABASE_SERVICE_ROLE_ENV_VARS = (
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
)


def resolve_local_supabase_service_role_key() -> str:
    """Return the local Supabase service role key from supported env var names."""
    for env_var in LOCAL_SUPABASE_SERVICE_ROLE_ENV_VARS:
        value = str(os.getenv(env_var, "")).strip()
        if value and not value.startswith("<"):
            return value

    raise ValueError(
        "Missing required environment variable: SUPABASE_SECRET_KEY or "
        "SUPABASE_SERVICE_ROLE_KEY"
    )
