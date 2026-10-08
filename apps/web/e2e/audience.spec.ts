import { devices, expect, test } from '@playwright/test';
import { seedShow } from './fixtures.js';

test('an audience vote branches the show', async ({ page, browser }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await page.getByRole('button', { name: 'Open audience room' }).click();
  const code = (await page.locator('.tracking-widest').first().textContent())?.trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);

  // Fire "Red up", then "Vote".
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await expect(page.getByText('OPEN', { exact: true })).toBeVisible();

  const phoneContext = await browser.newContext({ ...devices['iPhone 13'] });
  const phone = await phoneContext.newPage();
  await phone.goto(`/audience.html?r=${code}&relay=${encodeURIComponent('http://localhost:8790')}`);
  await phone.getByRole('button', { name: 'Right' }).click();
  await expect(phone.getByText(/Vote counted/)).toBeVisible();

  // The tally reaches the operator, then closing the vote branches.
  await expect(page.locator('.font-mono.w-8').nth(1)).toHaveText('1');
  await page.getByRole('button', { name: 'Close now' }).click();
  await expect(page.getByText('Right scene').first()).toBeVisible();
  await expect(page.locator('[data-standby="true"]')).toContainText('Right scene');
  await expect(phone.getByText(/Thank you|Watch the stage/)).toBeVisible();
  await phoneContext.close();
});
