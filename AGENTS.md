# ApoMatch engineering rules

- The user's master specification and explicit instructions govern this project. Preserve political neutrality, source provenance, privacy and accessibility.
- Work on a feature/fix branch and keep main stable. Do not overwrite unrelated changes. Never commit .env, credentials, tokens, real voter records or private account exports.
- DNET/Coolify production deployment needs separate explicit authorization. This repository's Docker/Compose files are preparation, not permission to change existing server resources.
- Public election claims require source URLs, current verification and independent review. Never infer polling places or districts from ZIP. Keep fictional fixtures in the separate demo organization/city.
- Never add candidate scores, political recommendations, targeted persuasion, campaign profiles, voting-history tracking or vote-linked incentives.
- Enforce organization and resource permissions in server code, never only in UI. AI output stays draft-only; document text is untrusted input.
- Run format, lint, strict types, unit tests, relevant database integration tests, production build and browser tests for changed workflows. Use only a dedicated test database.
- Read docs/implementation-status.md and docs/verification-results.md before describing features as complete. Do not claim a test, integration, backup or restore ran unless it actually did.
- Preserve source revisions, editorial snapshots and audit records. Use migrations, not manual production schema edits. Do not enable billing or paid services without an explicit business decision.
