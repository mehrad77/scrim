import { expect, test, type Page } from '@playwright/test';
import { seedShow } from './fixtures.js';

const openTab = async (page: Page, showId: string, tab: string) => {
  await page.evaluate((t) => sessionStorage.setItem('scrim.editorTab', t), tab);
  await page.evaluate(() => localStorage.setItem('scrim.cues.view', JSON.stringify('list')));
  await page.goto(`/show/${showId}`);
};

test('the song wizard makes a cue per section, keeps the song, and a key can jump to the chorus', async ({
  page,
}) => {
  const { showId } = await seedShow(page);
  await openTab(page, showId, 'cues');
  await page.getByRole('button', { name: /^Build/ }).click();
  await page.getByRole('menuitem', { name: 'A song…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a song' });
  await dialog.getByLabel('Title').fill('Amazing Grace');
  await dialog
    .getByLabel(/^Words/)
    .fill(
      'Amazing grace, how sweet the sound\nThat saved a wretch like me\n\nChorus\nPraise the Lord\n\nI once was lost, but now am found\n\nChorus',
    );
  await expect(dialog.getByText('4 cues: Verse 1 · Chorus · Verse 2 · Chorus')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add the song' }).click();

  const tree = page.getByRole('treegrid', { name: 'Scenes and cues' });
  await expect(tree.getByRole('row', { name: 'Amazing Grace', exact: true })).toBeVisible();
  await expect(tree.getByRole('row', { name: 'Chorus', exact: true })).toHaveCount(2);
  await expect(tree.getByRole('row', { name: 'End of song', exact: true })).toBeVisible();

  // The song is in the library, for the next show.
  const songs = await page.evaluate(async () => {
    const lib = await import('/src/storage/songs.ts' as string);
    return (await lib.listSongs()).map((s: { title: string }) => s.title);
  });
  expect(songs).toEqual(['Amazing Grace']);
  await page.getByRole('button', { name: /^Build/ }).click();
  await page.getByRole('menuitem', { name: 'A song…' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Add a song' }).getByText('From my songs'),
  ).toBeVisible();
});

test('the simple editor folds rules and mappings one labelled step away', async ({ page }) => {
  const { showId } = await seedShow(page);
  await openTab(page, showId, 'interaction');
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await page.getByRole('button', { name: 'Simple', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Involve the audience' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rules' })).toHaveCount(0);
  // The fold says how much is inside, and opens on one click.
  await page.getByRole('button', { name: /Rules, values and triggers \(\d+\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  // It travels with the show.
  const mode = await page.evaluate(async (id) => {
    const { getShow } = await import('/src/storage/shows.ts' as string);
    await new Promise((r) => setTimeout(r, 700));
    return (await getShow(id)).editor?.mode;
  }, showId);
  expect(mode).toBe('simple');
});

test('scenes come in from another show with everything they use', async ({ page }) => {
  const { showId } = await seedShow(page);
  // The other show: the same fixture, exported as a .scrim file.
  const bytes = await page.evaluate(async (id) => {
    const shows = await import('/src/storage/shows.ts' as string);
    const show = await shows.getShow(id);
    show.name = 'Group B';
    const buf = await new Response(shows.exportStream(show)).arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, showId);
  await openTab(page, showId, 'cues');
  await page.getByRole('button', { name: /^Build/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Scenes from another show…' }).click();
  await (
    await chooser
  ).setFiles({ name: 'group-b.scrim', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
  const dialog = page.getByRole('dialog', { name: 'Import scenes' });
  await dialog.locator('label', { hasText: /^Scene 1/ }).click();
  await expect(dialog.getByRole('checkbox', { name: /Scene 1/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Import 1 scene' }).click();
  await expect(page.getByText(/Imported 1 scene and 2 cues/)).toBeVisible();

  const show = await page.evaluate(async (id) => {
    const { getShow } = await import('/src/storage/shows.ts' as string);
    await new Promise((r) => setTimeout(r, 700));
    return getShow(id);
  }, showId);
  // Its scene, cues, layer, vote and value came across with new ids.
  expect(show.scenes.map((s: { name: string }) => s.name)).toEqual([
    'Scene 1',
    'Left',
    'Right',
    'Scene 1',
  ]);
  const ids = [...show.cues, ...show.layers, ...show.moments, ...show.vars].map(
    (x: { id: string }) => x.id,
  );
  expect(new Set(ids).size).toBe(ids.length);
  expect(show.moments).toHaveLength(2);
  expect(show.vars.map((v: { name: string }) => v.name)).toContain('door_2');
});
