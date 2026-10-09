import { expect, test, type Page } from '@playwright/test';
import { seedFrames } from './fixtures.js';

const rects = (page: Page) =>
  page.locator('[data-editor-canvas] [data-layer]').evaluateAll((els) =>
    Object.fromEntries(
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [el.getAttribute('data-layer'), [r.x, r.y, r.width, r.height]];
      }),
    ),
  );
const same = (a: Record<string, number[]>, b: Record<string, number[]>) =>
  Object.keys(a).every((k) => !b[k] || a[k]!.every((v, i) => Math.abs(v - b[k]![i]!) < 0.5));

test('⌘G frames the selection and ⇧⌘G ungroups it, and nothing moves on stage', async ({
  page,
}) => {
  const { showId } = await seedFrames(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'stage'));
  await page.goto(`/show/${showId}`);
  const tree = page.getByRole('treegrid');
  await tree.getByRole('row', { name: 'fl', exact: true }).click();
  // Shift-click selects the range fr…fl; fr's content goes with it, so fr and fl get framed.
  await tree.getByRole('row', { name: 'fr', exact: true }).click({ modifiers: ['Shift'] });
  const before = await rects(page);

  await page.keyboard.press('ControlOrMeta+g');
  await expect(tree.getByRole('row', { name: 'Frame', exact: true })).toHaveAttribute(
    'aria-level',
    '1',
  );
  await expect(tree.getByRole('row', { name: 'fl', exact: true })).toHaveAttribute(
    'aria-level',
    '2',
  );
  await expect(tree.getByRole('row', { name: 'fr', exact: true })).toHaveAttribute(
    'aria-level',
    '2',
  );
  expect(same(before, await rects(page))).toBe(true);

  await page.keyboard.press('ControlOrMeta+Shift+g');
  await expect(tree.getByRole('row', { name: 'Frame', exact: true })).toHaveCount(0);
  await expect(tree.getByRole('row', { name: 'fl', exact: true })).toHaveAttribute(
    'aria-level',
    '1',
  );
  expect(same(before, await rects(page))).toBe(true);
});

test('dropping a layer on a frame in the tree nests it where it is drawn', async ({ page }) => {
  const { showId } = await seedFrames(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'stage'));
  await page.goto(`/show/${showId}`);
  const tree = page.getByRole('treegrid');
  const before = await rects(page);
  await tree
    .getByRole('row', { name: 'fc', exact: true })
    .dragTo(tree.getByRole('row', { name: 'lt', exact: true }));
  await expect(tree.getByRole('row', { name: 'fc', exact: true })).toHaveAttribute(
    'aria-level',
    '2',
  );
  expect(same(before, await rects(page))).toBe(true);
});
