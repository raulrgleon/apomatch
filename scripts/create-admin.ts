import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/security';
import { z } from 'zod';
const db = new PrismaClient();
async function main() {
  const env = z
    .object({
      ADMIN_EMAIL: z.email().transform((v) => v.toLowerCase()),
      ADMIN_NAME: z.string().min(1).max(80),
      ADMIN_PASSWORD: z.string().min(16).max(128),
      ADMIN_ORG: z.enum(['apomatch', 'demo']).default('apomatch'),
    })
    .parse(process.env);
  const org = await db.organization.findUniqueOrThrow({ where: { slug: env.ADMIN_ORG } });
  if (await db.user.findUnique({ where: { email: env.ADMIN_EMAIL } }))
    throw new Error('Account already exists. Use the administration panel to grant roles.');
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: env.ADMIN_EMAIL,
        name: env.ADMIN_NAME,
        passwordHash: await hashPassword(env.ADMIN_PASSWORD),
        memberships: { create: { organizationId: org.id, roleId: 'super-admin' } },
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        actorId: user.id,
        action: 'operator.admin.created',
        entityType: 'user',
        entityId: user.id,
      },
    });
  });
  console.log('Administrator created. No credentials are printed.');
}
main()
  .catch((e) => {
    console.error(e instanceof z.ZodError ? 'Missing or invalid ADMIN_* variables' : e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
