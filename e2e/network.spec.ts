import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * "No backend, no account, your data never leaves your device" is a store
 * listing claim, a privacy-policy claim and a Play data-safety declaration.
 *
 * scripts/check-release-config.ts greps app source for networking primitives;
 * this catches the same thing from the other side, by watching what the app
 * actually requests while a full session is driven. Neither is a substitute
 * for the on-device proxy capture in T-SEC-01 — this runs against the web
 * build, which is a different bundle from the shipped native app — but it does
 * hold the line against a dependency quietly phoning home.
 */

test('a full session makes no requests to any external origin', async ({ page }) => {
  const external: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    // The dev server itself, plus the schemes a bundled asset legitimately uses.
    const isLocal =
      url.startsWith('http://localhost:') ||
      url.startsWith('http://127.0.0.1:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:');
    if (!isLocal) external.push(`${request.method()} ${url}`);
  });

  await completeOnboarding(page);

  // Exercise the surfaces most likely to reach for the network: locale and
  // currency formatting, the classifier, and every modal.
  await page.getByPlaceholder('e.g. 15 coffee').fill('15 coffee');
  await page.getByText('Add').click();
  await expect(page.getByText('$15.00').first()).toBeVisible();

  await page.getByTestId('open-settings').click();
  await expect(page.getByText('Language', { exact: true })).toBeVisible();
  await page.getByText('Done', { exact: true }).click();

  await page.getByText('Detailed', { exact: true }).click();
  await expect(page.getByText('Groceries').first()).toBeVisible();

  await page.getByRole('tab', { name: 'History' }).click();
  await page.getByRole('tab', { name: 'Trends' }).click();
  await expect(page.getByText('Last 6 months')).toBeVisible();

  expect(external).toEqual([]);
});
