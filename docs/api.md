# API reference

All endpoints are `/api/...`, JSON except account export downloads. Responses have `Cache-Control: no-store`. Organization selector is `?org=apomatch` (default) or `?org=demo`; it never grants access. Non-GET methods require `Origin` equal to `APP_ORIGIN`, `application/json` when a body is present, and a maximum streamed body of 64 KiB. Authentication is an HttpOnly session cookie.

| Method / path                                            | Authorization           | Function                                                                          |
| -------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| GET health                                               | Public                  | Database readiness, app version; 503 on failure                                   |
| GET locations?q=...                                      | Public                  | Supported city/ZIP discovery, canonical jurisdictions                             |
| GET sources?page=1                                       | Public                  | Fresh verified sources, 20 per page                                               |
| GET elections?city=...                                   | Public                  | Verified election, office, candidacy and proposal projections                     |
| GET issues?city=...&q=...&category=...&status=...&page=1 | Public                  | Published report search; 12 per page                                              |
| GET issues/:id                                           | Public                  | Published report details and documented timeline; no author ID                    |
| POST issues                                              | User                    | Create unpublished report and moderation inbox receipt                            |
| POST calculate                                           | Public                  | Validate and evaluate hypothetical property-tax model                             |
| POST auth/register                                       | Public, limited         | Email, password ≥12 chars, display name; no role assignment                       |
| POST auth/login                                          | Public, limited         | Opaque seven-day database session                                                 |
| GET auth/me                                              | Public                  | Safe current account and role projection                                          |
| POST auth/logout                                         | Session if present      | Revoke current session and clear cookie                                           |
| GET account/export                                       | User                    | Personal account/report/group/inbox/session metadata; no hashes                   |
| DELETE account                                           | User + current password | Delete account, owned private groups; anonymize public authorship                 |
| GET account/sessions                                     | User                    | Active session metadata; no tokens                                                |
| DELETE account/sessions                                  | User                    | Revoke one owned session by ID                                                    |
| GET notifications                                        | User                    | Private latest 100 platform messages                                              |
| POST notifications/read                                  | User                    | Mark owned messages read                                                          |
| GET / POST groups                                        | User                    | Read owned/joined groups or create a private group                                |
| DELETE groups/:id                                        | Member                  | Owner deletes group; other member leaves                                          |
| POST groups/:id/invite                                   | Group owner             | Random 48-hour single-use invite, stored hashed                                   |
| POST groups/join                                         | User                    | Atomically consume invitation and join; no member disclosure                      |
| POST groups/:id/events                                   | Group owner             | Future voluntary event and in-app member notifications                            |
| GET admin/dashboard                                      | admin.read              | Organization metrics, editorial/moderation queues and audit metadata              |
| POST admin/sources                                       | content.write           | Source with original URL/excerpt, initially IN_REVIEW                             |
| PATCH admin/sources                                      | content.write           | Optimistic revision correction; preserve old snapshot and invalidate verification |
| POST admin/content                                       | content.write           | Create election, office, candidate, candidacy or proposal                         |
| POST admin/reviews                                       | content.verify          | Independent approve/reject/review; validates source and biography evidence        |
| PATCH admin/issues                                       | issues.moderate         | Publication, public note and evidence-required status change                      |
| GET / POST admin/members                                 | users.manage            | Read and assign organization roles; cannot change own role                        |
| POST admin/ai                                            | content.write, optional | Summarize bounded operator-provided text to a source-linked draft                 |

## Payload examples

Report:

```json
{
  "cityId": "us-ne-auburn",
  "title": "Public issue to review",
  "description": "Describe a public condition without personal information.",
  "approximateLocation": "Public intersection or landmark",
  "category": "STREETS"
}
```

Editorial proposal (requires an existing same-organization candidacy and source):

```json
{
  "type": "proposal",
  "data": {
    "candidacyId": "existing-id",
    "topic": "infrastructure",
    "text": "Documented proposal text",
    "sourceId": "existing-source-id"
  }
}
```

Independent review:

```json
{
  "entityType": "proposal",
  "entityId": "existing-id",
  "status": "VERIFIED",
  "note": "Checked the original source, relevant date and attribution."
}
```

Source correction: source fields plus `id` and current integer `revision`. A stale revision returns `409 REVISION_CONFLICT`. Correction returns the source to review and public dependent election information is withheld until a different authorized reviewer verifies it.

AI: `sourceId`, `documentText` (≤16,000 characters), `confirmNoPersonalData: true`. Returns DRAFT, original source and human-review requirement. Disabled providers return `503 AI_DISABLED`; no document URL is fetched.

## Errors

401 sign-in required / invalid credentials; 403 permission or origin rejection; 404 absent or inaccessible resource; 409 duplicate, revision conflict or independent-review requirement; 413 body too large; 415 non-JSON body; 422 validation/evidence failure; 429 rate limit; 503 unavailable/configuration failure. Errors include a request ID, never a stack, password, token or raw database error. Current public electoral lists are bounded pilot views; high-volume administration pagination remains on the roadmap.
