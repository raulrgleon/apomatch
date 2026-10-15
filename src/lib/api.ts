import { NextRequest, NextResponse } from 'next/server';
import { Prisma, IssueStatus, IssueCategory } from '@prisma/client';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { db } from './db';
import {
  HttpError,
  assertSameOrigin,
  currentUser,
  requireUser,
  requirePermission,
  publicUser,
  digest,
  hashPassword,
  verifyPassword,
  newToken,
  rateLimit,
  readBody,
} from './security';
import {
  authSchema,
  issueSchema,
  sourceSchema,
  reviewSchema,
  groupSchema,
  eventSchema,
  pageNumber,
  text,
  id,
} from './validation';
import { propertyTax } from './calculations';
import {
  assertReviewable,
  isFreshVerified,
  freshSourceWhere,
  assertIssueEvidence,
} from './editorial';
import { aiProvider } from './ai';
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const snapshot = (data: unknown) => JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
const sessionCookie = (res: NextResponse, token: string, expires: Date) => {
  res.cookies.set('apomatch-session', token, {
    httpOnly: true,
    secure: process.env.APP_ORIGIN?.startsWith('https:') === true,
    sameSite: 'lax',
    path: '/',
    expires,
  });
  return res;
};
const expiry = () => new Date(Date.now() + 7 * 86400000);
const audit = (
  organizationId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
) => ({ organizationId, actorId, action, entityType, entityId });
const publicIssueSelect = {
  id: true,
  title: true,
  description: true,
  approximateLocation: true,
  category: true,
  status: true,
  isDemo: true,
  responsibleAuthority: true,
  createdAt: true,
  updatedAt: true,
  updates: {
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      source: { select: { title: true, url: true, status: true, verifiedAt: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};
async function organization(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('org') || 'apomatch';
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org) throw new HttpError(404, 'ORGANIZATION_NOT_FOUND');
  return org;
}
async function assertCity(cityId: string, isDemo: boolean) {
  const city = await db.city.findFirst({ where: { id: cityId, isDemo } });
  if (!city) throw new HttpError(422, 'CITY_NOT_AVAILABLE');
  return city;
}
export async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestId = newToken().slice(0, 12);
  try {
    const { path } = await context.params;
    const route = path.join('/');
    const method = request.method;
    if (['POST', 'PATCH', 'DELETE'].includes(method)) assertSameOrigin(request);
    if (route === 'health' && method === 'GET') {
      await db.$queryRaw`SELECT 1`;
      return json({ status: 'ok', database: 'connected', version: '0.2.0' });
    }
    if (route === 'auth/me' && method === 'GET')
      return json({ user: publicUser(await currentUser(request)) });
    if (['auth/register', 'auth/login'].includes(route) && method === 'POST') {
      // Global cap plus account key: does not trust forwarding headers or disclose addresses in logs.
      await rateLimit('auth-global', 1000);
      const data = authSchema.parse(await readBody(request));
      await rateLimit(`auth:${digest(data.email)}`, 12);
      let user = await db.user.findUnique({ where: { email: data.email } });
      if (route === 'auth/register') {
        if (!data.name) throw new HttpError(422, 'NAME_REQUIRED');
        if (user) throw new HttpError(409, 'REGISTRATION_UNAVAILABLE');
        user = await db.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash: await hashPassword(data.password),
          },
        });
      } else {
        // Perform a KDF even for unknown addresses to reduce enumeration via timing.
        const stored = user?.passwordHash || '00000000000000000000000000000000:' + '0'.repeat(128);
        if (!(await verifyPassword(data.password, stored)) || !user)
          throw new HttpError(401, 'INVALID_CREDENTIALS');
      }
      const token = newToken();
      const expiresAt = expiry();
      await db.session.create({ data: { tokenHash: digest(token), expiresAt, userId: user.id } });
      return sessionCookie(json({ ok: true }), token, expiresAt);
    }
    if (route === 'auth/logout' && method === 'POST') {
      const token = request.cookies.get('apomatch-session')?.value;
      if (token) await db.session.deleteMany({ where: { tokenHash: digest(token) } });
      return sessionCookie(json({ ok: true }), '', new Date(0));
    }
    if (route === 'account/export' && method === 'GET') {
      const user = await requireUser(request);
      const [issues, groups, notifications, sessions] = await Promise.all([
        db.communityIssue.findMany({ where: { authorId: user.id }, include: { updates: true } }),
        db.groupMembership.findMany({
          where: { userId: user.id },
          include: { group: { include: { events: true } } },
        }),
        db.notification.findMany({ where: { userId: user.id } }),
        db.session.findMany({
          where: { userId: user.id },
          select: { id: true, createdAt: true, expiresAt: true },
        }),
      ]);
      return json({
        user: publicUser(user),
        issues,
        groups,
        notifications,
        sessions,
        exportedAt: new Date(),
      });
    }
    if (route === 'account' && method === 'DELETE') {
      const user = await requireUser(request);
      const data = z.object({ password: z.string().max(128) }).parse(await readBody(request));
      if (!(await verifyPassword(data.password, user.passwordHash)))
        throw new HttpError(401, 'INVALID_CREDENTIALS');
      // Administrators must transfer responsibility before deletion; no orphaning the organization.
      if (user.memberships.some((m) => m.roleId === 'super-admin'))
        throw new HttpError(409, 'TRANSFER_ADMIN_ROLE_FIRST');
      await db.$transaction(async (tx) => {
        await tx.communityIssueUpdate.updateMany({
          where: { actorId: user.id },
          data: { actorId: null },
        });
        await tx.user.delete({ where: { id: user.id } });
      });
      return sessionCookie(json({ ok: true }), '', new Date(0));
    }
    const org = await organization(request);
    const cityId =
      request.nextUrl.searchParams.get('city') || (org.isDemo ? 'demo-city' : 'us-ne-auburn');
    if (route === 'locations' && method === 'GET') {
      const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
      const cities = await db.city.findMany({
        where: {
          isDemo: org.isDemo,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { zipCodes: { some: { zipCode: q } } },
                ],
              }
            : {}),
        },
        include: {
          county: { include: { state: true } },
          zipCodes: true,
          jurisdictions: { include: { districts: true } },
        },
        take: 20,
        orderBy: { name: 'asc' },
      });
      return json({
        cities,
        organization: { id: org.id, name: org.name, isDemo: org.isDemo },
        notice: 'ZIP codes do not determine electoral districts or polling places.',
      });
    }
    if (route === 'sources' && method === 'GET') {
      const page = pageNumber(request.nextUrl.searchParams.get('page'));
      const where = { organizationId: org.id, ...freshSourceWhere() };
      const [items, total] = await Promise.all([
        db.source.findMany({
          where,
          select: {
            id: true,
            title: true,
            url: true,
            kind: true,
            excerpt: true,
            publishedAt: true,
            retrievedAt: true,
            verifiedAt: true,
            status: true,
            revision: true,
          },
          orderBy: { title: 'asc' },
          take: 20,
          skip: (page - 1) * 20,
        }),
        db.source.count({ where }),
      ]);
      return json({ items, total, page });
    }
    if (route === 'elections' && method === 'GET') {
      await assertCity(cityId, org.isDemo);
      const where = {
        organizationId: org.id,
        jurisdiction: { cityId },
        ...freshSourceWhere(),
        source: freshSourceWhere(),
      };
      const elections = await db.election.findMany({
        where,
        include: {
          source: true,
          jurisdiction: true,
          candidacies: {
            where: {
              candidate: freshSourceWhere(),
              office: { ...freshSourceWhere(), source: freshSourceWhere() },
            },
            include: {
              candidate: {
                select: {
                  id: true,
                  name: true,
                  biography: true,
                  status: true,
                  verifiedAt: true,
                  statements: {
                    where: { status: 'VERIFIED', source: freshSourceWhere() },
                    include: { source: true },
                  },
                },
              },
              office: { include: { source: true } },
              proposals: {
                where: { ...freshSourceWhere(), source: freshSourceWhere() },
                include: { source: true },
                orderBy: { topic: 'asc' },
              },
            },
          },
        },
        orderBy: { electionDate: 'asc' },
      });
      const offices = await db.office.findMany({
        where: {
          organizationId: org.id,
          jurisdiction: { cityId },
          ...freshSourceWhere(),
          source: freshSourceWhere(),
        },
        include: { source: true },
        orderBy: { title: 'asc' },
      });
      // Explicit projection excludes internal creator IDs and private review metadata.
      return json({
        elections: elections.map((e) => ({
          id: e.id,
          name: e.name,
          electionDate: e.electionDate,
          status: e.status,
          verifiedAt: e.verifiedAt,
          source: sourcePublic(e.source),
          jurisdiction: e.jurisdiction.name,
          candidacies: e.candidacies.map((c) => ({
            id: c.id,
            candidate: {
              ...c.candidate,
              statements: c.candidate.statements.map((statement) => ({
                text: statement.text,
                source: sourcePublic(statement.source),
              })),
            },
            office: {
              id: c.office.id,
              title: c.office.title,
              responsibilities: c.office.responsibilities,
              source: sourcePublic(c.office.source),
            },
            proposals: c.proposals.map((p) => ({
              id: p.id,
              topic: p.topic,
              text: p.text,
              status: p.status,
              verifiedAt: p.verifiedAt,
              source: sourcePublic(p.source),
            })),
          })),
        })),
        offices: offices.map((o) => ({
          id: o.id,
          title: o.title,
          responsibilities: o.responsibilities,
          source: sourcePublic(o.source),
        })),
        ordering: 'Alphabetical candidate name within each office. No scores or recommendations.',
      });
    }
    if (route === 'issues' && method === 'GET') {
      await assertCity(cityId, org.isDemo);
      const category = z
        .nativeEnum(IssueCategory)
        .optional()
        .safeParse(request.nextUrl.searchParams.get('category') || undefined);
      if (!category.success) throw new HttpError(422, 'INVALID_CATEGORY');
      const status = z
        .nativeEnum(IssueStatus)
        .optional()
        .safeParse(request.nextUrl.searchParams.get('status') || undefined);
      if (!status.success) throw new HttpError(422, 'INVALID_STATUS');
      const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100),
        page = pageNumber(request.nextUrl.searchParams.get('page'));
      const where = {
        organizationId: org.id,
        cityId,
        published: true,
        ...(category.data ? { category: category.data } : {}),
        ...(status.data ? { status: status.data } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        db.communityIssue.findMany({
          where,
          select: publicIssueSelect,
          orderBy: { createdAt: 'desc' },
          take: 12,
          skip: (page - 1) * 12,
        }),
        db.communityIssue.count({ where }),
      ]);
      return json({ items, total, page });
    }
    if (route === 'issues' && method === 'POST') {
      const user = await requireUser(request);
      await rateLimit(`issues:${user.id}`, 10, 3600);
      const data = issueSchema.parse(await readBody(request));
      await assertCity(data.cityId, org.isDemo);
      const issue = await db.$transaction(async (tx) => {
        const item = await tx.communityIssue.create({
          data: {
            ...data,
            organizationId: org.id,
            authorId: user.id,
            isDemo: org.isDemo,
            updates: {
              create: {
                status: 'REPORTED',
                note: 'Submitted to ApoMatch for moderation. Not sent to a government agency.',
                actorId: user.id,
              },
            },
          },
        });
        await tx.auditLog.create({
          data: audit(org.id, user.id, 'issue.created', 'issue', item.id),
        });
        await tx.notification.create({
          data: {
            userId: user.id,
            title:
              'Report received by ApoMatch. Awaiting platform moderation; not submitted to an authority.',
          },
        });
        return item;
      });
      return json({ id: issue.id, status: issue.status, published: false }, 201);
    }
    if (path[0] === 'issues' && path[1] && method === 'GET') {
      const issue = await db.communityIssue.findFirst({
        where: { id: path[1], organizationId: org.id, published: true },
        select: publicIssueSelect,
      });
      if (!issue) throw new HttpError(404, 'ISSUE_NOT_FOUND');
      return json(issue);
    }
    if (route === 'calculate' && method === 'POST')
      return json(propertyTax(await readBody(request)));
    if (route === 'notifications' && method === 'GET') {
      const user = await requireUser(request);
      return json({
        items: await db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      });
    }
    if (route === 'notifications/read' && method === 'POST') {
      const user = await requireUser(request);
      await db.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return json({ ok: true });
    }
    if (path[0] === 'groups') {
      const user = await requireUser(request);
      if (route === 'groups' && method === 'GET')
        return json({
          items: await db.communityGroup.findMany({
            where: { organizationId: org.id, memberships: { some: { userId: user.id } } },
            select: {
              id: true,
              name: true,
              cityId: true,
              ownerId: true,
              events: { orderBy: { startsAt: 'asc' }, take: 100 },
              _count: { select: { memberships: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        });
      if (route === 'groups' && method === 'POST') {
        await rateLimit(`groups:${user.id}`, 10, 86400);
        const data = groupSchema.parse(await readBody(request));
        await assertCity(data.cityId, org.isDemo);
        const group = await db.communityGroup.create({
          data: {
            ...data,
            ownerId: user.id,
            organizationId: org.id,
            memberships: { create: { userId: user.id, role: 'OWNER' } },
          },
        });
        return json({ id: group.id }, 201);
      }
      if (route === 'groups/join' && method === 'POST') {
        await rateLimit(`join:${user.id}`, 20, 3600);
        const { token } = z
          .object({ token: z.string().min(30).max(128) })
          .parse(await readBody(request));
        await db.$transaction(async (tx) => {
          const invitation = await tx.groupInvitation.findUnique({
            where: { tokenHash: digest(token) },
            include: { group: true },
          });
          if (
            !invitation ||
            invitation.group.organizationId !== org.id ||
            invitation.usedAt ||
            invitation.expiresAt <= new Date()
          )
            throw new HttpError(404, 'INVITATION_UNAVAILABLE');
          const consumed = await tx.groupInvitation.updateMany({
            where: { id: invitation.id, usedAt: null, expiresAt: { gt: new Date() } },
            data: { usedAt: new Date() },
          });
          if (consumed.count !== 1) throw new HttpError(409, 'INVITATION_UNAVAILABLE');
          await tx.groupMembership.upsert({
            where: { groupId_userId: { groupId: invitation.groupId, userId: user.id } },
            create: { groupId: invitation.groupId, userId: user.id },
            update: {},
          });
        });
        return json({ ok: true });
      }
      const group = await db.communityGroup.findFirst({
        where: { id: path[1], organizationId: org.id, memberships: { some: { userId: user.id } } },
      });
      if (!group) throw new HttpError(404, 'GROUP_NOT_FOUND');
      if (path[2] === 'invite' && method === 'POST') {
        if (group.ownerId !== user.id) throw new HttpError(403, 'OWNER_REQUIRED');
        await rateLimit(`invite:${user.id}`, 30, 3600);
        const token = newToken();
        await db.groupInvitation.create({
          data: {
            groupId: group.id,
            tokenHash: digest(token),
            expiresAt: new Date(Date.now() + 48 * 3600000),
          },
        });
        return json({
          token,
          url: `${process.env.APP_ORIGIN}/groups?org=${org.slug}#invite=${token}`,
          expiresInHours: 48,
        });
      }
      if (path[2] === 'events' && method === 'POST') {
        if (group.ownerId !== user.id) throw new HttpError(403, 'OWNER_REQUIRED');
        await rateLimit(`events:${user.id}`, 30, 3600);
        const data = eventSchema.parse(await readBody(request));
        const event = await db.$transaction(async (tx) => {
          const item = await tx.communityEvent.create({ data: { ...data, groupId: group.id } });
          const members = await tx.groupMembership.findMany({
            where: { groupId: group.id },
            select: { userId: true },
          });
          await tx.notification.createMany({
            data: members.map((m) => ({
              userId: m.userId,
              title: `New voluntary community event: ${item.title}`,
            })),
          });
          return item;
        });
        return json({ id: event.id }, 201);
      }
      if (path.length === 2 && method === 'DELETE') {
        if (group.ownerId === user.id) await db.communityGroup.delete({ where: { id: group.id } });
        else
          await db.groupMembership.delete({
            where: { groupId_userId: { groupId: group.id, userId: user.id } },
          });
        return json({ ok: true });
      }
    }
    if (path[0] === 'admin') {
      const user = await requireUser(request);
      requirePermission(user, org.id, 'admin.read');
      if (route === 'admin/dashboard' && method === 'GET') {
        const [users, cities, elections, candidates, issues, pending, sources, auditLogs] =
          await Promise.all([
            db.organizationMembership.count({ where: { organizationId: org.id } }),
            db.city.count({ where: { isDemo: org.isDemo } }),
            db.election.count({ where: { organizationId: org.id, status: 'VERIFIED' } }),
            db.candidate.count({ where: { organizationId: org.id, status: 'VERIFIED' } }),
            db.communityIssue.count({ where: { organizationId: org.id } }),
            db.source.count({
              where: { organizationId: org.id, status: { in: ['DRAFT', 'IN_REVIEW'] } },
            }),
            db.source.findMany({
              where: { organizationId: org.id },
              orderBy: { retrievedAt: 'desc' },
              take: 100,
            }),
            db.auditLog.findMany({
              where: { organizationId: org.id },
              select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 50,
            }),
          ]);
        const queue = await db.communityIssue.findMany({
          where: { organizationId: org.id },
          include: { updates: { orderBy: { createdAt: 'desc' }, take: 10 } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        const [allElections, offices, allCandidates, proposals, jurisdictions, candidacies] =
          await Promise.all([
            db.election.findMany({ where: { organizationId: org.id }, take: 100 }),
            db.office.findMany({ where: { organizationId: org.id }, take: 100 }),
            db.candidate.findMany({ where: { organizationId: org.id }, take: 100 }),
            db.proposal.findMany({
              where: { candidacy: { candidate: { organizationId: org.id } } },
              take: 100,
            }),
            db.jurisdiction.findMany({ where: { city: { isDemo: org.isDemo } }, take: 100 }),
            db.candidacy.findMany({
              where: { candidate: { organizationId: org.id } },
              include: {
                candidate: { select: { name: true } },
                office: { select: { title: true } },
              },
              take: 100,
            }),
          ]);
        return json({
          stats: { users, cities, elections, candidates, issues, pending },
          sources,
          queue,
          auditLogs,
          elections: allElections,
          offices,
          candidates: allCandidates,
          proposals,
          jurisdictions,
          candidacies,
          integrations: {
            database: 'connected',
            ai: process.env.AI_PROVIDER || 'disabled',
            email: 'not configured',
            uploads: 'disabled',
            billing: 'disabled',
          },
        });
      }
      if (route === 'admin/sources' && method === 'POST') {
        requirePermission(user, org.id, 'content.write');
        const data = sourceSchema.parse(await readBody(request));
        if (data.kind === 'DEMO' && !org.isDemo)
          throw new HttpError(422, 'DEMO_SOURCE_NOT_ALLOWED');
        const source = await db.$transaction(async (tx) => {
          const item = await tx.source.create({
            data: { ...data, organizationId: org.id, createdById: user.id, status: 'IN_REVIEW' },
          });
          await tx.auditLog.create({
            data: audit(org.id, user.id, 'source.created', 'source', item.id),
          });
          return item;
        });
        return json({ id: source.id }, 201);
      }
      if (route === 'admin/reviews' && method === 'POST') {
        requirePermission(user, org.id, 'content.verify');
        const data = reviewSchema.parse(await readBody(request));
        await db.$transaction(async (tx) => {
          const where = { id: data.entityId, organizationId: org.id };
          const entity =
            data.entityType === 'source'
              ? await tx.source.findFirst({ where })
              : data.entityType === 'election'
                ? await tx.election.findFirst({ where })
                : data.entityType === 'office'
                  ? await tx.office.findFirst({ where })
                  : data.entityType === 'candidate'
                    ? await tx.candidate.findFirst({ where })
                    : await tx.proposal.findFirst({
                        where: {
                          id: data.entityId,
                          candidacy: { candidate: { organizationId: org.id } },
                        },
                      });
          if (!entity) throw new HttpError(404, 'CONTENT_NOT_FOUND');
          assertReviewable(entity.createdById, user.id);
          if (data.status === 'VERIFIED' && data.entityType !== 'source') {
            if ('sourceId' in entity) {
              const source = await tx.source.findFirst({
                where: { id: entity.sourceId, organizationId: org.id },
              });
              if (!source || !isFreshVerified(source))
                throw new HttpError(422, 'VERIFIED_SOURCE_REQUIRED');
            }
            if (data.entityType === 'candidate') {
              const statement = await tx.candidateStatement.findFirst({
                where: {
                  candidateId: entity.id,
                  source: { organizationId: org.id, ...freshSourceWhere() },
                },
              });
              if (!statement) throw new HttpError(422, 'SOURCED_BIOGRAPHY_REQUIRED');
            }
          }
          const update = {
            status: data.status,
            verifiedAt: data.status === 'VERIFIED' ? new Date() : null,
          };
          if (data.entityType === 'source') {
            await tx.source.update({ where: { id: entity.id }, data: update });
            const source = await tx.source.findUniqueOrThrow({ where: { id: entity.id } });
            await tx.sourceVerification.create({
              data: {
                sourceId: entity.id,
                reviewerId: user.id,
                note: data.note,
                status: data.status,
                revision: source.revision,
                snapshot: snapshot(entity),
              },
            });
          } else if (data.entityType === 'election')
            await tx.election.update({ where: { id: entity.id }, data: update });
          else if (data.entityType === 'office')
            await tx.office.update({ where: { id: entity.id }, data: update });
          else if (data.entityType === 'candidate') {
            await tx.candidate.update({ where: { id: entity.id }, data: update });
            await tx.candidateStatement.updateMany({
              where: { candidateId: entity.id },
              data: { status: data.status },
            });
          } else await tx.proposal.update({ where: { id: entity.id }, data: update });
          await tx.editorialReview.create({
            data: {
              organizationId: org.id,
              entityType: data.entityType,
              entityId: entity.id,
              reviewerId: user.id,
              status: data.status,
              note: data.note,
              snapshot: snapshot(entity),
            },
          });
          await tx.auditLog.create({
            data: audit(
              org.id,
              user.id,
              `editorial.${data.status.toLowerCase()}`,
              data.entityType,
              entity.id,
            ),
          });
        });
        return json({ ok: true });
      }
      if (route === 'admin/issues' && method === 'PATCH') {
        requirePermission(user, org.id, 'issues.moderate');
        const data = z
          .object({
            id,
            status: z.nativeEnum(IssueStatus),
            published: z.boolean(),
            note: text(2000),
            responsibleAuthority: text(200).optional(),
            sourceId: id.optional(),
          })
          .parse(await readBody(request));
        const issue = await db.communityIssue.findFirst({
          where: { id: data.id, organizationId: org.id },
        });
        if (!issue) throw new HttpError(404, 'ISSUE_NOT_FOUND');
        assertIssueEvidence(data.status, data.sourceId);
        if (data.sourceId) {
          const source = await db.source.findFirst({
            where: {
              id: data.sourceId,
              organizationId: org.id,
              kind: org.isDemo ? undefined : 'GOVERNMENT',
              ...freshSourceWhere(),
            },
          });
          if (!source) throw new HttpError(422, 'OFFICIAL_EVIDENCE_REQUIRED');
        }
        await db.$transaction(async (tx) => {
          await tx.communityIssue.update({
            where: { id: issue.id },
            data: {
              status: data.status,
              published: data.published,
              responsibleAuthority: data.responsibleAuthority,
              updates: {
                create: {
                  status: data.status,
                  note: data.note,
                  sourceId: data.sourceId,
                  actorId: user.id,
                },
              },
            },
          });
          await tx.auditLog.create({
            data: audit(org.id, user.id, 'issue.moderated', 'issue', issue.id),
          });
          if (issue.authorId)
            await tx.notification.create({
              data: {
                userId: issue.authorId,
                title: `ApoMatch report status: ${data.status}. ${data.note}`,
              },
            });
        });
        return json({ ok: true });
      }
      if (route === 'admin/content' && method === 'POST') {
        requirePermission(user, org.id, 'content.write');
        const raw = z
          .object({
            type: z.enum(['election', 'office', 'candidate', 'proposal', 'candidacy']),
            data: z.record(z.string(), z.unknown()),
          })
          .parse(await readBody(request));
        const entityId = await db.$transaction(async (tx) => {
          const ownedSource = async (sourceId: string) => {
            if (!(await tx.source.findFirst({ where: { id: sourceId, organizationId: org.id } })))
              throw new HttpError(422, 'SOURCE_NOT_FOUND');
          };
          const ownedJurisdiction = async (jurisdictionId: string) => {
            if (
              !(await tx.jurisdiction.findFirst({
                where: { id: jurisdictionId, city: { isDemo: org.isDemo } },
              }))
            )
              throw new HttpError(422, 'JURISDICTION_NOT_FOUND');
          };
          let entityId: string;
          if (raw.type === 'election') {
            const data = z
              .object({
                name: text(200),
                electionDate: z.iso.date(),
                jurisdictionId: id,
                sourceId: id,
              })
              .parse(raw.data);
            await ownedSource(data.sourceId);
            await ownedJurisdiction(data.jurisdictionId);
            const item = await tx.election.create({
              data: {
                ...data,
                electionDate: new Date(data.electionDate),
                organizationId: org.id,
                createdById: user.id,
                status: 'IN_REVIEW',
              },
            });
            entityId = item.id;
          } else if (raw.type === 'office') {
            const data = z
              .object({
                title: text(200),
                responsibilities: text(3000),
                jurisdictionId: id,
                sourceId: id,
              })
              .parse(raw.data);
            await ownedSource(data.sourceId);
            await ownedJurisdiction(data.jurisdictionId);
            const item = await tx.office.create({
              data: { ...data, organizationId: org.id, createdById: user.id, status: 'IN_REVIEW' },
            });
            entityId = item.id;
          } else if (raw.type === 'candidate') {
            const data = z
              .object({ name: text(200), biography: text(3000), sourceId: id })
              .parse(raw.data);
            await ownedSource(data.sourceId);
            const item = await tx.candidate.create({
              data: {
                name: data.name,
                biography: data.biography,
                organizationId: org.id,
                createdById: user.id,
                status: 'IN_REVIEW',
                statements: { create: { text: data.biography, sourceId: data.sourceId } },
              },
            });
            entityId = item.id;
          } else if (raw.type === 'candidacy') {
            const data = z
              .object({ candidateId: id, electionId: id, officeId: id })
              .parse(raw.data);
            const [candidate, election, office] = await Promise.all([
              tx.candidate.findFirst({ where: { id: data.candidateId, organizationId: org.id } }),
              tx.election.findFirst({ where: { id: data.electionId, organizationId: org.id } }),
              tx.office.findFirst({ where: { id: data.officeId, organizationId: org.id } }),
            ]);
            if (
              !candidate ||
              !election ||
              !office ||
              election.jurisdictionId !== office.jurisdictionId
            )
              throw new HttpError(422, 'INVALID_CANDIDACY');
            const item = await tx.candidacy.create({ data });
            entityId = item.id;
          } else {
            const data = z
              .object({ candidacyId: id, topic: text(100), text: text(4000), sourceId: id })
              .parse(raw.data);
            await ownedSource(data.sourceId);
            if (
              !(await tx.candidacy.findFirst({
                where: { id: data.candidacyId, candidate: { organizationId: org.id } },
              }))
            )
              throw new HttpError(422, 'CANDIDACY_NOT_FOUND');
            const item = await tx.proposal.create({
              data: { ...data, createdById: user.id, status: 'IN_REVIEW' },
            });
            entityId = item.id;
          }
          await tx.auditLog.create({
            data: audit(org.id, user.id, 'content.created', raw.type, entityId),
          });
          return entityId;
        });
        return json({ id: entityId }, 201);
      }
      if (route === 'admin/members' && method === 'GET') {
        requirePermission(user, org.id, 'users.manage');
        return json({
          items: await db.organizationMembership.findMany({
            where: { organizationId: org.id },
            select: { roleId: true, user: { select: { id: true, email: true, name: true } } },
          }),
          roles: await db.role.findMany({ select: { id: true, name: true } }),
        });
      }
      if (route === 'admin/members' && method === 'POST') {
        requirePermission(user, org.id, 'users.manage');
        const data = z
          .object({
            email: z.email().transform((s) => s.toLowerCase()),
            roleId: z.enum(['super-admin', 'editor', 'verifier', 'moderator']),
          })
          .parse(await readBody(request));
        const target = await db.user.findUnique({ where: { email: data.email } });
        if (!target) throw new HttpError(404, 'USER_NOT_FOUND');
        if (target.id === user.id) throw new HttpError(409, 'CANNOT_CHANGE_OWN_ROLE');
        await db.$transaction(async (tx) => {
          await tx.organizationMembership.upsert({
            where: { userId_organizationId: { userId: target.id, organizationId: org.id } },
            create: { userId: target.id, organizationId: org.id, roleId: data.roleId },
            update: { roleId: data.roleId },
          });
          await tx.auditLog.create({
            data: audit(org.id, user.id, 'membership.updated', 'user', target.id),
          });
        });
        return json({ ok: true });
      }
      if (route === 'admin/ai' && method === 'POST') {
        requirePermission(user, org.id, 'content.write');
        if (process.env.AI_PROVIDER !== 'ollama') throw new HttpError(503, 'AI_DISABLED');
        await rateLimit(`ai:${user.id}`, 10, 3600);
        const data = z
          .object({
            sourceId: id,
            documentText: text(16000),
            confirmNoPersonalData: z.literal(true),
          })
          .parse(await readBody(request));
        const source = await db.source.findFirst({
          where: { id: data.sourceId, organizationId: org.id },
        });
        if (!source) throw new HttpError(404, 'SOURCE_NOT_FOUND');
        const hash = createHash('sha256').update(data.documentText).digest('hex');
        const draft = await aiProvider().summarize({
          text: data.documentText,
          sourceId: source.id,
          url: source.url,
          digest: hash,
        });
        const doc = await db.document.create({
          data: {
            sourceId: source.id,
            text: data.documentText,
            digest: hash,
            drafts: { create: { text: draft.text, provider: draft.provider } },
          },
        });
        await db.auditLog.create({
          data: audit(org.id, user.id, 'ai.draft.created', 'document', doc.id),
        });
        return json({ ...draft, source: sourcePublic(source), status: 'DRAFT' });
      }
    }
    throw new HttpError(404, 'NOT_FOUND');
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.code, requestId }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: 'VALIDATION_FAILED',
          fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          requestId,
        },
        422,
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return json({ error: 'ALREADY_EXISTS', requestId }, 409);
    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        event: 'request.failed',
        type: error instanceof Error ? error.name : 'unknown',
      }),
    );
    return json({ error: 'SERVICE_UNAVAILABLE', requestId }, 503);
  }
}
function sourcePublic(source: {
  id: string;
  title: string;
  url: string;
  kind: string;
  retrievedAt: Date;
  verifiedAt: Date | null;
  status: string;
}) {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    kind: source.kind,
    retrievedAt: source.retrievedAt,
    verifiedAt: source.verifiedAt,
    status: source.status,
  };
}
