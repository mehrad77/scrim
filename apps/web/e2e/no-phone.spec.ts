import { devices, expect, test, type Page } from '@playwright/test';
import { seedShow } from './fixtures.js';

const standby = (page: Page) => page.locator('[data-standby="true"]');

/** Edit the seeded show in storage before the operator view opens it. */
async function editShow(page: Page, showId: string, recipe: string): Promise<void> {
  await page.evaluate(
    async ([id, body]) => {
      const shows = await import('/src/storage/shows.ts' as string);
      const show = await shows.getShow(id);
      new Function('show', body!)(show);
      await shows.saveShow(show);
    },
    [showId, recipe],
  );
}

test('a shared tablet counts each person; buttons and typed counts add to phones', async ({
  page,
  browser,
}) => {
  const { showId } = await seedShow(page);
  // Z is an arcade button for the second option.
  await editShow(
    page,
    showId,
    `show.inputs.keys.push({ key: 'KeyZ', command: { type: 'countVote', option: 2 } });`,
  );
  await page.goto(`/show/${showId}/run`);
  await page.getByRole('button', { name: 'Open audience room' }).click();
  await expect(page.getByTestId('room-code').first()).toHaveText(/^[A-Z2-9]{5}$/);
  await page.keyboard.press('Space');
  await expect(standby(page)).toContainText('Vote');
  await page.waitForTimeout(350); // past the double-GO guard
  await page.keyboard.press('Space');
  await expect(page.getByText('OPEN', { exact: true })).toBeVisible();

  const url = await page.evaluate(async (id) => {
    const room = await import('/src/host/room.ts' as string);
    return room.sharedUrl(await room.storedRoom(id));
  }, showId);
  const tabletContext = await browser.newContext({ ...devices['iPad Mini'] });
  const tablet = await tabletContext.newPage();
  await tablet.goto(url);
  await tablet.getByRole('button', { name: 'Left' }).click();
  await expect(tablet.getByText('Thank you — pass it on')).toBeVisible();
  await tablet.getByRole('button', { name: 'Next person' }).click();
  // The next person starts fresh, and their vote counts as one more.
  await expect(tablet.getByRole('button', { name: 'Right' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await tablet.getByRole('button', { name: 'Right' }).click();
  await expect(tablet.getByText('Thank you — pass it on')).toBeVisible();

  const tally = page.getByTestId('tally');
  await expect(tally).toHaveText(['1', '1']);
  await page.keyboard.press('KeyZ');
  await expect(tally).toHaveText(['1', '2']);
  await expect(page.getByTestId('sources')).toHaveText('Phones 2 · Buttons 1');

  // Raised hands, counted by an usher and typed in.
  await page.getByRole('textbox', { name: 'How many' }).fill('3');
  await page.getByRole('textbox', { name: 'How many' }).press('Enter');
  await page.getByRole('button', { name: 'Add votes' }).click();
  await expect(tally).toHaveText(['4', '2']);
  await expect(page.getByTestId('sources')).toHaveText('Phones 2 · Buttons 1 · Counted 3');
  await tabletContext.close();
});

test('GO fires only after the show’s hold time, and the view is read aloud', async ({ page }) => {
  const { showId } = await seedShow(page);
  await editShow(page, showId, `show.operator = { goHoldMs: 500 };`);
  await page.goto(`/show/${showId}/run`);
  await expect(standby(page)).toContainText('Red up');
  await expect(page.getByRole('button', { name: /^GO/ })).toContainText('Hold Space · 0.5 s');

  // A tap is not enough.
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');
  await expect(page.getByText('Hold GO for 0.5 s to fire it')).toBeVisible();
  await expect(standby(page)).toContainText('Red up');

  // Held long enough, it fires once, even while still held.
  await page.keyboard.down('Space');
  await page.waitForTimeout(800);
  await expect(standby(page)).toContainText('Vote');
  await page.keyboard.up('Space');
  await expect(standby(page)).toContainText('Vote');

  await expect(page.getByTestId('announce-polite')).toHaveText('Fired Red up. Next: Vote');
});
