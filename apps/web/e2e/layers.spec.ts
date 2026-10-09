import { expect, test } from '@playwright/test';
import { seedFrames } from './fixtures.js';

test('the layers tree nests frames, folds them, and restacks among siblings', async ({ page }) => {
  const { showId } = await seedFrames(page);
  await page.goto(`/show/${showId}`);
  await page.getByRole('tab', { name: 'Stage' }).click();
  const tree = page.getByRole('treegrid', { name: 'Layers, front first' });
  const rows = () =>
    tree.getByRole('row').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

  await expect(tree.getByRole('row', { name: 'lt' })).toHaveAttribute('aria-level', '1');
  await expect(tree.getByRole('row', { name: 'Caption' })).toHaveAttribute('aria-level', '2');
  expect(await rows()).toEqual(['fc', 'tc', 'fr', 'tr', 'fl', 'tl', 'lt', 'Caption']);

  // Arrow keys fold and open a frame.
  await tree.getByRole('row', { name: 'lt' }).click();
  await page.keyboard.press('ArrowLeft');
  await expect(tree.getByRole('row', { name: 'Caption' })).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(tree.getByRole('row', { name: 'Caption' })).toBeVisible();

  // Alt+↑ brings a layer forward among its siblings, and the show keeps the new order.
  await tree.getByRole('row', { name: 'fl' }).click();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await rows()).toEqual(['fc', 'tc', 'fl', 'tl', 'fr', 'tr', 'lt', 'Caption']);
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const { getShow } = await import('/src/storage/shows.ts' as string);
        const show = await getShow(id);
        const z = (l: string) => show.layers.find((x: { id: string }) => x.id === l).z;
        return z('fl') > z('fr') && z('fr') > z('lt');
      }, showId),
    )
    .toBe(true);
});
