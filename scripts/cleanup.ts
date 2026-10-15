import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function cleanup() {
  const now = new Date();
  const day = 86400000;
  const results = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimitBucket.deleteMany({ where: { resetsAt: { lt: now } } }),
    db.groupInvitation.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * day) } } }),
    db.auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 365 * day) } } }),
  ]);
  console.log(JSON.stringify({ event: 'retention.cleanup', counts: results.map((r) => r.count) }));
}
cleanup()
  .catch(() => {
    console.error('Cleanup failed');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
