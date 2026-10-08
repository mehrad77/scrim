import { expect, test } from '@playwright/test';
import { seedShow } from './fixtures.js';

const standbyRow = (page: import('@playwright/test').Page) => page.locator('[data-standby="true"]');

test('Esc fires PANIC even with a dialog open, and the dialog stays', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await page.getByRole('button', { name: 'Pre-show check' }).click();
  const dialog = page.locator('dialog[open]');
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

test('nothing animates in Show mode after GO', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await expect(standbyRow(page)).toContainText('Red up');
  await page.getByRole('button', { name: 'Show mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.keyboard.press('Space');
  await expect(standbyRow(page)).toContainText('Vote');
  // The press echo and colour changes take 100 ms; after that nothing may keep moving.
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().length), { timeout: 2000 })
    .toBe(0);
});

test('no banner or toast ever covers GO or PANIC', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await expect(standbyRow(page)).toContainText('Red up');
  await page.keyboard.press('Space');
  await expect(standbyRow(page)).toContainText('Vote');
  await page.waitForTimeout(500); // let the journal write land before the reload
  await page.reload();
  await expect(page.getByText(/Resumed where the show left off/)).toBeVisible();
  // An error toast stays until dismissed: the worst case.
  await page.evaluate(async () => {
    const { toast } = await import('/src/ui/toast.tsx' as string);
    toast('Output “Main stage” lost its connection. Reopen it from the outputs panel.', 'error');
  });
  await expect(page.getByText(/lost its connection/)).toBeVisible();

  for (const control of [
    page.getByRole('button', { name: /^GO\b/ }),
    page.getByRole('button', { name: /PANIC/ }),
  ]) {
    const box = (await control.boundingBox())!;
    const points = [0.05, 0.3, 0.5, 0.7, 0.95].flatMap((fx) =>
      [0.1, 0.5, 0.9].map((fy) => [box.x + box.width * fx, box.y + box.height * fy]),
    );
    const covered = await control.evaluate(
      (el, pts) => pts.filter(([x, y]) => !el.contains(document.elementFromPoint(x!, y!))).length,
      points,
    );
    expect(covered).toBe(0);
  }
});
