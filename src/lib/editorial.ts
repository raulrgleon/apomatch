import { HttpError } from './security';
export function assertReviewable(createdById: string | null, reviewerId: string) {
  if (createdById === reviewerId) throw new HttpError(409, 'INDEPENDENT_REVIEW_REQUIRED');
}
export function isFreshVerified(
  source: { status: string; verifiedAt: Date | null },
  now = new Date(),
) {
  return (
    source.status === 'VERIFIED' &&
    !!source.verifiedAt &&
    source.verifiedAt.getTime() >= now.getTime() - 90 * 86400000
  );
}
export const freshSourceWhere = () => ({
  status: 'VERIFIED' as const,
  verifiedAt: { gte: new Date(Date.now() - 90 * 86400000) },
});
export function assertIssueEvidence(status: string, sourceId?: string) {
  if (['REFERRED', 'IN_PROGRESS', 'RESOLVED'].includes(status) && !sourceId)
    throw new HttpError(422, 'OFFICIAL_EVIDENCE_REQUIRED');
}
