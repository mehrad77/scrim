import { expect, test, type Page } from '@playwright/test';

/**
 * A show with frames: a hidden lower third whose caption is on, and three labels that hug
 * `Door: {{door}}`, pinned left, right and centre. Cue 1 shows the lower third; cue 2 sets the
 * door, so the labels grow.
 */
async function seedFrames(page: Page): Promise<{ showId: string; outputId: string }> {
  await page.goto('/');
  return page.evaluate(async () => {
    const format = await import('/@id/@scrim/format' as string);
    const shows = await import('/src/storage/shows.ts' as string);
    const show = format.createShow('Frames');
    const out = show.outputs[0];
    const scene = show.scenes[0].id;
    const crop = { top: 0, right: 0, bottom: 0, left: 0 };
    const base = { outputId: out.id, z: 1, opacity: 1, crop };
    const style = {
      fontSize: 48,
      color: '#fff',
      fontFamily: 'sans-serif',
      fontWeight: 600,
      align: 'left',
      background: 'transparent',
    };
    const layout = (mode: string, hug: boolean) => ({
      mode,
      gap: 0,
      padX: 20,
      padY: 10,
      align: 'center',
      justify: 'start',
      hugW: hug,
      hugH: hug,
    });
    const frame = (id: string, x: number, y: number, extra: object) => ({
      ...base,
      id,
      name: id,
      kind: 'frame',
      x,
      y,
      w: 300,
      h: 80,
      visible: true,
      fill: '#0000ff',
      radius: 0,
      clip: false,
      ...extra,
    });
    const label = (id: string, parentId: string) => ({
      ...base,
      ...style,
      id,
      name: id,
      kind: 'text',
      parentId,
      text: 'Door: {{door}}',
      x: 0,
      y: 0,
      w: 100,
      h: 60,
      visible: true,
      sizing: 'autoWidth',
    });
    show.layers.push(
      frame('lt', 100, 900, { visible: false, layout: layout('free', false) }),
      {
        ...base,
        ...style,
        id: 'cap',
        name: 'Caption',
        kind: 'text',
        parentId: 'lt',
        text: 'Ada',
        x: 10,
        y: 10,
        w: 200,
        h: 60,
        visible: true,
      },
      frame('fl', 100, 100, { layout: layout('row', true), pin: { x: 'left', y: 'top' } }),
      label('tl', 'fl'),
      frame('fr', 1500, 300, { layout: layout('row', true), pin: { x: 'right', y: 'top' } }),
      label('tr', 'fr'),
      frame('fc', 800, 500, { layout: layout('row', true), pin: { x: 'center', y: 'top' } }),
      label('tc', 'fc'),
    );
    show.vars.push({ id: 'door', name: 'door', type: 'text', initial: '' });
    show.cues = [
      {
        ...format.createCue(scene, 'Lower third'),
        actions: [{ type: 'show', layerId: 'lt', duration: 0, easing: 'linear' }],
      },
      {
        ...format.createCue(scene, 'Door'),
        actions: [{ type: 'setVar', varId: 'door', value: 'the one on the right' }],
      },
    ];
    await shows.saveShow(show);
    return { showId: show.id, outputId: out.id };
  });
}

const rect = (page: Page, id: string) =>
  page.locator(`[data-layer="${id}"]`).evaluate((el) => el.getBoundingClientRect().toJSON());
const visibility = (page: Page, id: string) =>
  page.locator(`[data-layer="${id}"]`).evaluate((el) => getComputedStyle(el).visibility);

test('frames hide and show their content, and hugging frames grow away from their pin', async ({
  page,
  context,
}) => {
  const { showId, outputId } = await seedFrames(page);
  await page.goto(`/show/${showId}/run`);
  await expect(page.getByText('Standby', { exact: true })).toBeVisible();
  const output = await context.newPage();
  await output.goto(`/output/${showId}/${outputId}`);
  await expect(output.locator('[data-layer="cap"]')).toBeAttached();

  // The caption is on, but its frame is hidden, so it is too.
  await expect.poll(() => visibility(output, 'cap')).toBe('hidden');
  const before = {
    l: await rect(output, 'fl'),
    r: await rect(output, 'fr'),
    c: await rect(output, 'fc'),
  };

  await page.bringToFront();
  await page.keyboard.press('Space');
  await expect.poll(() => visibility(output, 'cap')).toBe('visible');

  await page.waitForTimeout(400); // past the double-GO guard
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await rect(output, 'fl')).width)
    .toBeGreaterThan(before.l.width + 50);
  const after = {
    l: await rect(output, 'fl'),
    r: await rect(output, 'fr'),
    c: await rect(output, 'fc'),
  };

  // Pinned left: the left edge stays. Pinned right: the right edge stays. Centred: both move out.
  expect(after.l.left).toBeCloseTo(before.l.left, 0);
  expect(after.r.right).toBeCloseTo(before.r.right, 0);
  expect(after.r.left).toBeLessThan(before.r.left - 50);
  const grew = after.c.width - before.c.width;
  expect(grew).toBeGreaterThan(50);
  expect(before.c.left - after.c.left).toBeCloseTo(grew / 2, 0);
  expect(after.c.right - before.c.right).toBeCloseTo(grew / 2, 0);
});
