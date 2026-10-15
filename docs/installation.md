# Installation and environment

## Requirements

Node.js 24, npm, PostgreSQL 16. Docker/Compose is the recommended reproducible database environment. Use a separate database for automated tests: integration/browser tests create and delete test-only accounts and reports.

1. Clone the repository and check out `feat/civic-platform` (or a reviewed release commit).
2. `npm ci` and `cp .env.example .env`.
3. Set the variables below; do not reuse the example placeholders.
4. `docker compose up -d db` (or provision a dedicated PostgreSQL database).
5. `npm run db:generate && npm run db:migrate && npm run db:seed`.
6. `npm run dev` for development, or `npm run build && npm run start` for a local production build.
7. Open http://localhost:3000. Change `APP_ORIGIN` if accessing through another origin; mutation requests require an exact origin match.

| Variable                                | Required       | Purpose                                                                    |
| --------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| DATABASE_URL                            | Yes            | PostgreSQL URL, app-specific database and credentials                      |
| APP_ORIGIN                              | Yes            | Exact external origin; HTTPS in hosted production                          |
| SESSION_SECRET                          | Yes            | Random ≥32 characters; rotating invalidates sessions/invitations           |
| POSTGRES_PASSWORD                       | Compose        | Strong URL-safe database password; match DATABASE_URL for host development |
| NEXT_TELEMETRY_DISABLED                 | Recommended    | `1` disables build/framework telemetry                                     |
| AI_PROVIDER                             | Optional       | `disabled` (default) or `ollama`                                           |
| OLLAMA_URL                              | Optional       | Trusted operator-configured Ollama origin, private network only            |
| OLLAMA_MODEL                            | Optional       | Installed model name, default `llama3.1:8b`                                |
| ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD | Bootstrap only | First operator-created administrator; password ≥16 characters              |
| ADMIN_ORG                               | Bootstrap only | `apomatch` or `demo`; default `apomatch`                                   |

Generate a session secret locally: `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Put it in `.env` or a secret manager, never in GitHub.

## Bootstrap and roles

No seeded passwords or privileged accounts. On a trusted terminal, supply ADMIN_* variables to `npm run admin:create`. Use a password manager or hidden terminal input; do not paste credentials into a public issue or commit.

Example without embedding the actual password in shell history:

```bash
export ADMIN_EMAIL='owner@example.org'
export ADMIN_NAME='Platform administrator'
read -rsp 'New administrator password: ' ADMIN_PASSWORD
export ADMIN_PASSWORD
npm run admin:create
unset ADMIN_PASSWORD
```

The account must be new; the command refuses to overwrite an existing user. Register a second account through the app, then assign `verifier` in Administration → Users & roles. Editors create content; a different verifier approves it. Even a Super Admin cannot verify content they authored. Moderators manage report publication and evidence-backed status transitions. Permissions are always rechecked server-side.

## Curated seed

The seed is idempotent and does not overwrite edited real records. No real candidates or voter records are seeded. Real source verification is dated 2026-10-15 and must be renewed after 90 days. Re-running the seed must not pretend the official sources were checked again.

## Restricted workspace fallback

See `docs/testing.md` for `npm run verify:workspace`. The optional PGlite harness is for development only and is not a substitute for the native PostgreSQL/Docker checks in CI.
