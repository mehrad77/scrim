import { expect, test } from '@playwright/test';
import { layerOpacity, seedShow } from './fixtures.js';

test('PANIC’s secondary clears take text or media off stage and bring it back', async ({
  page,
  context,
}) => {
  const { showId, outputId } = await seedShow(page);
  await page.goto(`/show/${showId}/run`);
  const output = await context.newPage();
  await output.goto(`/output/${showId}/${outputId}`);
  await expect(output.locator('[data-layer="lyr_txt"]')).toBeAttached();

  await page.bringToFront();
  await page.keyboard.press('Space'); // "Red up" shows the picture; the caption is already up
  await expect.poll(() => layerOpacity(output, 'lyr_img')).toBe(1);
  await expect.poll(() => layerOpacity(output, 'lyr_txt')).toBe(1);

  const text = page.getByRole('group', { name: 'Secondary clears' }).getByRole('button').nth(0);
  await text.click();
  await expect(text).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => layerOpacity(output, 'lyr_txt')).toBe(0);
  expect(await layerOpacity(output, 'lyr_img')).toBe(1);
  await text.click();
  await expect.poll(() => layerOpacity(output, 'lyr_txt')).toBe(1);

  const media = page.getByRole('button', { name: /^Clear media/ });
  await media.click();
  await expect.poll(() => layerOpacity(output, 'lyr_img')).toBe(0);

  const sound = page.getByRole('button', { name: 'Mute every sound' });
  await sound.click();
  await expect(page.getByRole('button', { name: /^Sound muted/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // The next GO is a new picture: the media clear can no longer be undone.
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /^Clear media/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('tab', { name: 'Log' }).click();
  await expect(page.getByText('Cleared pictures and video (1 layer)')).toBeVisible();
  await expect(page.getByText('Sound muted')).toBeVisible();
});
