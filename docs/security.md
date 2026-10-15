# Security, privacy and compliance review

## Implemented controls

- Parameterized Prisma queries, server-side Zod validation and a 64 KiB streamed request bound.
- Same-origin mutation checks, SameSite=Lax HttpOnly cookies, Secure cookies for HTTPS origins, seven-day hashed database sessions and immediate session revocation.
- Salted scrypt password hashes (versioned N=32768, r=8, p=3, bounded 64 MiB KDF memory); no default password, public administrator registration, JWT in localStorage or secret in the browser bundle.
- Organization-scoped role checks and resource-level group ownership/membership checks. Cross-tenant and unauthenticated access are tested. Global Super Admin powers are not inferred across organizations.
- Atomic database rate limits for authentication and user write operations. Unknown login accounts still trigger a password KDF. Authentication has both account-level and global caps.
- React text escaping; no rich HTML or external document execution. HTTPS-only source URLs reject embedded credentials. The server does not fetch user-supplied source URLs.
- Source verification and immutable historical snapshots, independent review, moderation and explicit evidence requirements. A generic official URL is not automatic proof: reviewers must verify the exact claim.
- Frame denial, CSP, nosniff, strict referrer policy, disabled browser device permissions and HSTS for HTTPS production origins.
- No image upload endpoint. Attachment storage schema exists but ingestion remains disabled until a private object store, file signature validation, image re-encoding, EXIF stripping, size controls and malware/quarantine workflow are configured.
- Logs contain event name, error class and correlation ID, never full request bodies, credentials or document text. Audit logs contain action/entity metadata. Public source projections omit internal creator metadata.

## Threats and remaining launch controls

Before a hosted public launch: independent security review, scrypt capacity benchmarking on the target hardware, breached-password screening, email verification/recovery, MFA for administrative accounts, edge read limits/WAF, monitoring/alerts, backups encrypted off-host and an actual restore drill. The CSP currently permits inline scripts/styles for Next.js; nonce-based strict CSP is a hardening task. Cookie security depends on correct HTTPS APP_ORIGIN; do not deploy with an HTTP public origin.

This pilot uses application-enforced tenant scopes, not PostgreSQL RLS. Database access belongs only to trusted application/operators. Tenant equality checks must accompany every new endpoint; multi-tenant adversarial tests are mandatory.

AI documents are untrusted input. The adapter uses fixed system instructions, explicit data boundaries, output schema validation, no tools/URL fetching and draft-only storage. These mitigate rather than solve prompt injection. An editor confirms personal data has been excluded before sending text to a configured provider. AI output has no direct publication path.

## Retention and user rights

`npm run db:cleanup` removes expired sessions, rate buckets and invitations, notifications older than 90 days and audit rows older than 365 days. Operators must schedule it daily within this project's environment. Source/editorial history remains for provenance; define a final legal retention policy before launch.

Authenticated account export omits password hashes and session/invitation tokens. Deletion requires the current password, deletes private owned groups, removes sessions and nulls public report authors/audit actors. Super Admin accounts must transfer administrative responsibility first. Public report text remains; moderation must exclude personal data. Backups retain data until their retention expires; restored databases need deletion requests replayed. Provide a public data-rights contact and appeal mechanism before launch.

Topic selections are local-only, not account fields. No affiliation, voting record, voter file, candidate preference, compatibility score, campaign audience export or political advertising profile exists. No analytics provider or external font service is enabled.

## Legal research — not a compliance certification

Consulted 2026-10-15:

- Nebraska Data Privacy Act, [official statutory text](https://nebraskalegislature.gov/laws/display_html.php?begin_section=87-1101&end_section=87-1130). Applicability, consumer-request processes, processor agreements, sensitive-data handling and small-business exceptions require counsel's assessment of the operating entity and actual processing. Export/delete buttons alone do not establish compliance.
- Nebraska voter-file restrictions: [Secretary of State guidance](https://sos.nebraska.gov/elections/voter-file-requests) and [§32-330](https://nebraskalegislature.gov/laws/statutes.php?statute=32-330). No voter-file importer is implemented. Such files must not be treated as an available commercial or Internet dataset.
- Accessibility: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) AA is the engineering target. Automated axe checks plus manual keyboard/mobile inspection do not constitute a legal or accessibility certification. Government procurement may impose additional requirements.
- Election content: the operator must review official source reuse terms, attribution, ballot/candidate completeness, corrections, disclaimers and applicable federal/state coordination rules before enabling production integrations. No eligibility determinations, candidate endorsements, rewards for voting or coercive tracking are implemented.

No finding here authorizes a public deployment or asserts that all relevant laws have been satisfied.

## Dependency audit evidence

On 2026-10-15, the production dependency audit reported zero known vulnerabilities after a targeted deepmerge-ts patch. The accepted CI run rechecked the audit and Prisma migration compatibility. This is a dated advisory-database result, not a claim that the application has no security defects.
