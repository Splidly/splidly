#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 <snapshot-directory|backup.dump.age|legacy.sql.gz.age>" >&2
  exit 1
fi

backup_path="$1"
identity_file="${BACKUP_AGE_IDENTITY:-/etc/splidly/backup.agekey}"
if [[ ! -r "$identity_file" ]]; then
  echo "Backup identity is not readable: $identity_file" >&2
  exit 1
fi
if [[ -d "$backup_path" ]]; then
  if ! (cd "$backup_path" && sha256sum --check SHA256SUMS); then
    echo "Backup integrity validation failed" >&2
    exit 1
  fi
  backup_path="$backup_path/database.dump.age"
fi

case "$backup_path" in
  *.dump.age)
    age -d -i "$identity_file" "$backup_path" \
      | docker compose exec -T postgres sh -ec \
          'exec pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
    ;;
  *.sql.gz.age)
    age -d -i "$identity_file" "$backup_path" | gunzip \
      | docker compose exec -T postgres sh -ec \
          'exec psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
    ;;
  *.sql.gz)
    if [[ "${ALLOW_PLAINTEXT_RESTORE:-}" != "1" ]]; then
      echo "Refusing a plaintext backup; set ALLOW_PLAINTEXT_RESTORE=1 only for a trusted legacy file" >&2
      exit 1
    fi
    gunzip -c "$backup_path" \
      | docker compose exec -T postgres sh -ec \
          'exec psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
    ;;
  *)
    echo "Unsupported backup. Use a snapshot directory, .dump.age, or legacy .sql.gz.age file." >&2
    exit 1
    ;;
esac
