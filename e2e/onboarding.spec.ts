import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('walks the onboarding flow and lands on an empty dashboard', async ({ page }) => {
  await completeOnboarding(page);

  await expect(page.getByText('SPENT THIS MONTH')).toBeVisible();
  await expect(page.getByText('No transactions yet')).toBeVisible();
  await expect(page.getByText('$0.00').first()).toBeVisible();
});
