import { expect, test } from '@playwright/test';

test('first run answers shape new shows, and a starter opens ready to edit', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Scrim' })).toBeVisible();
  // React Aria hides the native radio; people click its label.
  await page.getByText('QLab', { exact: true }).click();
  await page.getByText('Enter', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Enter' })).toBeChecked();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Scrim' })).toHaveCount(0);

  await page.getByRole('link', { name: /Browse templates/ }).click();
  await page.getByRole('button', { name: /Slides with cues/ }).click();
  await expect(page).toHaveURL(/\/show\/show_/);
  await expect(page.getByRole('tab', { name: 'Stage' })).toBeVisible();
  const keys = await page.evaluate(async () => {
    const shows = await import('/src/storage/shows.ts' as string);
    const [show] = await shows.listShows();
    return show.inputs.keys.map((k: { key: string; command: { type: string } }) =>
      [k.command.type, k.key].join(':'),
    );
  });
  expect(keys).toContain('go:Enter');
  expect(keys).toContain('hold:BracketLeft');
});
