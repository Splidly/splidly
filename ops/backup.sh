#!/bin/sh
set -eu

backup_directory="${BACKUP_DIRECTORY:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_name="${POSTGRES_DB:-splidly}"
database_user="${POSTGRES_USER:-splidly}"
mkdir -p "$backup_directory"

temporary_file="$backup_directory/splidly-$timestamp.sql.gz"
docker compose exec -T postgres pg_dump \
  --clean --if-exists --no-owner \
  -U "$database_user" "$database_name" | gzip -9 > "$temporary_file"

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  if ! command -v age >/dev/null 2>&1; then
    echo "BACKUP_AGE_RECIPIENT is set but age is not installed" >&2
    exit 1
  fi
  age -r "$BACKUP_AGE_RECIPIENT" "$temporary_file" > "$temporary_file.age"
  rm "$temporary_file"
  echo "Created encrypted backup $temporary_file.age"
else
  echo "Created $temporary_file (set BACKUP_AGE_RECIPIENT for encryption)"
fi

find "$backup_directory" -type f -name 'splidly-*' -mtime +7 -delete

