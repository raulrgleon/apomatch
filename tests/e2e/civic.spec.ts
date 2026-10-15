import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
// The optional serverless Chromium fallback cannot reuse a browser across contexts.
const test = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? base.extend({
      context: async ({ playwright }, provide, info) => {
        const options = info.project.use;
        const browser = await playwright.chromium.launch(options.launchOptions);
        const context = await browser.newContext({
          baseURL: 'http://localhost:3000',
          viewport: options.viewport,
          deviceScaleFactor: options.deviceScaleFactor,
          isMobile: options.isMobile,
          hasTouch: options.hasTouch,
        });
        await provide(context);
        await browser.close();
      },
    })
  : base;
const db = new PrismaClient();
const password = 'Ephemeral-browser-test-only-238';
async function register(request: import('@playwright/test').APIRequestContext, name: string) {
  const email = `e2e-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const r = await request.post('/api/auth/register', {
    headers: { origin: 'http://localhost:3000' },
    data: { name: 'Browser Test', email, password },
  });
  expect(r.ok()).toBe(true);
  return email;
}
async function openNav(page: import('@playwright/test').Page) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
}
test.afterAll(async () => {
  const users = await db.user.findMany({
    where: { email: { startsWith: 'e2e-' } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await db.communityIssue.deleteMany({ where: { authorId: { in: ids } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
test('public pilot, location search, languages, themes and mobile layout', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A clearer view of your community.' }),
  ).toBeVisible();
  await expect(page.locator('.location-label')).toContainText('Auburn');
  await page.getByLabel('Find your community', { exact: true }).fill('99999');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No supported location');
  await page.getByLabel('Find your community', { exact: true }).fill('68305');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('.search-results button').click();
  await page.getByRole('button', { name: 'Cambiar a español' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tu comunidad, más clara que nunca.' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Tu comunidad, más clara que nunca.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar tema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: path.join('docs/screenshots', `${info.project.name}-spanish-dark.png`),
    fullPage: true,
  });
});
test('official election sources, no invented candidates and isolated demo comparison', async ({
  page,
}) => {
  await page.goto('/elections');
  await expect(page.getByRole('heading', { name: 'Nebraska General Election 2026' })).toBeVisible();
  await expect(page.getByText('Candidate information is pending verification.')).toBeVisible();
  await expect(page.locator('a[href="https://sos.nebraska.gov/elections"]').first()).toBeVisible();
  await page.goto('/compare?org=demo');
  await expect(page.getByRole('heading', { name: 'Demo Candidate A (fictional)' })).toBeVisible();
  await expect(page.locator('.demo-banner')).toContainText('Fictional demonstration');
  await page.getByRole('button', { name: 'Infrastructure', exact: true }).click();
  await expect(
    page.getByText('Fictional proposal: publish a quarterly street-maintenance schedule.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
});
test('calculator validates inputs and produces tested scenarios', async ({ page }) => {
  await page.goto('/impact');
  await expect(page.getByText('$2,000.00', { exact: true })).toBeVisible();
  await expect(page.getByText('+$200.00', { exact: true })).toBeVisible();
  await page.getByLabel('Proposed hypothetical rate (%)').fill('0.5');
  await expect(page.getByText('-$1,000.00', { exact: true })).toBeVisible();
  await page.getByLabel('Current hypothetical rate (%)').fill('-1');
  await expect(page.locator('.calculation-results [role=alert]')).toContainText('Enter valid');
});
test('citizen submits report, owns private group and exports account', async ({ page }) => {
  await register(page.request, 'citizen');
  await page.goto('/community');
  await page.getByRole('button', { name: 'Report an issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Fictional browser report');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Fictional browser testing description with no personal information.');
  await page.getByLabel('Approximate public location').fill('Fictional public intersection');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.report-form')).toHaveCount(0);
  await page.goto('/groups');
  await page.getByLabel('Display name', { exact: true }).fill('Fictional browser group');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fictional browser group' })).toBeVisible();
  await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
  await expect(page.getByLabel('Create invitation', { exact: true })).toHaveValue(/#invite=/);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Browser Test' })).toBeVisible();
  const exported = await page.request.get('/api/account/export');
  expect(exported.ok()).toBe(true);
  expect(await exported.text()).not.toContain('passwordHash');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
});
test('administrator dashboard is real and role checks apply on server', async ({ page }) => {
  const email = await register(page.request, 'admin');
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.organizationMembership.create({
    data: { userId: user.id, organizationId: 'org-apomatch', roleId: 'super-admin' },
  });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editorial content', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add content' })).toBeVisible();
  await page.getByRole('button', { name: 'Moderation', exact: true }).click();
  await page.getByRole('button', { name: 'Audit', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  const foreign = await page.request.get('/api/admin/dashboard?org=demo');
  expect(foreign.status()).toBe(403);
});
test('public pages meet automated WCAG checks and screenshots show running application', async ({
  page,
}, info) => {
  await page.goto('/?org=demo');
  await expect(
    page.getByRole('heading', { name: 'A clearer view of your community.' }),
  ).toBeVisible();
  await expect(page.locator('.stat-value').first()).toHaveText('03');
  await page.screenshot({
    path: path.join('docs/screenshots', `${info.project.name}-overview.png`),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await openNav(page);
  await page.getByRole('link', { name: 'BarrioDecide', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fictional street maintenance request' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
