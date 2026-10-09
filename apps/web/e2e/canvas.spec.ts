import { expect, test, type Page } from '@playwright/test';
import { seedFrames } from './fixtures.js';

const layer = (page: Page, showId: string, id: string) =>
  page.evaluate(
    async ([sid, lid]) => {
      const { getShow } = await import('/src/storage/shows.ts' as string);
      return (await getShow(sid)).layers.find((l: { id: string }) => l.id === lid);
    },
    [showId, id],
  );
const node = (page: Page, id: string) => page.locator(`[data-editor-canvas] [data-layer="${id}"]`);
const selected = (page: Page) =>
  page.getByRole('treegrid').getByRole('row', { selected: true }).getAttribute('aria-label');

test('the canvas selects frames first, goes inside on double-click, and moves by what is drawn', async ({
  page,
}) => {
  const { showId } = await seedFrames(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'stage'));
  await page.goto(`/show/${showId}`);
  const cap = node(page, 'cap');
  await expect(cap).toBeVisible();

  // A click on the caption picks its frame; a double-click goes inside.
  await cap.click();
  await expect.poll(() => selected(page)).toBe('lt');
  // Moveable's drag area sits over the selected frame, so double-click by position.
  const at = (await cap.boundingBox())!;
  await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2);
  await expect.poll(() => selected(page)).toBe('Caption');

  // Dragging the caption moves it within its frame, in output pixels.
  const scale = await page
    .locator('[data-editor-canvas] [data-stage-canvas]')
    .evaluate((el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth);
  const before = await layer(page, showId, 'cap');
  const box = (await cap.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++)
    await page.mouse.move(box.x + box.width / 2 + i * 10, box.y + box.height / 2);
  await page.mouse.up();
  await expect
    .poll(async () => (await layer(page, showId, 'cap')).x - before.x)
    .toBeCloseTo(50 / scale, -1);
  expect((await layer(page, showId, 'lt')).x).toBe(100);
  // The layer is drawn where its handles are, with no offset left behind.
  await expect(cap).toHaveCSS('translate', 'none');

  // A hugging row moved by hand keeps its drawn size, so it keeps growing from the same edge.
  await node(page, 'fl').click();
  await expect.poll(() => selected(page)).toBe('fl');
  const drawn = (await node(page, 'fl').boundingBox())!;
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(async () => (await layer(page, showId, 'fl')).x).toBe(110);
  expect(Math.abs((await node(page, 'fl').boundingBox())!.width - drawn.width)).toBeLessThan(0.5);
});

test('Add puts a frame on stage and new layers inside the selected frame', async ({ page }) => {
  const { showId } = await seedFrames(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'stage'));
  await page.goto(`/show/${showId}`);
  const tree = page.getByRole('treegrid');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Frame' }).click();
  await expect(tree.getByRole('row', { name: 'Frame', selected: true })).toHaveAttribute(
    'aria-level',
    '1',
  );
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await expect(tree.getByRole('row', { name: 'Text', selected: true })).toHaveAttribute(
    'aria-level',
    '2',
  );
});

test('resizing an output keeps pinned layers at their edges', async ({ page }) => {
  const { showId } = await seedFrames(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'outputs'));
  await page.goto(`/show/${showId}`);
  const width = page.getByRole('textbox', { name: 'Width' }).first();
  await width.fill('1280');
  await width.press('Enter');
  // Pinned right: 640 px narrower, so 640 px further left. Pinned left: where it was.
  await expect.poll(async () => (await layer(page, showId, 'fr')).x).toBe(1500 - 640);
  expect((await layer(page, showId, 'fl')).x).toBe(100);
  expect((await layer(page, showId, 'fc')).x).toBe(800 - 320);
});

test('a locked layer stays put on the canvas until it is unlocked', async ({ page }) => {
  const { showId } = await seedFrames(page);
  await page.evaluate(() => sessionStorage.setItem('scrim.editorTab', 'stage'));
  await page.goto(`/show/${showId}`);
  const tree = page.getByRole('treegrid');
  await tree.getByRole('row', { name: 'fl', exact: true }).hover();
  await page.getByRole('button', { name: 'Lock fl' }).click();
  await expect(page.getByRole('button', { name: 'Unlock fl' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(tree.getByText('Locked with its frame')).toHaveCount(1);

  // Clicks pass through it on the canvas.
  await tree.getByRole('row', { name: 'fr', exact: true }).click();
  const at = (await node(page, 'fl').boundingBox())!;
  await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
  await expect(tree.getByRole('row', { name: 'fl', exact: true })).toHaveAttribute(
    'aria-selected',
    'false',
  );

  // Picked in the tree it can't be nudged; unlocked, it can.
  await tree.getByRole('row', { name: 'fl', exact: true }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(600);
  expect((await layer(page, showId, 'fl')).x).toBe(100);
  await page.keyboard.press('ControlOrMeta+Shift+l');
  await expect(page.getByRole('button', { name: 'Lock fl' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(async () => (await layer(page, showId, 'fl')).x).toBe(110);
});
