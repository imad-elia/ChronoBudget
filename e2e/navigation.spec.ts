import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('a transaction shows up in History, and Trends renders with no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await completeOnboarding(page);
  await page.getByPlaceholder('e.g. 15 coffee').fill('15 coffee');
  await page.getByText('Add').click();
  await expect(page.getByText('$15.00').first()).toBeVisible();

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('Dining').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Trends' }).click();
  await expect(page.getByText('Last 6 months')).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
