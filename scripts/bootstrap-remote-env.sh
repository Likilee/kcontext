#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="jtrgghhqjcudqnuxewoh"
OUTPUT_FILE=".env.remote-sync"

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --project-ref <ref>   Supabase project ref (default: jtrgghhqjcudqnuxewoh)
  --output <path>       Output env file path (default: .env.remote-sync)
  -h, --help            Show help

This script fetches anon/service_role API keys from Supabase CLI and writes
an env file used by scripts/run-remote-sync.sh.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-ref)
      PROJECT_REF="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI is required." >&2
  exit 1
fi

python3 - "$PROJECT_REF" "$OUTPUT_FILE" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

project_ref = sys.argv[1]
output_path = Path(sys.argv[2])
url = f"https://{project_ref}.supabase.co"

proc = subprocess.run(
    [
        "supabase",
        "projects",
        "api-keys",
        "list",
        "--project-ref",
        project_ref,
        "--output",
        "json",
    ],
    capture_output=True,
    text=True,
)
if proc.returncode != 0:
    print(proc.stderr.strip() or "Failed to list Supabase API keys.", file=sys.stderr)
    raise SystemExit(proc.returncode)

keys = json.loads(proc.stdout)
anon = next((k["api_key"] for k in keys if k.get("name") == "anon"), "")
service_role = next((k["api_key"] for k in keys if k.get("name") == "service_role"), "")

if not anon:
    print("Failed to resolve anon key from Supabase API response.", file=sys.stderr)
    raise SystemExit(1)
if not service_role:
    print("Failed to resolve service_role key from Supabase API response.", file=sys.stderr)
    raise SystemExit(1)

existing_db_url = ""
if output_path.exists():
    for line in output_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("REMOTE_DB_URL="):
            existing_db_url = line.split("=", 1)[1]
            break

pooler_template = f"postgresql://postgres.{project_ref}:SET_DB_PASSWORD_HERE@db.{project_ref}.supabase.co:5432/postgres?sslmode=require"
pooler_url_file = Path("supabase/.temp/pooler-url")
if pooler_url_file.exists():
    raw = pooler_url_file.read_text(encoding="utf-8").strip()
    if raw.startswith("postgresql://") and f"postgres.{project_ref}@" in raw:
        pooler_template = raw.replace(f"postgres.{project_ref}@", f"postgres.{project_ref}:SET_DB_PASSWORD_HERE@")

content = "\n".join(
    [
        "# Remote Supabase project metadata",
        f"REMOTE_PROJECT_REF={project_ref}",
        f"REMOTE_SUPABASE_URL={url}",
        "",
        "# Frontend runtime vars (Vercel)",
        f"NEXT_PUBLIC_SUPABASE_URL={url}",
        f"NEXT_PUBLIC_SUPABASE_ANON_KEY={anon}",
        f"NEXT_PUBLIC_CDN_URL={url}/storage/v1/object/public",
        "",
        "# Remote sync script vars",
        f"REMOTE_SUPABASE_SERVICE_ROLE_KEY={service_role}",
        f"REMOTE_DB_URL={existing_db_url}",
        f"# REMOTE_DB_URL template (pooler): {pooler_template}",
        "",
        "# Optional: local storage private fetch fallback",
        "# LOCAL_SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>",
        "",
        "# Optional: Supabase MCP",
        "# SUPABASE_MCP_ACCESS_TOKEN=<set-mcp-pat>",
        f"# SUPABASE_MCP_PROJECT_REF={project_ref}",
        "",
    ]
)

output_path.write_text(content, encoding="utf-8")
print(str(output_path))
PY

chmod 600 "$OUTPUT_FILE"
echo "Wrote $OUTPUT_FILE"
