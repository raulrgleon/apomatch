# Isolated deployment, rollback and recovery

**Preparation only. No DNET deployment or server modification was performed. Obtain separate owner authorization before executing these steps on DNET.**

## Docker

The Dockerfile has `runner` (non-root standalone app) and `migrations` (Prisma/operator tooling) targets. Development Compose creates a dedicated project network and named database volume; it does not attach to any existing application's network or volume. Host bindings are loopback only. Port numbers are examples: check for availability before starting a local stack. Never stop another project to free a port.

`docker compose up --build -d` waits for PostgreSQL health, runs migrations once and starts the app after successful completion. Run the optional seed once through the migration tooling container. Do not run tests against the production database.

## Coolify deployment plan after authorization

1. Create a new isolated ApoMatch project/environment and a new dedicated PostgreSQL 16 resource. Record the resource UUID, network and persistent volume. Do not select an existing database.
2. Select a reviewed immutable Git commit. Build the default Dockerfile runner target. Internal port is 3000; let the dedicated new application resource receive its route without changing existing route rules. Use a new hostname chosen by the owner.
3. Set DATABASE_URL as a secret, exact HTTPS APP_ORIGIN and a new SESSION_SECRET. AI_PROVIDER remains disabled. Never expose the database publicly.
4. Take a pre-migration backup. Build/run the `migrations` target as a one-off pre-deploy job against only the new database: `node node_modules/prisma/build/index.js migrate deploy`.
5. If desired, run `node --import tsx prisma/seed.ts` in the tooling container. Bootstrap the owner using `scripts/create-admin.ts` and temporary ADMIN_* environment variables; remove those variables afterward.
6. Configure `/api/health` as readiness. It performs a database SELECT; a database failure returns 503. TLS must terminate at the hosting proxy. Confirm secure cookies and HTTP→HTTPS redirect on the new route.
7. Run smoke tests: anonymous source/issue pages, login/logout, cross-role denial, independent review and a private group. Review logs without exporting secrets. Record the exact image/commit and migration IDs.
8. Schedule this project's retention cleanup, database backups and external monitoring only after approval. No integration is marked active until credentials and delivery checks succeed.

## Rollback

Keep the previous image digest and a pre-migration backup. Stop rollout when migration/health/smoke checks fail. For additive backward-compatible migrations, point the **ApoMatch** app to its previous image and recheck health. Prisma migrate deploy does not supply automatic destructive down migrations. If schema rollback is required, restore the backup into a **new** dedicated database, validate it, then switch only the ApoMatch DATABASE_URL. Preserve the failed database for investigation; never overwrite an unrelated or shared database.

## Backup

`scripts/backup.sh /absolute/new-file.dump` uses pg_dump custom format, restrictive permissions, archive listing and SHA-256. Supply DATABASE_URL through the environment. Use PostgreSQL client 16 or a compatible newer client. This is a logical backup, not an assertion that a restore has been tested. Backups must be encrypted before leaving the host and stored off-host with independently controlled deletion permissions.

Suggested pilot target: daily encrypted snapshots, seven daily and four weekly copies, independent off-host copy. RPO target 24h / RTO target 4h are **proposed**, not measured commitments. Measure on the actual environment before launch.

## Restore drill (new empty database only)

1. Verify the dump SHA-256 and list the archive.
2. Provision an empty isolated restoration database; use separate credentials and a connection URL naming it explicitly.
3. `PGDATABASE="$RESTORE_DATABASE_URL" pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" /absolute/backup.dump`.
4. Run `prisma migrate status`, check row counts/foreign keys and smoke-test the restored app in an isolated environment. Rotate session secret and invalidate sessions before any switch. Reapply deletions since the backup.
5. Record elapsed recovery time, source snapshot, checks and errors. Delete the drill environment only after reviewing evidence.

Avoid `--clean` against any live database. This repository has not executed a backup or restore on DNET.
