# Verification record

Date: 2026-10-15. No DNET commands or production deployment were performed.

## Observed evidence

- Local production build, strict TypeScript and ESLint passed.
- 21 unit/component tests passed.
- Initial 8 integration tests passed locally against the PostgreSQL WASM engine and in GitHub Actions against native PostgreSQL 16.
- GitHub Actions run [38787742501](https://github.com/raulrgleon/apomatch/actions/runs/38787742501) completed migration twice, seed, integration tests and production build successfully. It found a missing tracked public directory in the Docker image and browser-test issues including a contrast ratio below 4.5. That run is recorded as **failed**, not accepted.
- The missing public asset directory, contrast, calculator error selector and restricted-workspace browser reuse have been corrected. Follow-up browser/native PostgreSQL/Docker validation is in progress.
- Additional integration coverage now checks source correction conflicts and private delayed reminders. These checks must pass before accepting this code revision.

Screenshots, when attached, come from the running app and clearly marked fictional demo data. An automated accessibility scan does not certify full WCAG conformance. Backups, restoration and Coolify deployment have not been exercised on the owner's server.
