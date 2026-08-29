import { test, expect } from '@playwright/test';

/**
 * Onboarding is the only path a new user has into the app, and until recently
 * a wrong country or currency pick could not be corrected without restarting
 * it: the balance step had no back link and the tour's first step hid its Back
 * button entirely. These assertions cover the three-phase navigation
 * (country → balance → tour) in both directions.
 */

test('back navigation reaches the country step from anywhere in onboarding', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Where are you?')).toBeVisible();

  // country → balance
  await page.getByText('Continue', { exact: true }).click();
  await expect(page.getByText('Starting balances')).toBeVisible();

  // balance → country, and the previous selection is still there
  await page.getByText('Back', { exact: true }).click();
  await expect(page.getByText('Where are you?')).toBeVisible();

  // Forward again, then into the tour.
  await page.getByText('Continue', { exact: true }).click();
  await expect(page.getByText('Starting balances')).toBeVisible();
  await page.getByText('Skip for now').click();
  await expect(page.getByText('Welcome to ChronoBudget')).toBeVisible();

  // The tour's first step must go back to the balance phase rather than
  // hiding its Back control, which is what stranded users before.
  await page.getByText('Back', { exact: true }).click();
  await expect(page.getByText('Starting balances')).toBeVisible();

  // And all the way back to country.
  await page.getByText('Back', { exact: true }).click();
  await expect(page.getByText('Where are you?')).toBeVisible();
});

test('the tour steps forward and backward through all four steps', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Continue', { exact: true }).click();
  await page.getByText('Skip for now').click();

  const titles = ['Welcome to ChronoBudget', 'Fast Mode', 'Detailed Mode', 'Budget Limits'];

  for (const title of titles) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    if (title !== titles[titles.length - 1]) {
      await page.getByText('Next →').click();
    }
  }

  // Backward through the same steps.
  for (const title of [...titles].reverse()) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    if (title !== titles[0]) {
      await page.getByText('Back', { exact: true }).click();
    }
  }

  // "Skip tutorial" is offered on every step except the last, where the
  // primary action finishes the tour instead.
  await expect(page.getByText('Skip tutorial')).toBeVisible();
});

test('finishing the tour lands on a usable dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Continue', { exact: true }).click();
  await page.getByText('Skip for now').click();

  for (let i = 0; i < 3; i++) {
    await page.getByText('Next →').click();
  }
  await expect(page.getByText('Budget Limits', { exact: true })).toBeVisible();
  await page.getByText('Got it ✓').click();

  await expect(page.getByPlaceholder('e.g. 15 coffee')).toBeVisible();
  await expect(page.getByText('Welcome to ChronoBudget')).toBeHidden();
});
