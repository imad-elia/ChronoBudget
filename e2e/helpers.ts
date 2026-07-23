import { expect, type Page } from '@playwright/test';

// Web uses an in-memory DB (see vault/Decisions/web-inmemory-db.md), so every
// fresh page load starts with onboarding — no seeding/teardown needed between
// specs, just walk the flow once per test.
export async function completeOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Where are you?')).toBeVisible();
  await page.getByText('Continue', { exact: true }).click();

  await expect(page.getByText('Starting balances')).toBeVisible();
  await page.getByText('Skip for now').click();

  await expect(page.getByText('Welcome to ChronoBudget')).toBeVisible();
  await page.getByText('Skip tutorial').click();

  await expect(page.getByPlaceholder('e.g. 15 coffee')).toBeVisible();
}
