import { expect, test } from '@playwright/test';
import { seedShow } from './fixtures.js';

test('Map mode assigns a key on the real operator view', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await page.getByRole('button', { name: /^Map keys/ }).click();
  await page.getByRole('button', { name: /^Map a key to Hold/ }).click();
  await page.keyboard.press('j');
  await expect(page.getByText('J now does Hold')).toBeVisible();

  // A key that already does something asks first.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText(/already does Next cue on standby/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.keyboard.press('j');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
});

test('the palette finds and runs editor commands', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'stage'));
  await page.goto(`/show/${showId}`);
  await expect(page.getByRole('tab', { name: 'Stage' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('searchbox', { name: 'Search commands' }).fill('interac');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: /Interaction/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
