#!/bin/sh
set -eu
umask 077

backup_directory="${BACKUP_DIRECTORY:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_name="${POSTGRES_DB:-splidly}"
database_user="${POSTGRES_USER:-splidly}"
if [ -z "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo "BACKUP_AGE_RECIPIENT is required; refusing to create a plaintext backup" >&2
  exit 1
fi
if ! command -v age >/dev/null 2>&1; then
  echo "age is required to create encrypted backups" >&2
  exit 1
fi

mkdir -p "$backup_directory"
temporary_file="$backup_directory/.splidly-$timestamp.sql.gz.tmp"
final_file="$backup_directory/splidly-$timestamp.sql.gz.age"
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM
docker compose exec -T postgres pg_dump \
  --clean --if-exists --no-owner \
  -U "$database_user" "$database_name" | gzip -9 > "$temporary_file"

age -r "$BACKUP_AGE_RECIPIENT" "$temporary_file" > "$final_file"
rm -f "$temporary_file"
trap - EXIT HUP INT TERM
echo "Created encrypted backup $final_file"

find "$backup_directory" -type f -name 'splidly-*' -mtime +7 -delete
