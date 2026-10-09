import { expect, test } from '@playwright/test';
import { brightest, layerOpacity, seedShow } from './fixtures.js';

test('GO drives an output window; panic blacks out; a reload resumes', async ({
  page,
  context,
}) => {
  const { showId, outputId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  await expect(page.getByText('Standby', { exact: true })).toBeVisible();

  const output = await context.newPage();
  await output.goto(`/output/${showId}/${outputId}`);
  await expect(output.locator('[data-layer="lyr_img"]')).toBeAttached();
  await expect.poll(() => layerOpacity(output, 'lyr_img')).toBe(0);

  await page.bringToFront();
  await page.keyboard.press('Space');
  await expect.poll(() => layerOpacity(output, 'lyr_img')).toBe(1);
  await expect(page.locator('main').getByText('Red up').first()).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();

  // Panic from the operator view; the output's blackout overlay goes opaque.
  // The red picture and the white caption (z 1) are on screen first.
  await expect.poll(() => brightest(output)).toBeGreaterThan(200);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Blacked out/ })).toBeVisible();
  const blackout = output.locator('.bg-black.pointer-events-none');
  await expect.poll(() => blackout.evaluate((el) => (el as HTMLElement).style.opacity)).toBe('1');
  // Every pixel is black: the blackout covers layers above the bottom of the stack too.
  await expect.poll(() => brightest(output)).toBeLessThanOrEqual(2);

  // Crash recovery: once the journal has the blackout, reload and land on the same cue.
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const { db } = await import('/src/storage/db.ts' as string);
        return (await (await db()).get('journal', id))?.state.blackout.to;
      }, showId),
    )
    .toBe(1);
  await page.reload();
  await expect(page.getByText(/Resumed where the show left off/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Blacked out/ })).toBeVisible();
  await page.getByRole('button', { name: /Blacked out/ }).click();
  await expect.poll(() => blackout.evaluate((el) => (el as HTMLElement).style.opacity)).toBe('0');
});

test('a .scrim bundle round-trips', async ({ page }) => {
  const { showId } = await seedShow(page);
  const result = await page.evaluate(async (id) => {
    const shows = await import('/src/storage/shows.ts' as string);
    const media = await import('/src/storage/media.ts' as string);
    const show = await shows.getShow(id);
    const blob = await new Response(shows.exportStream(show)).blob();
    const copy = await shows.importShow(blob, async () => 'copy');
    const file = await media.mediaFile(copy.media[0].id);
    // Compare everything but identity, with keys in a stable order.
    const canon = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(canon)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, x]) => [k, canon(x)]),
            )
          : v;
    const strip = ({
      id: _a,
      name: _b,
      createdAt: _c,
      updatedAt: _d,
      ...rest
    }: Record<string, unknown>) => JSON.stringify(canon(rest));
    return {
      same: strip(copy) === strip(show),
      mediaSize: file?.size,
      expected: show.media[0].size,
    };
  }, showId);
  expect(result.same).toBe(true);
  expect(result.mediaSize).toBe(result.expected);
});
