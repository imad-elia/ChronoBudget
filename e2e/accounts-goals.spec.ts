import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * Accounts and goals both keep running totals maintained by application code
 * rather than derived on read, so every path that touches them has to be right.
 * The unit suite covers the SQL; this covers the wiring — that the dashboard
 * rows appear only once there is something to show, and that tagging a
 * transaction actually moves the numbers a user sees.
 */

/** Taps well outside any bottom sheet to dismiss the topmost one. */
async function closeSheetViaBackdrop(page: Page): Promise<void> {
  await page.mouse.click(5, 5);
}

async function openSettingsSection(page: Page, label: string): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByText(label, { exact: true }).click();
}

test('an account appears on the dashboard only once it exists, and is debited by a tagged transaction', async ({ page }) => {
  await completeOnboarding(page);

  // Hidden entirely when there are no accounts — not an empty row with a heading.
  await expect(page.getByText('Checking', { exact: true })).toBeHidden();

  await openSettingsSection(page, 'Accounts');
  await page.getByText('Add account').click();
  await page.getByPlaceholder('e.g. Checking').fill('Checking');
  // Several sheets carry a 0.00 amount field and stay mounted once opened, so
  // target the most recently rendered one.
  await page.getByPlaceholder('0.00').last().fill('1200');
  await page.getByText('Save account').click();

  await expect(page.getByText('$1,200.00').first()).toBeVisible();
  await closeSheetViaBackdrop(page);
  await page.getByText('Done', { exact: true }).last().click();

  // Now visible on the dashboard.
  await expect(page.getByText('Checking', { exact: true }).first()).toBeVisible();

  // Tag a transaction to it and the balance moves by exactly that amount.
  await page.getByText('Detailed', { exact: true }).click();
  await page.getByPlaceholder('0.00').first().fill('45');
  await page.getByText('Groceries', { exact: true }).first().click();
  await page.getByText('Checking', { exact: true }).last().click();
  await page.getByText('Add', { exact: true }).click();

  await expect(page.getByText('$1,155.00').first()).toBeVisible();
});

test('a goal is created empty and surfaces on the dashboard', async ({ page }) => {
  await completeOnboarding(page);

  await expect(page.getByText('Car repair fund', { exact: true })).toBeHidden();

  await openSettingsSection(page, 'Goals');
  await page.getByText('Add goal').click();
  await page.getByPlaceholder('e.g. Car repair fund').fill('Car repair fund');
  await page.getByPlaceholder('Target amount').fill('2000');
  await page.getByText('Save goal').click();

  // Starts empty: progress only ever comes from tagged transactions, and the
  // form deliberately offers no way to type a current amount.
  await expect(page.getByText('$0.00 / $2,000.00')).toBeVisible();
  await closeSheetViaBackdrop(page);
  await page.getByText('Done', { exact: true }).last().click();

  // The dashboard goals row appears now that there is one to show.
  await expect(page.getByText('Car repair fund', { exact: true }).first()).toBeVisible();

  // Note: tagging a Savings transaction to a goal and the resulting
  // delete-blocked path are covered against real SQL in
  // db/__tests__/database.test.ts. Driving the chip picker through the web
  // renderer added selector churn without adding coverage, so it stays in the
  // manual plan as GOAL-02 / GOAL-06.
});

test('rejects a goal with a non-positive target', async ({ page }) => {
  await completeOnboarding(page);

  await openSettingsSection(page, 'Goals');
  await page.getByText('Add goal').click();
  await page.getByPlaceholder('e.g. Car repair fund').fill('Bad goal');
  await page.getByPlaceholder('Target amount').fill('0');
  await page.getByText('Save goal').click();

  // Blocked in the UI, before the DB-layer guard is ever reached.
  await expect(page.getByPlaceholder('Target amount')).toBeVisible();
  await expect(page.getByText('Bad goal', { exact: true })).toBeHidden();
});
