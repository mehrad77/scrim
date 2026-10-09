import { expect, test } from '@playwright/test';
import { layerOpacity, seedShow } from './fixtures.js';

test('an installation keeps opening hours, takes keys, and carries on after a reload', async ({
  page,
}) => {
  // Monday 18:00: the gallery is closed.
  await page.clock.install({ time: new Date('2026-10-12T18:00:00') });
  const { showId } = await seedShow(page);
  await page.evaluate(async (id) => {
    const shows = await import('/src/storage/shows.ts' as string);
    const show = await shows.getShow(id);
    show.vars.push({
      id: 'opening',
      name: 'opening',
      type: 'choice',
      initial: '',
      options: ['open', 'closed'],
    });
    show.schedule = {
      varId: 'opening',
      periods: [{ days: [1, 2, 3, 4, 5], from: 600, to: 1020, value: 'open' }],
      otherwise: 'closed',
    };
    // Open: the caption is up; closed: it goes.
    for (const [value, type] of [
      ['open', 'show'],
      ['closed', 'hide'],
    ])
      show.rules.push({
        id: `hours-${value}`,
        name: `Gallery ${value}`,
        enabled: true,
        when: { type: 'varChanged', varId: 'opening' },
        if: [{ varId: 'opening', op: 'eq', value }],
        then: [{ type, layerId: 'lyr_txt', duration: 0, easing: 'linear' }],
      });
    await shows.saveShow(show);
  }, showId);

  await page.goto(`/kiosk/${showId}`);
  await expect(page.locator('[data-layer="lyr_txt"]')).toBeAttached();
  await expect.poll(() => layerOpacity(page, 'lyr_txt')).toBe(0);

  // Keys run the show: Space is GO ("Red up" shows the picture).
  await page.keyboard.press('Space');
  await expect.poll(() => layerOpacity(page, 'lyr_img')).toBe(1);

  // A power cut: the page comes back where it was.
  await page.clock.runFor(2000);
  await page.reload();
  await expect.poll(() => layerOpacity(page, 'lyr_img')).toBe(1);

  // Tuesday 10:00 the gallery opens, and the caption comes back by itself.
  await page.clock.fastForward('16:00:00');
  await page.clock.runFor(6000);
  await expect.poll(() => layerOpacity(page, 'lyr_txt')).toBe(1);
});

test('taking over from the operator view stops the installation', async ({ page, context }) => {
  const { showId } = await seedShow(page);
  await page.goto(`/kiosk/${showId}`);
  await expect(page.locator('[data-layer="lyr_txt"]')).toBeAttached();
  const staff = await context.newPage();
  await staff.goto(`/show/${showId}/run`);
  const take = staff.getByRole('button', { name: /take over/ });
  const box = (await take.boundingBox())!;
  await staff.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await staff.mouse.down();
  await staff.waitForTimeout(1200);
  await staff.mouse.up();
  await expect(staff.getByRole('heading', { name: 'E2E show' })).toBeVisible();
  await expect(page.getByText(/was taken over in another tab/)).toBeVisible();
  await expect(page.locator('[data-layer="lyr_txt"]')).toHaveCount(0);
});
