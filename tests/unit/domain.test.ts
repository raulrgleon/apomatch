import { describe, it, expect } from 'vitest';
import { propertyTax } from '../../src/lib/calculations';
import { assertReviewable, isFreshVerified, assertIssueEvidence } from '../../src/lib/editorial';
import {
  hashPassword,
  verifyPassword,
  assertSameOrigin,
  hasPermission,
  type AuthUser,
} from '../../src/lib/security';
import { issueSchema, safeUrl, pageNumber } from '../../src/lib/validation';
import { NextRequest } from 'next/server';
import { aiProvider } from '../../src/lib/ai';
describe('hypothetical tax model', () => {
  it('calculates annual and monthly differences in USD', () =>
    expect(propertyTax({ assessedValue: 200000, currentRate: 1, proposedRate: 1.1 })).toMatchObject(
      {
        currentAnnual: 2000,
        proposedAnnual: 2200,
        annualDifference: 200,
        monthlyDifference: 16.67,
        isHypothetical: true,
      },
    ));
  it('handles decreases and zero values', () => {
    expect(
      propertyTax({ assessedValue: 0, currentRate: 0, proposedRate: 0 }).annualDifference,
    ).toBe(0);
    expect(
      propertyTax({ assessedValue: 123456, currentRate: 2, proposedRate: 1.5 }).annualDifference,
    ).toBe(-617.28);
  });
  it.each([-1, 101, NaN, Infinity])('rejects invalid rates %s', (rate) =>
    expect(() =>
      propertyTax({ assessedValue: 200000, currentRate: rate, proposedRate: 1 }),
    ).toThrow(),
  );
  it('rounds bills to cents before differences', () =>
    expect(propertyTax({ assessedValue: 99.99, currentRate: 1, proposedRate: 1.01 })).toMatchObject(
      { currentAnnual: 1, proposedAnnual: 1.01, annualDifference: 0.01 },
    ));
});
describe('editorial safeguards', () => {
  it('prevents self-verification', () =>
    expect(() => assertReviewable('editor', 'editor')).toThrow('INDEPENDENT_REVIEW_REQUIRED'));
  it('allows a different reviewer', () =>
    expect(() => assertReviewable('editor', 'reviewer')).not.toThrow());
  it('withholds expired sources', () =>
    expect(isFreshVerified({ status: 'VERIFIED', verifiedAt: new Date('2020-01-01') })).toBe(
      false,
    ));
  it('requires official evidence for authority-action states', () => {
    for (const s of ['REFERRED', 'IN_PROGRESS', 'RESOLVED'])
      expect(() => assertIssueEvidence(s)).toThrow('OFFICIAL_EVIDENCE_REQUIRED');
    expect(() => assertIssueEvidence('IN_REVIEW')).not.toThrow();
  });
});
describe('security boundaries', () => {
  it('hashes with individual salts and verifies credentials', async () => {
    const a = await hashPassword('sample-testing-passphrase'),
      b = await hashPassword('sample-testing-passphrase');
    expect(a).not.toBe(b);
    expect(await verifyPassword('sample-testing-passphrase', a)).toBe(true);
    expect(await verifyPassword('different', a)).toBe(false);
  });
  it('rejects missing and foreign origins', () => {
    process.env.APP_ORIGIN = 'http://localhost:3000';
    expect(() =>
      assertSameOrigin(new NextRequest('http://localhost:3000/api/issues', { method: 'POST' })),
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new NextRequest('http://localhost:3000/api/issues', {
          method: 'POST',
          headers: { origin: 'https://attacker.test' },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new NextRequest('http://localhost:3000/api/issues', {
          method: 'POST',
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
    ).not.toThrow();
  });
  it('scopes role permissions to their organization', () => {
    const user = {
      memberships: [
        { organizationId: 'a', role: { permissions: [{ permissionId: 'content.write' }] } },
      ],
    } as AuthUser;
    expect(hasPermission(user, 'a', 'content.write')).toBe(true);
    expect(hasPermission(user, 'b', 'content.write')).toBe(false);
    expect(hasPermission(user, 'a', 'users.manage')).toBe(false);
  });
  it.each(['javascript:alert(1)', 'http://example.org', 'https://user:password@example.org'])(
    'rejects unsafe source URL %s',
    (url) => expect(safeUrl.safeParse(url).success).toBe(false),
  );
  it('rejects oversized report input', () =>
    expect(
      issueSchema.safeParse({
        title: 'a'.repeat(141),
        description: 'text',
        approximateLocation: 'Public square',
        cityId: 'us-ne-auburn',
        category: 'STREETS',
      }).success,
    ).toBe(false));
  it('bounds pagination', () => {
    expect(pageNumber('-1')).toBe(1);
    expect(pageNumber('1.5')).toBe(1);
    expect(pageNumber('100000')).toBe(10000);
  });
  it('has no paid AI dependency and fails closed', async () => {
    process.env.AI_PROVIDER = 'disabled';
    await expect(
      aiProvider().summarize({
        text: 'document',
        sourceId: 's',
        url: 'https://example.org',
        digest: 'hash',
      }),
    ).rejects.toThrow('AI_DISABLED');
  });
});
