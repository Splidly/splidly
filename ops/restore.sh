#!/bin/sh
set -eu
umask 077

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup.sql.gz|backup.sql.gz.age>" >&2
  exit 1
fi

backup_file="$1"
database_name="${POSTGRES_DB:-splidly}"
database_user="${POSTGRES_USER:-splidly}"

case "$backup_file" in
  *.age)
    age -d "$backup_file" | gunzip | docker compose exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U "$database_user" "$database_name"
    ;;
  *.gz)
    if [ "${ALLOW_PLAINTEXT_RESTORE:-}" != "1" ]; then
      echo "Refusing a plaintext backup; set ALLOW_PLAINTEXT_RESTORE=1 only for a trusted legacy file" >&2
      exit 1
    fi
    gunzip -c "$backup_file" | docker compose exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U "$database_user" "$database_name"
    ;;
  *)
    echo "Backup must end in .gz or .age" >&2
    exit 1
    ;;
esac
