import { expect, test } from '@playwright/test';

// The template gallery (docs/templates.md): a template becomes a show with its own media and
// Learn checklist, and every template draws on a real output with its pictures decoded.

test('a template from the gallery becomes a show with its media and a Learn checklist', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('link', { name: /Browse templates/ }).click();
  await expect(page.getByRole('heading', { name: 'Start from a template' })).toBeVisible();
  await page.getByRole('button', { name: 'Care', exact: true }).click();
  await page.getByRole('button', { name: /A Day at the Seaside/ }).click();
  await expect(page.getByRole('dialog')).toContainText('an activity leader');
  await page.getByRole('textbox', { name: 'Name your show' }).fill('Tuesday group');
  await page.getByRole('button', { name: 'Make my show' }).click();
  await expect(page).toHaveURL(/\/show\/show_/, { timeout: 60_000 });
  const made = await page.evaluate(async () => {
    const shows = await import('/src/storage/shows.ts' as string);
    const [show] = await shows.listShows();
    return {
      name: show.name,
      media: show.media.length,
      relaxed: !!show.relaxed?.default,
      template: JSON.parse(localStorage.getItem('scrim.templateShows') ?? '{}')[show.id]?.template,
    };
  });
  expect(made).toMatchObject({ name: 'Tuesday group', relaxed: true, template: 'memory-session' });
  expect(made.media).toBeGreaterThan(10);
  await page.goto('/');
  await expect(page.getByText('Learn')).toBeVisible();
  await expect(page.getByText(/0 of 5/)).toBeVisible();
});

test('every template draws its first scene on an output, with nothing missing', async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const made = await page.evaluate(async () => {
    const { TEMPLATES } = await import('/src/templates/index.ts' as string);
    const { createFromTemplate } = await import('/src/templates/create.ts' as string);
    const { saveShow } = await import('/src/storage/shows.ts' as string);
    const { previewAt } = await import('/src/lib/simulate.ts' as string);
    const { db } = await import('/src/storage/db.ts' as string);
    const out = [];
    for (const seed of TEMPLATES) {
      const show = await createFromTemplate(seed, seed.title);
      await saveShow(show);
      const hero =
        show.cues.find((c: { name: string }) => c.name === seed.heroes?.[0]) ?? show.cues[0];
      await (
        await db()
      ).put('journal', {
        showId: show.id,
        runId: 'e2e',
        mode: 'rehearsal',
        savedAt: Date.now(),
        state: previewAt(show, hero.id).state,
      });
      out.push({ id: seed.id, showId: show.id, outputId: show.outputs[0].id });
    }
    return out;
  });
  for (const t of made) {
    const out = await context.newPage();
    const errors: string[] = [];
    out.on('pageerror', (e) => errors.push(e.message));
    await out.goto(`/output/${t.showId}/${t.outputId}`);
    await out.waitForTimeout(2500);
    const drawn = await out.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images].filter((i) => i.closest('[data-layer]'));
      await Promise.all(images.map((i) => i.decode().catch(() => null)));
      return {
        broken: images.filter((i) => !i.naturalWidth).length,
        images: images.length,
        videos: [...document.querySelectorAll('video')].filter((v) => v.error).length,
      };
    });
    expect(errors, t.id).toEqual([]);
    expect(drawn.broken, t.id).toBe(0);
    expect(drawn.videos, t.id).toBe(0);
    await out.close();
  }
});
