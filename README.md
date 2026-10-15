# ApoMatch

Independent civic software for understanding local decisions throughout the year. First pilot: Auburn, Nemaha County, Nebraska. English is the default; the public interface also supports Spanish.

**Executable pilot v0.2, not a production launch.** PostgreSQL persistence, authenticated accounts, organization-scoped roles, editorial review, moderation and private groups are implemented. No candidate recommendations, political matching percentages, campaign profiling, voter-file imports or billing. See [implementation status](docs/implementation-status.md) for remaining work.

## Run locally

Requires Node.js 24, npm and PostgreSQL 16 (or Docker Compose).

```bash
npm ci
cp .env.example .env
```

Edit `.env`: set a unique database password, `DATABASE_URL`, `APP_ORIGIN` and a cryptographically random `SESSION_SECRET` of at least 32 characters. Never commit this file. The database password in a URL must be URL-encoded; a random URL-safe value is easiest.

```bash
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. Real pilot data is the default. `/?org=demo` uses a **separate fictional demonstration** with fake people, proposals and reports. ZIP search is location discovery, never district or polling-place determination.

For the complete container stack:

```bash
docker compose up --build -d
# Optional initial curated sources and fictional examples:
docker compose run --rm migrate node --import tsx prisma/seed.ts
```

No default accounts or administrator passwords exist. Follow [installation](docs/installation.md) to create the first administrator and add a separate verifier.

## Quality

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration  # dedicated seeded test database only
npm run build
npx playwright install chromium
npm run test:e2e         # dedicated test database only
```

GitHub Actions runs quality checks, native PostgreSQL migration/integration tests, desktop/mobile browser tests and a Docker build. Local restricted-container verification can use the optional PostgreSQL WASM harness described in [testing](docs/testing.md); it is not the production database.

## Documentation

- [Architecture and decisions](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Installation and environment](docs/installation.md)
- [API reference](docs/api.md)
- [Security, privacy and legal review](docs/security.md)
- [Pilot sources and verification gaps](docs/pilot-sources.md)
- [Coolify, rollback and recovery](docs/deployment.md)
- [Testing and evidence](docs/testing.md)
- [Implemented features and remaining work](docs/implementation-status.md)

No deployment to DNET is performed or authorized by this repository. Production deployment requires the owner's separate authorization.
