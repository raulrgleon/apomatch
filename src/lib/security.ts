import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { db } from './db';
function derive(password: string, salt: string, legacy = false): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      legacy ? {} : { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new HttpError(503, 'SERVER_CONFIGURATION_REQUIRED');
  return value;
}
export function digest(value: string) {
  return createHmac('sha256', secret()).update(value).digest('hex');
}
export function newToken() {
  return randomBytes(32).toString('base64url');
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt);
  return `v2:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const modern = stored.startsWith('v2:');
  const [salt, encoded] = (modern ? stored.slice(3) : stored).split(':');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(encoded || '')) return false;
  const hash = await derive(password, salt, !modern);
  return timingSafeEqual(hash, Buffer.from(encoded, 'hex'));
}
export function assertSameOrigin(request: NextRequest) {
  const allowed = new URL(process.env.APP_ORIGIN || 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== allowed) throw new HttpError(403, 'ORIGIN_REJECTED');
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') throw new HttpError(403, 'ORIGIN_REJECTED');
}
export async function currentUser(request: NextRequest) {
  const token = request.cookies.get('apomatch-session')?.value;
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: digest(token) },
    include: {
      user: { include: { memberships: { include: { role: { include: { permissions: true } } } } } },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}
export async function requireUser(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, 'SIGN_IN_REQUIRED');
  return user;
}
export type AuthUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
export function hasPermission(user: AuthUser, organizationId: string, permission: string) {
  return user.memberships.some(
    (m) =>
      m.organizationId === organizationId &&
      m.role.permissions.some((p) => p.permissionId === permission),
  );
}
export function requirePermission(user: AuthUser, organizationId: string, permission: string) {
  if (!hasPermission(user, organizationId, permission))
    throw new HttpError(403, 'PERMISSION_DENIED');
}
// Atomic PostgreSQL buckets work across replicas. No trusting spoofable forwarded IPs.
export async function rateLimit(key: string, limit: number, seconds = 900) {
  const now = Date.now();
  const windowStart = Math.floor(now / (seconds * 1000));
  const bucket = `${key}:${windowStart}`;
  const result = await db.rateLimitBucket.upsert({
    where: { key: bucket },
    create: { key: bucket, count: 1, resetsAt: new Date((windowStart + 1) * seconds * 1000) },
    update: { count: { increment: 1 } },
  });
  if (result.count > limit) throw new HttpError(429, 'RATE_LIMITED');
}
export function publicUser(user: AuthUser | null) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    memberships: user.memberships.map((m) => ({
      organizationId: m.organizationId,
      roleId: m.roleId,
      permissions: m.role.permissions.map((p) => p.permissionId),
    })),
  };
}
export async function readBody(request: NextRequest) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'JSON_REQUIRED');
  // Bound actual streamed bytes as well as the untrusted content-length header.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_JSON');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.byteLength;
    if (length > 64 * 1024) {
      await reader.cancel();
      throw new HttpError(413, 'BODY_TOO_LARGE');
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}
