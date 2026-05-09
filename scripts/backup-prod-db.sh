#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAIETEK_APP_DIR:-/opt/apps/maietek}"
ENV_FILE="${MAIETEK_ENV_FILE:-$APP_DIR/.env}"
BACKUP_DIR="${MAIETEK_BACKUP_DIR:-/opt/backups/maietek}"
RETENTION_DAYS="${MAIETEK_BACKUP_RETENTION_DAYS:-14}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is missing. Install it on the VPS with: sudo apt install -y postgresql-client" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"

if [[ -z "$DB_URL" ]]; then
  echo "Missing SUPABASE_DB_URL, DATABASE_URL, or POSTGRES_URL in environment or $ENV_FILE." >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="maietek-${timestamp}.dump"
tmp_file="$BACKUP_DIR/.${backup_name}.tmp"
backup_file="$BACKUP_DIR/$backup_name"

cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$tmp_file" \
  "$DB_URL"

mv "$tmp_file" "$backup_file"
chmod 600 "$backup_file"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && sha256sum "$backup_name" > "$backup_name.sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && shasum -a 256 "$backup_name" > "$backup_name.sha256")
fi

find "$BACKUP_DIR" -type f \
  \( -name "maietek-*.dump" -o -name "maietek-*.dump.sha256" \) \
  -mtime +"$RETENTION_DAYS" \
  -delete

echo "Backup created: $backup_file"
