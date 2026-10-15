#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${DATABASE_URL:?Set DATABASE_URL in the environment}"
destination="${1:?Usage: backup.sh /absolute/new-backup.dump}"
[[ "$destination" = /* && ! -e "$destination" ]] || { echo 'Use a new absolute destination path.' >&2; exit 1; }
# pg_dump reads credentials through the environment, not a command-line argument.
export PGDATABASE="$DATABASE_URL"
pg_dump --format=custom --no-owner --no-acl --file="$destination"
pg_restore --list "$destination" >/dev/null
sha256sum "$destination" > "$destination.sha256"
echo 'Backup created and archive listing verified. A restore drill is still required.'
