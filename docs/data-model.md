# Relational data model

The authoritative schema is `prisma/schema.prisma`; the SQL migration under `prisma/migrations` creates the complete schema. IDs are stable seeded strings for curated pilot records and CUIDs for user-created resources.

| Domain            | Tables and relationships                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity          | User → Session; Role ↔ Permission through RolePermission; OrganizationMembership binds User, Organization and Role                                          |
| Geography         | State → County → City; CityZipCode is many-to-many in meaning (a ZIP can reference multiple cities); City → Jurisdiction → ElectoralDistrict                |
| Elections         | Organization → Election / Office / Candidate; Candidacy binds the three; CandidateStatement and Proposal point to original Source records                   |
| Provenance        | Source → SourceVerification; EditorialReview keeps entity snapshots, reviewer, note and status; source revision changes require fresh review                |
| Public service    | PublicOfficial → PublicCommitment, linked to offices and sources; these tables are ready for subsequent editorial screens                                   |
| Community         | Organization + City → CommunityIssue → CommunityIssueUpdate / CommunityIssueAttachment; author may become null on account deletion                          |
| Private groups    | CommunityGroup → GroupMembership, GroupInvitation and CommunityEvent; membership is required even for organization administrators                           |
| Inbox             | User → Notification with deliverAt; future private reminders appear when the inbox is opened after delivery time; no external email/SMS provider is enabled |
| Calculators       | CalculationModel → CalculationScenario; versioned formula metadata; current browser calculator does not persist private inputs                              |
| AI                | Source → Document (content SHA-256 digest) → AiDraft; draft-only, with review required                                                                      |
| SaaS / operations | Organization → Subscription / FeatureFlag / AuditLog; RateLimitBucket is database-wide infrastructure                                                       |

## Constraints and deletion

- Unique email, session digest, invitation digest, organization slug, role name and source URL within organization.
- Composite unique candidacy prevents duplicate candidate/election/office relationships.
- Foreign keys reject orphaned references. Tenant equality is additionally checked in server services and tested; the current model does not use PostgreSQL row-level security.
- Sessions, private owned groups, their memberships, invitations and events cascade on account deletion. Public report authors and audit actors become null. Public report text remains for civic continuity; moderation must prevent personal data from entering it.
- Source references are restrictive: deleting a source must not silently erase the basis of a published claim.
- Audit and editorial snapshots are distinct from mutable current content. Audit logs intentionally contain entity IDs and action names rather than credential or request bodies.

## Status semantics

`REPORTED` means received by **ApoMatch**, not by a government. `IN_REVIEW` is platform review. `REFERRED`, `IN_PROGRESS` and `RESOLVED` require a verified governmental evidence source outside the fictional demo. Moderators must confirm that the source actually supports the specific update. The system cannot automatically establish that an arbitrary official page confirms a particular repair.

Editorial states: DRAFT, IN_REVIEW, VERIFIED, REJECTED. Public election content and dependent sources must have current verification; verified content older than 90 days is withheld until renewed. Demo fixtures carry both organization/city flags and explicit fictional labels.
