import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * The runtime net under the frozen-label bug class.
 *
 * t() resolves against a module-level variable rather than a reactive store
 * field, so any screen that computes a label at import time keeps rendering the
 * locale that was active when it first loaded. That has shipped seven times.
 * scripts/check-frozen-i18n.ts catches the structural cause; this spec catches
 * the symptom on the surfaces a user actually sees, including any route to the
 * bug the static check cannot model.
 *
 * The sweep switches language once and then visits every surface, rather than
 * reloading between them — reloading would mask exactly the bug being hunted.
 */

async function switchToFrench(page: Page): Promise<void> {
  await page.getByTestId('open-settings').click();
  await expect(page.getByText('Language', { exact: true })).toBeVisible();
  await page.getByText('Français', { exact: true }).click();
  // The settings sheet itself is the first thing that must react.
  await expect(page.getByText('Paramètres').first()).toBeVisible();
  await page.getByText('Terminé', { exact: true }).click();
}

test('every surface follows a live language switch without a reload', async ({ page }) => {
  await completeOnboarding(page);

  // Seed one transaction so the lists and edit modal have something to render.
  await page.getByPlaceholder('e.g. 15 coffee').fill('15 coffee');
  await page.getByText('Add').click();
  await expect(page.getByText('Dining')).toBeVisible();

  await switchToFrench(page);

  // ── Dashboard ────────────────────────────────────────────────────────────
  // React Native Web keeps closed Modals mounted, so these labels can also
  // exist inside a hidden sheet — assert on the first visible match.
  await expect(page.getByText('DÉPENSE CE MOIS')).toBeVisible();
  await expect(page.getByText('BESOINS').first()).toBeVisible();
  await expect(page.getByText('ENVIES').first()).toBeVisible();
  await expect(page.getByText('ÉPARGNE').first()).toBeVisible();

  // Subcategory labels on the recent-transaction row are translated for
  // display while the stored value stays canonical English.
  await expect(page.getByText('Restaurants').first()).toBeVisible();

  // ── Tab bar ──────────────────────────────────────────────────────────────
  // Regression: this used to subscribe to `symbol`, which does not change on a
  // language-only switch, so the labels stayed English until a reload.
  await expect(page.getByRole('tab', { name: 'Tableau de bord' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'HISTORIQUE' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'TENDANCES' })).toBeVisible();

  // ── Input, both modes ────────────────────────────────────────────────────
  await expect(page.getByText('Rapide', { exact: true })).toBeVisible();
  await expect(page.getByText('Détaillé', { exact: true })).toBeVisible();
  await page.getByText('Détaillé', { exact: true }).click();
  await expect(page.getByText('Loyer', { exact: true })).toBeVisible();
  await expect(page.getByText('Courses', { exact: true })).toBeVisible();
  await page.getByText('Rapide', { exact: true }).click();

  // ── Edit modal ───────────────────────────────────────────────────────────
  // The exact surface a user reported: categories and subcategories stayed
  // English here after both had been translated everywhere else.
  await page.getByText('Restaurants').first().click();
  await expect(page.getByTestId('edit-amount-input')).toBeVisible();
  await expect(page.getByText('Envies', { exact: true }).first()).toBeVisible();
  // React Native Web modals do not close on Escape — use the sheet's own control.
  await page.getByText('Annuler', { exact: true }).click();
  await expect(page.getByTestId('edit-amount-input')).toBeHidden();

  // ── History and Trends ───────────────────────────────────────────────────
  await page.getByRole('tab', { name: 'HISTORIQUE' }).click();
  await expect(page.getByText('Restaurants').first()).toBeVisible();

  await page.getByRole('tab', { name: 'TENDANCES' }).click();
  await expect(page.getByText('6 derniers mois')).toBeVisible();

  // ── Settings sub-screens ─────────────────────────────────────────────────
  await page.getByRole('tab', { name: 'Tableau de bord' }).click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByText('Pays').first()).toBeVisible();
  await expect(page.getByText('Comptes', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Objectifs', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Mes mots-clés').first()).toBeVisible();
});

test('an explicit language choice survives a later country change', async ({ page }) => {
  await completeOnboarding(page);
  await switchToFrench(page);

  // Change country (and therefore currency) without touching language.
  await page.getByTestId('open-settings').click();
  // The country picker is a collapsed dropdown — expand it via the current
  // selection row before the list exists.
  await page.getByText('United States', { exact: true }).click();
  await page.getByText('France', { exact: true }).click();

  // Currency follows the country; the UI language stays as explicitly chosen.
  await expect(page.getByText('Paramètres')).toBeVisible();
  await page.getByText('Terminé', { exact: true }).click();
  await expect(page.getByText('DÉPENSE CE MOIS')).toBeVisible();
});
