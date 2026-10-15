#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${DATABASE_URL:?Set DATABASE_URL in the environment}"
destination="${1:?Usage: backup.sh /absolute/new-backup.dump}"
[[ "$destination" = /* && ! -e "$destination" ]] || { echo 'Use a new absolute destination path.' >&2; exit 1; }
# Strip Prisma-only URL options; libpq rejects them. Never print the connection URI.
node - "$destination" <<'JS'
const {spawnSync}=require('node:child_process');
const url=new URL(process.env.DATABASE_URL);
for(const key of ['schema','connection_limit','pool_timeout','pgbouncer','statement_cache_size','socket_timeout','connect_timeout'])url.searchParams.delete(key);
const result=spawnSync('pg_dump',['--format=custom','--no-owner','--no-acl','--file='+process.argv[2]],{stdio:'inherit',env:{...process.env,PGDATABASE:url.toString()}});
if(result.error||result.status!==0)process.exit(1);
JS
pg_restore --list "$destination" >/dev/null
sha256sum "$destination" > "$destination.sha256"
echo 'Backup created and archive listing verified. A restore drill is still required.'
