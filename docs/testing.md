# Testing and evidence

## Commands

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.

Integration/browser tests require a **dedicated, migrated and seeded test database**. They create users with test prefixes and clean their accounts/reports/groups. They must never run on a live database. Browser tests exercise public discovery, EN/ES persistence, dark mode, report submission, private group invitations, account export/logout, administration, cross-tenant denial, hypothetical calculations, mobile overflow and automated axe WCAG checks.

GitHub Actions supplies native PostgreSQL 16 and separately builds the Docker image. Applying the migration twice checks idempotent deployment behavior. The browser job installs Chromium and attaches reports/screenshots on success or failure.

## Restricted workspace harness

If Docker/PostgreSQL cannot be started in a restricted development container, the optional `npm run verify:workspace -- --e2e` harness starts the actual PostgreSQL WASM engine (PGlite), exposes a loopback PostgreSQL protocol socket, applies Prisma migrations, seeds and invokes integration/browser tests in the same command network. It is **not a production backend** and does not establish equivalence with native PostgreSQL concurrency, authentication or durability.

Configure this harness's ignored `.env` with a development-only URL:

```text
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres?schema=public&connection_limit=1&pgbouncer=true&statement_cache_size=0
APP_ORIGIN=http://localhost:3000
SESSION_SECRET=<random-development-secret-at-least-32-characters>
AI_PROVIDER=disabled
```

Its `.workspace-db` directory is ignored by Git and Docker. The single PostgreSQL backend needs prepared-statement reset compatibility options; production PostgreSQL does not need them. If an installed compatible Chromium is available, set PLAYWRIGHT_CHROMIUM_EXECUTABLE. This only changes local browser launch, never application security settings.

## Evidence recording

See `docs/verification-results.md` for commands actually executed and their outcomes. Configured tests are not counted as passed until observed. Screenshots, when generated, are of the running application using explicit fictional data or public pilot sources, never unrelated personal data. Automated axe checks do not replace manual keyboard, screen-reader or legal accessibility review.
