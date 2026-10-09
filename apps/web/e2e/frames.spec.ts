import { expect, test, type Page } from '@playwright/test';
import { seedFrames } from './fixtures.js';

const rect = (page: Page, id: string) =>
  page.locator(`[data-layer="${id}"]`).evaluate((el) => el.getBoundingClientRect().toJSON());
const visibility = (page: Page, id: string) =>
  page.locator(`[data-layer="${id}"]`).evaluate((el) => getComputedStyle(el).visibility);

test('frames hide and show their content, and hugging frames grow away from their pin', async ({
  page,
  context,
}) => {
  const { showId, outputId } = await seedFrames(page);
  await page.goto(`/show/${showId}/run`);
  await expect(page.getByText('Standby', { exact: true })).toBeVisible();
  const output = await context.newPage();
  await output.goto(`/output/${showId}/${outputId}`);
  await expect(output.locator('[data-layer="cap"]')).toBeAttached();

  // The caption is on, but its frame is hidden, so it is too.
  await expect.poll(() => visibility(output, 'cap')).toBe('hidden');
  const before = {
    l: await rect(output, 'fl'),
    r: await rect(output, 'fr'),
    c: await rect(output, 'fc'),
  };

  await page.bringToFront();
  await page.keyboard.press('Space');
  await expect.poll(() => visibility(output, 'cap')).toBe('visible');

  await page.waitForTimeout(400); // past the double-GO guard
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await rect(output, 'fl')).width)
    .toBeGreaterThan(before.l.width + 50);
  const after = {
    l: await rect(output, 'fl'),
    r: await rect(output, 'fr'),
    c: await rect(output, 'fc'),
  };

  // Pinned left: the left edge stays. Pinned right: the right edge stays. Centred: both move out.
  expect(after.l.left).toBeCloseTo(before.l.left, 0);
  expect(after.r.right).toBeCloseTo(before.r.right, 0);
  expect(after.r.left).toBeLessThan(before.r.left - 50);
  const grew = after.c.width - before.c.width;
  expect(grew).toBeGreaterThan(50);
  expect(before.c.left - after.c.left).toBeCloseTo(grew / 2, 0);
  expect(after.c.right - before.c.right).toBeCloseTo(grew / 2, 0);
});
