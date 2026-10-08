import { expect, test } from '@playwright/test';
import { seedShow } from './fixtures.js';

const standbyRow = (page: import('@playwright/test').Page) => page.locator('[data-standby="true"]');

test('Esc fires PANIC even with a dialog open, and the dialog stays', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await page.getByRole('button', { name: 'Reset' }).click();
  const dialog = page.getByRole('dialog', { name: /Reset to the top/ });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Blacked out/ })).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('GO still fires after picking a value from a select', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await expect(standbyRow(page)).toContainText('Red up');

  await page.getByRole('tab', { name: 'State' }).click();
  await page.locator('main [data-select-trigger]').first().click();
  await page.getByRole('option', { name: 'right' }).click();
  await page.keyboard.press('Space');
  await expect(standbyRow(page)).toContainText('Vote');
});

test('operator messages never move GO', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await expect(standbyRow(page)).toContainText('Red up');
  await page.keyboard.press('Space');
  await expect(standbyRow(page)).toContainText('Vote');
  await page.waitForTimeout(500); // let the journal write land before the reload
  await page.reload();
  const message = page.getByText(/Resumed where the show left off/);
  await expect(message).toBeVisible();

  const go = page.getByRole('button', { name: /^GO\b/ });
  const before = await go.boundingBox();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(message).toBeHidden();
  expect(await go.boundingBox()).toEqual(before);
});

test('Esc fires PANIC with a select popover open in the operator', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await page.getByRole('tab', { name: 'State' }).click();
  await page.locator('main [data-select-trigger]').first().click();
  await expect(page.getByRole('option', { name: 'right' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Blacked out/ })).toBeVisible();
});
