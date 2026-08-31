#!/usr/bin/env bash
set -Eeuo pipefail

backup_directory="${BACKUP_DIRECTORY:-/var/backups/splidly}"
identity_file="${BACKUP_AGE_IDENTITY:-/etc/splidly/backup.agekey}"
restore_container="splidly-restore-verification"

latest_snapshot="$({
  find "$backup_directory" -mindepth 1 -maxdepth 1 -type d \
    -name 'splidly-????????T??????Z' -printf '%f\n'
} | sort | tail -1)"
if [[ -z "$latest_snapshot" ]]; then
  echo "No backup snapshot found" >&2
  exit 1
fi

(
  cd "$backup_directory/$latest_snapshot"
  sha256sum --check SHA256SUMS
)

if docker container inspect "$restore_container" >/dev/null 2>&1; then
  echo "Refusing to reuse existing restore container: $restore_container" >&2
  exit 1
fi
docker run -d --name "$restore_container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.10-alpine3.24 >/dev/null
cleanup() {
  docker rm -f "$restore_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

for _attempt in $(seq 1 30); do
  if docker exec "$restore_container" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$restore_container" pg_isready -U postgres >/dev/null

age -d -i "$identity_file" "$backup_directory/$latest_snapshot/database.dump.age" \
  | docker exec -i "$restore_container" pg_restore \
      --clean --if-exists --no-owner --no-acl --exit-on-error \
      --username=postgres --dbname=postgres

restored_tables="$(
  docker exec "$restore_container" psql -U postgres -d postgres -Atqc \
    "select count(*) from pg_tables where schemaname = 'public'"
)"
if [[ "$restored_tables" -lt 1 ]]; then
  echo "Restore produced no application tables" >&2
  exit 1
fi

echo "Backup $latest_snapshot passed checksum and isolated restore verification with $restored_tables tables."
