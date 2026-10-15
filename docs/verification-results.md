# Verification record — accepted pilot build

Date: **2026-10-15**. Application code verified at commit **37097ecc2435b6b90e7afa877a2a53d963f0f090** on `feat/civic-platform`.

Accepted GitHub Actions run: [38790449489](https://github.com/raulrgleon/apomatch/actions/runs/38790449489). Both **quality** and **docker** jobs completed successfully. Earlier failing runs are retained as evidence of findings and corrections, not counted as passes.

| Check actually executed                                          | Result                                       |
| ---------------------------------------------------------------- | -------------------------------------------- |
| Prettier check                                                   | Passed                                       |
| ESLint, zero warnings                                            | Passed                                       |
| Strict TypeScript                                                | Passed                                       |
| Unit/component suite                                             | 21 passed                                    |
| Native PostgreSQL 16 migration, repeated deployment and seed     | Passed                                       |
| Native PostgreSQL API integration suite                          | 10 passed                                    |
| Optimized production build                                       | Passed                                       |
| Playwright Chromium desktop/mobile suite                         | 12 passed                                    |
| Automated axe WCAG checks on the public overview, desktop/mobile | No violations in tested view                 |
| Docker production image build                                    | Passed                                       |
| Local PostgreSQL WASM integration/browser fallback               | 10 integration and 12 browser tests passed   |
| Backup shell syntax                                              | Passed with `bash -n`; no live restore claim |

Integration coverage includes tenant/role denial, independent source verification, source correction conflicts, report moderation/evidence, private groups, invitation consumption, delayed private inbox reminders, rate limits, account export and account deletion.

Browser coverage includes city/ZIP lookup, EN/ES persistence, dark mode, official election source links, missing-candidate states, isolated fictional comparison, hypothetical calculations/invalid input, report submission, private groups, invitation generation, export/logout, admin navigation, cross-tenant denial and responsive overflow checks.

Real screenshots under `docs/screenshots` were inspected. They use an isolated fictional demo, not fabricated claims about Auburn. Source-date verification remains dated; re-running a seed does not renew it.

## Corrections made during validation

- Added a tracked public resource so Docker COPY succeeds in a fresh checkout.
- Darkened muted text to meet contrast checks on the light callout surface.
- Scoped the calculator error assertion to its actual message rather than Next.js's route announcer.
- Used a fresh browser context/process for each test only in the restricted local Chromium fallback; CI uses normal Playwright Chromium.
- Corrected source projections and made editorial writes/audits transactional.
- Patched the transitive deepmerge-ts advisory, revalidated Prisma migrations and added a production dependency-audit CI gate.

## Limits of this evidence

No DNET access or production deployment occurred. The live Ollama adapter, outbound email/push, image upload, billing, real jurisdiction boundary ingestion and a deployed backup/restore drill are not marked operational. Automated accessibility checks do not certify full WCAG compliance. The backup helper's connection-URL compatibility change is syntax-checked, and the CI stack separately exercised native pg_dump/pg_restore. The operator must still run an environment-specific encrypted backup and recovery drill before launch.
