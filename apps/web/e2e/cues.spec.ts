import { expect, test, type Page } from '@playwright/test';
import { seedShow } from './fixtures.js';

const stored = (page: Page, showId: string) =>
  page.evaluate(async (id) => {
    const { getShow } = await import('/src/storage/shows.ts' as string);
    const show = await getShow(id);
    return {
      scenes: show.scenes.map((s: { name: string }) => s.name),
      cues: show.cues.map(
        (c: { name: string; sceneId: string }) =>
          `${c.name}@${show.scenes.find((s: { id: string }) => s.id === c.sceneId).name}`,
      ),
    };
  }, showId);

test('scenes and cues are one tree: fold, move, rename and drag', async ({ page }) => {
  const { showId } = await seedShow(page);
  await page.evaluate(() => {
    sessionStorage.setItem('scrim.editorTab', 'cues');
    localStorage.setItem('scrim.cues.view', JSON.stringify('list'));
  });
  await page.goto(`/show/${showId}`);
  const tree = page.getByRole('treegrid', { name: 'Scenes and cues' });
  const row = (name: string) => tree.getByRole('row', { name, exact: true });
  await expect(row('Scene 1')).toHaveAttribute('aria-level', '1');
  await expect(row('Red up')).toHaveAttribute('aria-level', '2');

  // A cue is selected by clicking it; a scene row only takes focus.
  await row('Vote').click();
  await expect(row('Vote')).toHaveAttribute('aria-selected', 'true');
  await row('Left').click();
  await expect(row('Vote')).toHaveAttribute('aria-selected', 'true');

  // Arrow keys fold and open a scene; Alt+↓ moves it after the next one.
  await page.keyboard.press('ArrowLeft');
  await expect(row('Left scene')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(row('Left scene')).toBeVisible();
  await page.keyboard.press('Alt+ArrowDown');
  await expect
    .poll(async () => (await stored(page, showId)).scenes)
    .toEqual(['Scene 1', 'Right', 'Left']);

  // F2 renames the focused scene.
  await page.keyboard.press('F2');
  const dialog = page.getByRole('dialog', { name: 'Rename scene' });
  await dialog.getByRole('textbox').fill('Cellar');
  await dialog.getByRole('textbox').press('Enter');
  await expect(row('Cellar')).toBeVisible();

  // Drag a cue onto a scene: it goes to the end of that scene.
  await row('Red up').dragTo(row('Right'));
  await expect
    .poll(async () => (await stored(page, showId)).cues)
    .toEqual(['Vote@Scene 1', 'Left scene@Cellar', 'Right scene@Right', 'Red up@Right']);

  // Alt+↓ on the last cue of a scene carries it to the top of the next one (now Right).
  await row('Vote').click();
  await page.keyboard.press('Alt+ArrowDown');
  await expect
    .poll(async () => (await stored(page, showId)).cues)
    .toEqual(['Left scene@Cellar', 'Vote@Right', 'Right scene@Right', 'Red up@Right']);
});
