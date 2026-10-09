import { devices, expect, test } from '@playwright/test';
import { seedShow } from './fixtures.js';

test('phones get captions, warnings and translations, and late joiners catch up', async ({
  page,
  browser,
}) => {
  const { showId } = await seedShow(page);
  await page.evaluate(async (id) => {
    const shows = await import('/src/storage/shows.ts' as string);
    const show = await shows.getShow(id);
    show.languages = { base: 'en', others: ['fr'] };
    show.cues[0].access = {
      caption: 'The red room.',
      i18n: { fr: { caption: 'La salle rouge.' } },
    };
    show.cues[1].access = { warning: 'A loud bang' };
    show.moments[0].i18n = { fr: { prompt: 'Quelle porte ?', options: { left: 'Gauche' } } };
    await shows.saveShow(show);
  }, showId);

  await page.goto(`/show/${showId}/run`);
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
  await phone.getByRole('button', { name: 'Access' }).tap();
  await phone.getByRole('switch', { name: /Captions/ }).tap();
  await phone.getByRole('radio', { name: 'Français' }).tap();
  // The page's own words follow the language: the French pack loads on demand.
  await expect(phone.getByRole('dialog', { name: 'Accessibilité' })).toBeVisible();
  await phone.getByRole('button', { name: 'Terminé' }).tap();
  await expect(phone.getByText('Regardez la scène')).toBeVisible();
  await expect(phone.locator('html')).toHaveAttribute('lang', 'fr');

  await page.bringToFront();
  await page.keyboard.press('Space');
  await expect(phone.getByTestId('caption')).toHaveText('La salle rouge.');
  // Vote is on standby now, so its warning shows; it has no French, so the show's own words.
  await expect(phone.getByRole('note')).toContainText('A loud bang');

  // A phone that joins now catches up with the caption straight away.
  const lateContext = await browser.newContext({ ...devices['Pixel 7'] });
  await lateContext.addInitScript(() =>
    localStorage.setItem('scrim.access', JSON.stringify({ captions: true })),
  );
  const late = await lateContext.newPage();
  await late.goto(url);
  await expect(late.getByTestId('caption')).toHaveText('The red room.');

  await page.waitForTimeout(350); // past the double-GO guard
  await page.keyboard.press('Space');
  await expect(phone.getByRole('heading', { name: 'Quelle porte ?' })).toBeVisible();
  await expect(phone.getByRole('button', { name: 'Gauche' })).toBeVisible();
  await expect(late.getByRole('heading', { name: 'Which door?' })).toBeVisible();
  await phoneContext.close();
  await lateContext.close();
});
