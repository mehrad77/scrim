import { expect, test } from '@playwright/test';
import { seedShow } from './fixtures.js';

test('the run log says which rule ran and why the others were skipped', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  const standby = page.locator('[data-standby="true"]');
  await expect(standby).toContainText('Red up');
  await page.keyboard.press('Space');
  await expect(standby).toContainText('Vote');
  await page.waitForTimeout(400); // past the double-GO guard
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Close now' }).click();

  await page.getByRole('tab', { name: 'Log' }).click();
  await expect(page.getByText('Rule “left” ran: door is Left ✓')).toBeVisible();
  await page.getByText('1 rule skipped').click();
  await expect(page.getByText('“right”: door is Right ✗ (it was Left)')).toBeVisible();
});

test('interaction shows every outcome and flags an unhandled option', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'interaction'));
  await page.goto(`/show/${showId}`);

  const outcomes = page.getByRole('region', { name: 'Try every outcome' });
  await expect(outcomes).toContainText('Left · cue 3 “Left scene”');
  await expect(outcomes).toContainText('Right · cue 4 “Right scene”');
  await expect(page.getByRole('tab', { name: /Interaction/ })).not.toContainText(/\d/);

  await page.getByRole('button', { name: 'Option', exact: true }).click();
  await expect(page.getByText(/Option C: unhandled/)).toBeVisible();
  await expect(page.getByRole('tab', { name: /Interaction/ })).toContainText('1');
  await page.getByRole('button', { name: 'Handle it' }).click();
  await expect(page.getByText(/Option C: unhandled/)).toHaveCount(0);
});

test('rehearse from here opens the operator at that cue', async ({ page, context }) => {
  const { showId } = await seedShow(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'cues'));
  await page.goto(`/show/${showId}`);
  await page.getByRole('row', { name: /Right scene/ }).click();
  await page.getByRole('button', { name: 'More for this cue' }).click();
  const [operator] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('menuitem', { name: 'Rehearse from here' }).click(),
  ]);
  await expect(operator.getByText(/Rehearsing from “Right scene”/)).toBeVisible();
  await expect(operator.locator('[data-standby="true"]')).toContainText('Right scene');
});
