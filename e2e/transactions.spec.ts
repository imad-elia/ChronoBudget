import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('adds, edits, and deletes a transaction via the dashboard', async ({ page }) => {
  await completeOnboarding(page);

  // Add a fast-mode transaction.
  await page.getByPlaceholder('e.g. 15 coffee').fill('15 coffee');
  await page.getByText('Add').click();

  await expect(page.getByText('$15.00').first()).toBeVisible();
  await expect(page.getByText('Dining')).toBeVisible();

  // Tap the row to open the edit modal and change the amount.
  await page.getByText('Dining').click();
  const amountInput = page.getByTestId('edit-amount-input');
  await expect(amountInput).toHaveValue('15');
  await amountInput.fill('25');
  await page.getByText('Save').click();
  await expect(amountInput).toBeHidden();

  await expect(page.getByText('$25.00').first()).toBeVisible();

  // Reopen and delete.
  await page.getByText('Dining').click();
  await expect(amountInput).toHaveValue('25');
  await page.getByTestId('delete-transaction').click();

  await expect(page.getByText('No transactions yet')).toBeVisible();
  await expect(page.getByText('$0.00').first()).toBeVisible();
});
