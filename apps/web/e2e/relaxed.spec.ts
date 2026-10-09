import { devices, expect, test, type Page } from '@playwright/test';
import { layerOpacity, seedShow } from './fixtures.js';

/** How dark a relaxed performance makes the output: 0 off, 0.3 at the default 70%. */
const dimming = (page: Page) =>
  page
    .locator('[data-relaxed-dim]')
    .evaluate((el) => Number(getComputedStyle(el as HTMLElement).opacity));

test('a relaxed performance dims the output, leaves out intense layers and tells phones', async ({
  page,
  context,
  browser,
}) => {
  const { showId, outputId } = await seedShow(page);
  await page.evaluate(async (id) => {
    const shows = await import('/src/storage/shows.ts' as string);
    const show = await shows.getShow(id);
    show.layers.find((l: { id: string }) => l.id === 'lyr_img').intense = true;
    await shows.saveShow(show);
  }, showId);
  await page.goto(`/show/${showId}/run`);
  const output = await context.newPage();
  await output.goto(`/output/${showId}/${outputId}`);
  await expect(output.locator('[data-layer="lyr_txt"]')).toBeAttached();
  expect(await dimming(output)).toBe(0);

  await page.bringToFront();
  await page.getByRole('button', { name: 'Open audience room' }).click();
  await expect(page.getByTestId('room-code').first()).toHaveText(/^[A-Z2-9]{5}$/);
  const url = await page.evaluate(async (id) => {
    const room = await import('/src/host/room.ts' as string);
    return room.audienceUrl(await room.storedRoom(id));
  }, showId);
  const phoneContext = await browser.newContext({ ...devices['iPhone 13'] });
  const phone = await phoneContext.newPage();
  await phone.goto(url);
  await expect(phone.getByText('Watch the stage')).toBeVisible();
  await expect(phone.getByRole('status')).toHaveCount(0);

  const relaxed = page.getByRole('button', { name: 'Relaxed', exact: true });
  await relaxed.click();
  await expect(relaxed).toHaveAttribute('aria-pressed', 'true');
  // It eases in over two seconds, so nobody sees a jump.
  await expect.poll(() => dimming(output), { timeout: 5000 }).toBeCloseTo(0.3, 2);
  await expect(phone.getByRole('status')).toContainText('Relaxed performance');
  await expect(phone.getByRole('status')).toContainText('It’s OK to step out');

  // "Red up" shows the picture, which is marked intense: it stays off.
  await page.keyboard.press('Space');
  await page.getByRole('tab', { name: 'Log' }).click();
  const log = page.locator('section', { has: page.getByRole('heading', { name: 'Run log' }) });
  await expect(log.getByText('Relaxed: left out “Red”')).toBeVisible();
  expect(await layerOpacity(output, 'lyr_img')).toBe(0);

  // In Show mode it takes a deliberate hold to end it.
  await page.getByRole('button', { name: 'Show mode' }).click();
  const end = page.getByRole('button', { name: /end the relaxed performance/ });
  const box = (await end.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await expect.poll(() => dimming(output), { timeout: 5000 }).toBe(0);
  await expect(phone.getByRole('status')).toHaveCount(0);
  await phoneContext.close();
});
