import { devices, expect, test } from '@playwright/test';
import { seedShow } from './fixtures.js';

test('a performer taps Ready for their cue and the operator sees it', async ({ page, browser }) => {
  const { showId } = await seedShow(page);
  // The "Vote" cue waits for the performer's Bell.
  await page.evaluate(async (id) => {
    const shows = await import('/src/storage/shows.ts' as string);
    const show = await shows.getShow(id);
    show.triggers.push({ id: 'trg_bell', name: 'Bell', color: '#d97706' });
    show.cues[1].waitFor = 'trg_bell';
    await shows.saveShow(show);
  }, showId);

  await page.goto(`/show/${showId}/run`);
  await page.getByRole('button', { name: 'Open audience room' }).click();
  await expect(page.getByTestId('room-code').first()).toHaveText(/^[A-Z2-9]{5}$/);
  const url = await page.evaluate(async (id) => {
    const room = await import('/src/host/room.ts' as string);
    return room.remoteUrl(await room.storedRoom(id));
  }, showId);

  const phoneContext = await browser.newContext({ ...devices['iPhone 13'] });
  const phone = await phoneContext.newPage();
  await phone.goto(url);
  const bell = phone.getByRole('button', { name: /^Bell/ });
  await expect(bell).toHaveAccessibleName('Bell: Not yet');
  // Remote GO is off unless the show turns it on.
  await expect(phone.getByRole('button', { name: 'GO', exact: true })).toHaveCount(0);

  // GO "Red up": "Vote" is on standby and waits for the Bell.
  await page.keyboard.press('Space');
  await expect(page.getByText('Waiting for Bell')).toBeVisible();
  await expect(bell).toHaveAccessibleName('Bell: Your cue · tap Ready');
  await bell.tap();
  await expect(bell).toHaveAccessibleName('Bell: Ready ✓ · waiting for GO');
  await expect(page.getByText('Bell ready')).toBeVisible();

  await page.waitForTimeout(400); // past the double-GO guard
  await page.keyboard.press('Space');
  await expect(bell).toHaveAccessibleName('Bell: Done ✓');
  await phoneContext.close();
});

test('the audience page shows the spike mark, not an emoji', async ({ page }) => {
  await page.goto('/audience.html');
  await expect(page.getByRole('heading', { name: 'Join the show' })).toBeVisible();
  await expect(page.getByText('🎭')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Join' })).toBeDisabled();
});
