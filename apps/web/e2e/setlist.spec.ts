import { expect, test, type Page } from '@playwright/test';

/** Three songs with sections; C fires the next Chorus, N puts the next song on standby. */
async function seedGig(page: Page): Promise<string> {
  await page.goto('/');
  return page.evaluate(async () => {
    const format = await import('/@id/@scrim/format' as string);
    const shows = await import('/src/storage/shows.ts' as string);
    const show = format.createShow('Gig');
    show.scenes = [
      { id: 'scn_grace', name: 'Amazing Grace' },
      { id: 'scn_river', name: 'River' },
      { id: 'scn_encore', name: 'Encore' },
    ];
    const cue = (id: string, sceneId: string, name: string, section?: string) => ({
      ...format.createCue(sceneId, name),
      id,
      ...(section ? { section } : {}),
    });
    show.cues = [
      cue('cue_g1', 'scn_grace', 'Verse 1', 'Verse'),
      cue('cue_g2', 'scn_grace', 'Chorus', 'Chorus'),
      cue('cue_g3', 'scn_grace', 'Verse 2', 'Verse'),
      cue('cue_r1', 'scn_river', 'Intro'),
      cue('cue_e1', 'scn_encore', 'Bow'),
    ];
    show.inputs.keys.push(
      {
        key: 'KeyC',
        command: { type: 'jump', target: { to: 'section', section: 'Chorus' }, fire: true },
      },
      { key: 'KeyN', command: { type: 'jump', target: { to: 'nextScene' }, fire: false } },
    );
    await shows.saveShow(show);
    return show.id as string;
  });
}

const standby = (page: Page) => page.locator('[data-standby="true"]');

test('tonight’s order changes live in Show mode, keys jump to sections, and a reload keeps it', async ({
  page,
}) => {
  const showId = await seedGig(page);
  await page.goto(`/show/${showId}/run`);
  await expect(standby(page)).toContainText('Verse 1');
  await page.getByRole('button', { name: 'Show mode' }).click();

  // Skip River and move Encore up, from the running order next to the cue list.
  await page.getByRole('tab', { name: 'Order' }).click();
  const order = page.getByRole('grid', { name: 'Tonight’s running order' });
  await order.getByRole('row', { name: /River/ }).getByRole('button', { name: 'Skip' }).click();
  await order.getByRole('button', { name: 'Move “Encore” up' }).click();
  await expect(order.getByRole('row')).toHaveText([/Amazing Grace/, /Encore/, /River.*skipped/]);
  await page.getByRole('tab', { name: 'Cues' }).click();

  await page.keyboard.press('Space');
  await expect(standby(page)).toContainText('Chorus');
  // C fires the chorus at once; N puts the next song, skipping River, on standby. A jump that
  // fires is a GO, so it waits out the double-GO guard first.
  await page.waitForTimeout(350);
  await page.keyboard.press('KeyC');
  await expect(standby(page)).toContainText('Verse 2');
  await page.keyboard.press('KeyN');
  await expect(standby(page)).toContainText('Bow');

  // The order is journaled, so a reload resumes in it.
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const { db } = await import('/src/storage/db.ts' as string);
        const state = (await (await db()).get('journal', id))?.state;
        return { skipped: state?.order?.skipped, standby: state?.standby };
      }, showId),
    )
    .toEqual({ skipped: ['scn_river'], standby: 'cue_e1' });
  await page.reload();
  await expect(page.getByText(/Resumed where the show left off/)).toBeVisible();
  await expect(standby(page)).toContainText('Bow');
  await page.getByRole('button', { name: 'OK' }).click();
  await page.keyboard.press('Space');
  await expect(page.getByText('End of show')).toBeVisible();
});
