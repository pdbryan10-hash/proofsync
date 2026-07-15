import { test, expect } from '@playwright/test';

/**
 * Key end-to-end workflow (§30): open the hero job, trigger a sync, and confirm
 * it completes. Requires a seeded database and the dev server (Playwright starts
 * it via webServer in playwright.config.ts).
 *
 *   npm run db:reset
 *   npm run test:e2e
 */
test('sync a job from Jobs list through to completion', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();

  // Open the hero job CON-284731.
  await page.getByText('CON-284731').first().click();
  await expect(page.getByText('Riverside House, Nottingham').first()).toBeVisible();

  // Trigger the sync.
  await page.getByRole('button', { name: /Sync to Concerto/i }).click();

  // Wait for the success summary.
  await expect(page.getByText(/Sync (complete|partially complete)/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Fields updated/i)).toBeVisible();
});
