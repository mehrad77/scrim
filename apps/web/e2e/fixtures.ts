import type { Page } from '@playwright/test';

/**
 * Seed a small show straight into the browser's storage, through the app's
 * own modules (served by the Vite dev server).
 */
export async function seedShow(page: Page): Promise<{ showId: string; outputId: string }> {
  await page.goto('/');
  return page.evaluate(async () => {
    const format = await import('/@id/@scrim/format' as string);
    const shows = await import('/src/storage/shows.ts' as string);
    const media = await import('/src/storage/media.ts' as string);
    const show = format.createShow('E2E show');
    const out = show.outputs[0];
    const canvas = new OffscreenCanvas(64, 36);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 64, 36);
    const img = await media.addMediaBlob(
      await canvas.convertToBlob({ type: 'image/png' }),
      'red.png',
    );
    show.media.push(img);
    const scene = show.scenes[0].id;
    show.scenes.push({ id: 'scn_left', name: 'Left' }, { id: 'scn_right', name: 'Right' });
    show.layers.push(
      {
        id: 'lyr_img',
        name: 'Red',
        kind: 'image',
        outputId: out.id,
        mediaId: img.id,
        fit: 'cover',
        x: 0,
        y: 0,
        w: out.width,
        h: out.height,
        z: 0,
        opacity: 1,
        visible: false,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      {
        id: 'lyr_txt',
        name: 'Caption',
        kind: 'text',
        outputId: out.id,
        text: 'Door: {{door}}',
        x: 0,
        y: 0,
        w: 800,
        h: 200,
        z: 1,
        opacity: 1,
        visible: true,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        fontSize: 72,
        color: '#fff',
        fontFamily: 'sans-serif',
        fontWeight: 600,
        align: 'center',
        background: 'transparent',
      },
    );
    show.vars.push({
      id: 'door',
      name: 'door',
      type: 'choice',
      initial: '',
      options: ['left', 'right'],
    });
    show.moments.push({
      id: 'vote',
      name: 'Door vote',
      type: 'vote',
      prompt: 'Which door?',
      options: [
        { id: 'left', label: 'Left' },
        { id: 'right', label: 'Right' },
      ],
      min: 0,
      max: 10,
      variants: [],
      durationSec: 0,
      resultVarId: 'door',
      tallyVarId: null,
      defaultResult: 'left',
      moderated: true,
    });
    show.cues = [
      {
        ...format.createCue(scene, 'Red up'),
        actions: [{ type: 'show', layerId: 'lyr_img', duration: 0, easing: 'linear' }],
      },
      { ...format.createCue(scene, 'Vote'), actions: [{ type: 'openMoment', momentId: 'vote' }] },
      { ...format.createCue('scn_left', 'Left scene'), actions: [] },
      { ...format.createCue('scn_right', 'Right scene'), actions: [] },
    ];
    show.rules.push(
      {
        id: 'r1',
        name: 'left',
        enabled: true,
        when: { type: 'momentClosed', momentId: 'vote' },
        if: [{ varId: 'door', op: 'eq', value: 'left' }],
        then: [{ type: 'jumpScene', sceneId: 'scn_left', fire: false }],
      },
      {
        id: 'r2',
        name: 'right',
        enabled: true,
        when: { type: 'momentClosed', momentId: 'vote' },
        if: [{ varId: 'door', op: 'eq', value: 'right' }],
        then: [{ type: 'jumpScene', sceneId: 'scn_right', fire: false }],
      },
    );
    await shows.saveShow(show);
    return { showId: show.id, outputId: out.id };
  });
}

export function layerOpacity(page: Page, layerId: string): Promise<number> {
  return page
    .locator(`[data-layer="${layerId}"]`)
    .evaluate((el) => Number((el as HTMLElement).style.opacity));
}
