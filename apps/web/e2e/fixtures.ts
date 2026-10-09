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

/**
 * A show with frames: a hidden lower third whose caption is on, and three labels that hug
 * `Door: {{door}}`, pinned left, right and centre. Cue 1 shows the lower third; cue 2 sets the
 * door, so the labels grow.
 */
export async function seedFrames(page: Page): Promise<{ showId: string; outputId: string }> {
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

/**
 * The brightest colour channel (0–255) in the top-left quarter of the page, where the seed
 * show's layers sit, away from the output HUD. Decoded in the page, so no image library is needed.
 */
export async function brightest(page: Page): Promise<number> {
  const size = page.viewportSize()!;
  const png = await page.screenshot({
    clip: { x: 0, y: 0, width: size.width / 2, height: size.height / 2 },
  });
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    let max = 0;
    for (let i = 0; i < data.length; i += 4)
      max = Math.max(max, data[i]!, data[i + 1]!, data[i + 2]!);
    return max;
  }, png.toString('base64'));
}

export function layerOpacity(page: Page, layerId: string): Promise<number> {
  return page
    .locator(`[data-layer="${layerId}"]`)
    .evaluate((el) => Number((el as HTMLElement).style.opacity));
}
