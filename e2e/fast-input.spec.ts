import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * Fast mode parses one free-text field into an amount, a category and a note.
 * Three of the assertions here are regressions: the typed description used to
 * be discarded rather than saved as the note, a manual override used to stick
 * across unrelated entries, and the override panel used to need a separate
 * "change" button instead of tapping the preview itself.
 */

test('parses free text into an amount and a category, and keeps the description', async ({ page }) => {
  await completeOnboarding(page);

  await page.getByPlaceholder('e.g. 15 coffee').fill('15 coffee');
  // The classifier previews its guess before the entry is committed.
  await expect(page.getByText('Dining').first()).toBeVisible();

  await page.getByText('Add').click();
  await expect(page.getByText('$15.00').first()).toBeVisible();

  // Regression: the leftover text after the amount is saved as the note
  // instead of being thrown away once it has been used for classification.
  await page.getByText('Dining').first().click();
  await expect(page.getByTestId('edit-amount-input')).toHaveValue('15');
  await expect(page.getByPlaceholder('Add a note (optional)')).toHaveValue('coffee');
  await page.getByText('Cancel', { exact: true }).click();
});

test('tapping the preview reveals the override chips, and clearing the field resets them', async ({ page }) => {
  await completeOnboarding(page);
  const field = page.getByPlaceholder('e.g. 15 coffee');

  await field.fill('15 coffee');
  await expect(page.getByText('Dining').first()).toBeVisible();

  // The preview text itself is the control — there is deliberately no separate
  // pencil or "change" button, matching every other chip in the app.
  await page.getByText('Dining').first().click();
  // The panel leads with category chips; picking one re-classifies the entry.
  await expect(page.getByText('Needs', { exact: true }).first()).toBeVisible();
  await page.getByText('Needs', { exact: true }).first().click();

  // Regression: clearing the field back to empty is the "new entry" signal, so
  // the override must not leak into whatever is typed next.
  await field.fill('');
  await field.fill('15 coffee');
  await expect(page.getByText('Dining').first()).toBeVisible();
});

test('rejects amounts that are empty, zero or non-numeric', async ({ page }) => {
  await completeOnboarding(page);
  const field = page.getByPlaceholder('e.g. 15 coffee');

  for (const bad of ['', '0', 'abc']) {
    await field.fill(bad);
    await page.getByText('Add').click();
    // Nothing is committed, and the empty state stands.
    await expect(page.getByText('No transactions yet')).toBeVisible();
  }
});

test('the input mode toggle switches between Fast and Detailed', async ({ page }) => {
  await completeOnboarding(page);

  await page.getByText('Detailed', { exact: true }).click();
  // Detailed mode exposes the subcategory chips that Fast mode hides.
  await expect(page.getByText('Groceries').first()).toBeVisible();

  await page.getByText('Fast', { exact: true }).click();
  await expect(page.getByPlaceholder('e.g. 15 coffee')).toBeVisible();
});
