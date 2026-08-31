#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

backup_directory="${SPLIDLY_OFFSITE_BACKUP_DIRECTORY:?Set SPLIDLY_OFFSITE_BACKUP_DIRECTORY}"
ssh_target="${SPLIDLY_OFFSITE_SSH_TARGET:-server}"
lock_directory="$backup_directory/.sync.lock"

mkdir -p "$backup_directory"
if ! mkdir "$lock_directory" 2>/dev/null; then
  echo "An off-site backup sync is already running" >&2
  exit 0
fi
staging_directory="$(mktemp -d "$backup_directory/.sync.XXXXXX")"
cleanup() {
  rm -rf -- "$staging_directory" "$lock_directory"
}
trap cleanup EXIT HUP INT TERM

ssh -o BatchMode=yes "$ssh_target" \
  "sudo -n tar -C /var/backups/splidly -cf - ." \
  | tar -C "$staging_directory" -xf -

for snapshot in "$staging_directory"/splidly-????????T??????Z; do
  [[ -d "$snapshot" ]] || continue
  snapshot_name="$(basename "$snapshot")"
  (
    cd "$snapshot"
    shasum -a 256 -c SHA256SUMS >/dev/null
  )
  if [[ -e "$backup_directory/$snapshot_name" ]]; then
    rm -rf -- "$snapshot"
  else
    mv "$snapshot" "$backup_directory/$snapshot_name"
  fi
done

echo "Synchronized and validated encrypted Splidly backups."
