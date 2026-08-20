#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

project_directory="${SPLIDLY_PROJECT_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)}"
backup_directory="${BACKUP_DIRECTORY:-$project_directory/backups}"
identity_file="${BACKUP_AGE_IDENTITY:-/etc/splidly/backup.agekey}"
lock_file="${BACKUP_LOCK_FILE:-/tmp/splidly-backup.lock}"
timestamp="${BACKUP_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"

for command in age age-keygen docker flock sha256sum tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required to create backups" >&2
    exit 1
  fi
done
if [[ ! -r "$identity_file" ]]; then
  echo "Backup identity is not readable: $identity_file" >&2
  exit 1
fi
if [[ ! -f "$project_directory/compose.yaml" || ! -f "$project_directory/.env" ]]; then
  echo "Production compose.yaml or .env is missing from $project_directory" >&2
  exit 1
fi

mkdir -p "$backup_directory" "$(dirname "$lock_file")"
backup_directory="$(cd "$backup_directory" && pwd -P)"
case "$backup_directory" in
  /|/var|/opt|/tmp|"$project_directory")
    echo "Refusing unsafe backup directory: $backup_directory" >&2
    exit 1
    ;;
esac

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Another Splidly backup is already running" >&2
  exit 0
fi

recipient="${BACKUP_AGE_RECIPIENT:-$(age-keygen -y "$identity_file")}"
if [[ -z "$recipient" ]]; then
  echo "Could not derive an age recipient from $identity_file" >&2
  exit 1
fi

snapshot_name="splidly-$timestamp"
staging_directory="$backup_directory/.$snapshot_name.tmp"
final_directory="$backup_directory/$snapshot_name"
if [[ -e "$staging_directory" || -e "$final_directory" ]]; then
  echo "Backup snapshot already exists for $timestamp" >&2
  exit 1
fi
mkdir -m 700 "$staging_directory"
cleanup() {
  rm -rf -- "$staging_directory"
}
trap cleanup EXIT HUP INT TERM

cd "$project_directory"
docker compose exec -T postgres sh -ec \
  'exec pg_dump --format=custom --compress=9 --clean --if-exists --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  | age -r "$recipient" -o "$staging_directory/database.dump.age"

create_config_archive() {
  if [[ -d /etc/splidly/secrets ]]; then
    tar -C "$project_directory" -cf - .env -C /etc/splidly secrets
  else
    tar -C "$project_directory" -cf - .env
  fi
}
create_config_archive \
  | age -r "$recipient" -o "$staging_directory/config.tar.age"

# A backup is published only after both encrypted streams can be decrypted and
# parsed. No plaintext database dump or configuration archive touches disk.
age -d -i "$identity_file" "$staging_directory/database.dump.age" \
  | docker compose exec -T postgres pg_restore --list >/dev/null
age -d -i "$identity_file" "$staging_directory/config.tar.age" \
  | tar -tf - >/dev/null

(
  cd "$staging_directory"
  sha256sum database.dump.age config.tar.age > SHA256SUMS
)
cat > "$staging_directory/README.txt" <<EOF
Created: $timestamp
Database: encrypted PostgreSQL custom-format dump
Configuration: encrypted .env and /etc/splidly/secrets when present
Frankfurter: excluded because its public exchange-rate cache is reconstructable
Restore with: BACKUP_AGE_IDENTITY=$identity_file ./ops/restore.sh $final_directory
EOF

mv "$staging_directory" "$final_directory"
trap - EXIT HUP INT TERM
echo "Created and validated encrypted backup $final_directory"

# Retention is applied only after a new snapshot succeeds. Restrict deletion to
# timestamped Splidly snapshot directories older than exactly seven days.
find "$backup_directory" -mindepth 1 -maxdepth 1 -type d \
  -name 'splidly-????????T??????Z' -mmin +10079 -print0 \
  | while IFS= read -r -d '' expired_snapshot; do
      rm -rf -- "$expired_snapshot"
      echo "Deleted expired backup $expired_snapshot"
    done
