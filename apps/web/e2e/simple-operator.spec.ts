import { devices, expect, test, type Page } from '@playwright/test';
import { seedShow } from './fixtures.js';

const nowNext = (page: Page) => page.getByRole('region', { name: 'Now and next' });

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });

  test('the simple view: a huge GO, now and next, counting by hand, PANIC apart', async ({
    page,
  }) => {
    const { showId } = await seedShow(page);
    await page.goto(`/show/${showId}/run`);
    const main = page.getByRole('main', { name: 'Simple operator' });
    await expect(main).toBeVisible();
    await expect(nowNext(page)).toContainText('NextRed up');

    const go = main.getByRole('button', { name: /^GO/ });
    const panic = main.getByRole('button', { name: /PANIC/ });
    const [g, p] = [await go.boundingBox(), await panic.boundingBox()];
    expect(g!.width).toBeGreaterThan(0.6 * 820);
    expect(g!.height).toBeGreaterThanOrEqual(200);
    // PANIC never sits where a slip from GO lands.
    expect(p!.y + p!.height).toBeLessThan(g!.y);

    await go.tap();
    await expect(nowNext(page)).toContainText('NowRed up');
    await page.waitForTimeout(350); // past the double-GO guard
    await go.tap();
    // The vote is open: count the hands in the room.
    await main.getByRole('button', { name: 'Count one for Right' }).tap();
    await main.getByRole('button', { name: 'Count one for Right' }).tap();
    await expect(main.getByTestId('simple-tally')).toHaveText(['0', '2']);
    await main.getByRole('button', { name: 'Close it now' }).tap();
    await expect(nowNext(page)).toContainText('NextRight scene');

    await page.keyboard.press('Escape');
    await expect(main.getByRole('button', { name: /Blacked out/ })).toBeVisible();
  });
});

test('Remote GO: a tablet runs GO and Hold through the room when the show allows it', async ({
  page,
  browser,
}) => {
  const { showId } = await seedShow(page);
  await page.evaluate(async (id) => {
    const shows = await import('/src/storage/shows.ts' as string);
    const show = await shows.getShow(id);
    show.operator = { remoteGo: true };
    await shows.saveShow(show);
  }, showId);
  await page.goto(`/show/${showId}/run`);
  await page.getByRole('button', { name: 'Open audience room' }).click();
  await expect(page.getByTestId('room-code').first()).toHaveText(/^[A-Z2-9]{5}$/);
  const url = await page.evaluate(async (id) => {
    const room = await import('/src/host/room.ts' as string);
    return room.remoteUrl(await room.storedRoom(id));
  }, showId);

  const tabletContext = await browser.newContext({ ...devices['iPad Mini'] });
  const tablet = await tabletContext.newPage();
  await tablet.goto(url);
  await expect(tablet.getByText('Connected')).toBeVisible();
  await tablet.getByRole('button', { name: 'GO', exact: true }).tap();
  await expect(page.locator('[data-standby="true"]')).toContainText('Vote');
  await tablet.getByRole('button', { name: 'Hold' }).tap();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await tabletContext.close();
});
