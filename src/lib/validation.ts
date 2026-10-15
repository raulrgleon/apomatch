import { z } from 'zod';
export const text = (max = 500) => z.string().trim().min(1).max(max);
export const id = z.string().min(1).max(100);
export const safeUrl = z
  .url()
  .max(2000)
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password;
  }, 'Use a public HTTPS source URL');
export const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  name: text(80).optional(),
});
export const issueSchema = z.object({
  title: text(140),
  description: text(3000),
  approximateLocation: text(180),
  cityId: id,
  category: z.enum([
    'STREETS',
    'LIGHTING',
    'WATER',
    'WASTE',
    'PARKS',
    'SAFETY',
    'SCHOOLS',
    'TRANSPORT',
    'OTHER',
  ]),
});
export const sourceSchema = z.object({
  title: text(200),
  url: safeUrl,
  kind: z.enum(['GOVERNMENT', 'CANDIDATE', 'PUBLIC_RECORD', 'DEMO']),
  excerpt: text(6000),
  publishedAt: z.iso.datetime().optional(),
});
export const reviewSchema = z.object({
  entityType: z.enum(['source', 'election', 'office', 'candidate', 'proposal']),
  entityId: id,
  status: z.enum(['VERIFIED', 'REJECTED', 'IN_REVIEW']),
  note: text(2000),
});
export const groupSchema = z.object({ name: text(100), cityId: id });
export const eventSchema = z
  .object({
    title: text(140),
    description: text(2000),
    startsAt: z.iso.datetime(),
    officialResourceUrl: safeUrl.optional(),
  })
  .refine((v) => new Date(v.startsAt) > new Date(), 'Event must be in the future');
export const calculationSchema = z.object({
  assessedValue: z.number().finite().min(0).max(1e9),
  currentRate: z.number().finite().min(0).max(100),
  proposedRate: z.number().finite().min(0).max(100),
});
export function pageNumber(value: string | null) {
  const n = Number(value || 1);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
}
