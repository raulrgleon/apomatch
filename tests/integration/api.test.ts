import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { db } from '../../src/lib/db';
import { NextRequest } from 'next/server';
import { handle } from '../../src/lib/api';
import { hashPassword, digest, newToken } from '../../src/lib/security';
const prefix = `integration-${Date.now()}`;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
const createdSources: string[] = [];
const createdIssues: string[] = [];
const createdGroups: string[] = [];
async function call(path: string, method = 'GET', body?: unknown, role?: string, org = 'apomatch') {
  const req = new NextRequest(
    `http://localhost:3000/api/${path}${path.includes('?') ? '&' : '?'}org=${org}`,
    {
      method,
      headers: {
        origin: 'http://localhost:3000',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(role ? { cookie: `apomatch-session=${tokens[role]}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const res = await handle(req, {
    params: Promise.resolve({ path: path.split('?')[0].split('/') }),
  });
  return { status: res.status, data: await res.json(), response: res };
}
beforeAll(async () => {
  process.env.APP_ORIGIN = 'http://localhost:3000';
  process.env.SESSION_SECRET ||= 'integration-only-secret-never-production-1234';
  for (const role of ['editor', 'verifier', 'moderator', 'super-admin', 'citizen']) {
    const u = await db.user.create({
      data: {
        email: `${prefix}-${role}@example.test`,
        name: `Test ${role}`,
        passwordHash: await hashPassword('integration-testing-passphrase'),
        ...(role !== 'citizen'
          ? { memberships: { create: { organizationId: 'org-apomatch', roleId: role } } }
          : {}),
      },
    });
    ids[role] = u.id;
    tokens[role] = newToken();
    await db.session.create({
      data: {
        userId: u.id,
        tokenHash: digest(tokens[role]),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  }
});
afterAll(async () => {
  await db.communityGroup.deleteMany({ where: { id: { in: createdGroups } } });
  await db.communityIssue.deleteMany({ where: { id: { in: createdIssues } } });
  await db.source.deleteMany({ where: { id: { in: createdSources } } });
  await db.editorialReview.deleteMany({ where: { reviewerId: { in: Object.values(ids) } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
  await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await db.$disconnect();
});
describe.sequential('real database API workflows', () => {
  it('serves pilot and demo as separate datasets', async () => {
    const pilot = await call('elections');
    expect(pilot.status).toBe(200);
    expect(
      pilot.data.elections.every((e: { candidacies: unknown[] }) => e.candidacies.length === 0),
    ).toBe(true);
    const demo = await call('elections', 'GET', undefined, undefined, 'demo');
    expect(demo.data.elections[0].candidacies).toHaveLength(2);
  });
  it('blocks unauthenticated admin access and cross-tenant roles', async () => {
    expect((await call('admin/dashboard')).status).toBe(401);
    expect((await call('admin/dashboard', 'GET', undefined, 'editor', 'demo')).status).toBe(403);
    expect((await call('admin/dashboard', 'GET', undefined, 'citizen')).status).toBe(403);
  });
  it('supports creation, independent verification and source publication', async () => {
    const created = await call(
      'admin/sources',
      'POST',
      {
        title: 'Integration official source',
        url: `https://example.org/${prefix}`,
        kind: 'GOVERNMENT',
        excerpt: 'Test source fixture, not electoral data.',
      },
      'editor',
    );
    expect(created.status).toBe(201);
    createdSources.push(created.data.id);
    const own = await call(
      'admin/reviews',
      'POST',
      {
        entityType: 'source',
        entityId: created.data.id,
        status: 'VERIFIED',
        note: 'Self review rejected',
      },
      'editor',
    );
    expect(own.status).toBe(403);
    // Super admin has both capabilities, but still may not verify its own content.
    const another = await call(
      'admin/sources',
      'POST',
      {
        title: 'Admin authored fixture',
        url: `https://example.org/${prefix}-admin`,
        kind: 'GOVERNMENT',
        excerpt: 'Testing independent review enforcement.',
      },
      'super-admin',
    );
    createdSources.push(another.data.id);
    expect(
      (
        await call(
          'admin/reviews',
          'POST',
          {
            entityType: 'source',
            entityId: another.data.id,
            status: 'VERIFIED',
            note: 'Reject self-review',
          },
          'super-admin',
        )
      ).data.error,
    ).toBe('INDEPENDENT_REVIEW_REQUIRED');
    expect(
      (await call('sources')).data.items.some((s: { id: string }) => s.id === created.data.id),
    ).toBe(false);
    const reviewed = await call(
      'admin/reviews',
      'POST',
      {
        entityType: 'source',
        entityId: created.data.id,
        status: 'VERIFIED',
        note: 'Verified independently for integration test',
      },
      'verifier',
    );
    expect(reviewed.status).toBe(200);
    expect(
      (await call('sources')).data.items.some((s: { id: string }) => s.id === created.data.id),
    ).toBe(true);
    expect(await db.sourceVerification.count({ where: { sourceId: created.data.id } })).toBe(1);
  });
  it('moderates reports and demands evidence for government action', async () => {
    const created = await call(
      'issues',
      'POST',
      {
        cityId: 'us-ne-auburn',
        title: 'Integration report',
        description: 'A fictional report for testing moderation only.',
        category: 'STREETS',
        approximateLocation: 'Fictional public intersection',
      },
      'citizen',
    );
    expect(created.status).toBe(201);
    createdIssues.push(created.data.id);
    expect((await call(`issues/${created.data.id}`)).status).toBe(404);
    expect(
      (
        await call(
          'admin/issues',
          'PATCH',
          { id: created.data.id, status: 'RESOLVED', published: true, note: 'Unsupported claim' },
          'moderator',
        )
      ).data.error,
    ).toBe('OFFICIAL_EVIDENCE_REQUIRED');
    expect(
      (
        await call(
          'admin/issues',
          'PATCH',
          {
            id: created.data.id,
            status: 'IN_REVIEW',
            published: true,
            note: 'Reviewed for publication; no agency action asserted.',
          },
          'moderator',
        )
      ).status,
    ).toBe(200);
    const visible = await call(`issues/${created.data.id}`);
    expect(visible.status).toBe(200);
    expect(visible.data).not.toHaveProperty('authorId');
    expect(visible.data.updates).toHaveLength(2);
    expect(
      (
        await call(
          'admin/issues',
          'PATCH',
          {
            id: created.data.id,
            status: 'RESOLVED',
            published: true,
            note: 'Testing tenant evidence constraint',
            sourceId: 'source-demo',
          },
          'moderator',
        )
      ).status,
    ).toBe(422);
  });
  it('keeps private groups isolated and consumes invitations once', async () => {
    const created = await call(
      'groups',
      'POST',
      { name: 'Integration private group', cityId: 'us-ne-auburn' },
      'citizen',
    );
    expect(created.status).toBe(201);
    createdGroups.push(created.data.id);
    expect(
      (await call('groups', 'GET', undefined, 'editor')).data.items.some(
        (g: { id: string }) => g.id === created.data.id,
      ),
    ).toBe(false);
    expect((await call(`groups/${created.data.id}/invite`, 'POST', {}, 'editor')).status).toBe(404);
    const inv = await call(`groups/${created.data.id}/invite`, 'POST', {}, 'citizen');
    expect(inv.status).toBe(200);
    expect(
      (await call('groups/join', 'POST', { token: inv.data.token }, 'editor', 'demo')).status,
    ).toBe(404);
    expect((await call('groups/join', 'POST', { token: inv.data.token }, 'editor')).status).toBe(
      200,
    );
    expect((await call('groups/join', 'POST', { token: inv.data.token }, 'moderator')).status).toBe(
      404,
    );
    const event = await call(
      `groups/${created.data.id}/events`,
      'POST',
      {
        title: 'Voluntary resource discussion',
        description: 'A neutral fictional community event.',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
      },
      'citizen',
    );
    expect(event.status).toBe(201);
    expect(
      (await call('notifications', 'GET', undefined, 'editor')).data.items.length,
    ).toBeGreaterThan(0);
  });
  it('rejects cross-origin writes and oversized or invalid input', async () => {
    const req = new NextRequest('http://localhost:3000/api/issues', {
      method: 'POST',
      headers: { origin: 'https://attacker.test', 'content-type': 'application/json' },
      body: '{}',
    });
    const res = await handle(req, { params: Promise.resolve({ path: ['issues'] }) });
    expect(res.status).toBe(403);
    expect((await call('issues', 'POST', { title: 'x' }, 'citizen')).status).toBe(422);
    expect(
      (await call('calculate', 'POST', { assessedValue: 50000, currentRate: -1, proposedRate: 1 }))
        .status,
    ).toBe(422);
  });
  it('rate limits authentication attempts atomically', async () => {
    const email = `rate-${prefix}@example.test`;
    let last;
    for (let i = 0; i < 13; i++)
      last = await call('auth/login', 'POST', { email, password: 'not-a-real-password' });
    expect(last?.status).toBe(429);
  });
  it('exports and deletes account data without exposing password or session hashes', async () => {
    const exported = await call('account/export', 'GET', undefined, 'citizen');
    expect(exported.status).toBe(200);
    expect(JSON.stringify(exported.data)).not.toContain('passwordHash');
    expect(JSON.stringify(exported.data)).not.toContain('tokenHash');
    const deleted = await call(
      'account',
      'DELETE',
      { password: 'integration-testing-passphrase' },
      'citizen',
    );
    expect(deleted.status).toBe(200);
    expect(await db.session.count({ where: { userId: ids.citizen } })).toBe(0);
    expect(
      (await db.communityIssue.findUnique({ where: { id: createdIssues[0] } }))?.authorId,
    ).toBe(null);
  });
});
