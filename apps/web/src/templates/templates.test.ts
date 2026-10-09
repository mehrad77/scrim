import type { Media, MediaKind } from '@scrim/format';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { baselineOf, templateSteps } from '../lib/learn.js';
import { LICENCES, type AssetIndex } from './assets.js';
import { FIXTURE_SEED } from './fixture.js';
import { checkTemplate, contrast } from './harness.js';
import { TEMPLATES } from './index.js';
import { thumbnailOf, type TemplateMedia, type TemplateSeed } from './types.js';

const root = fileURLToPath(new URL('../../public/templates/', import.meta.url));
const index = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8')) as AssetIndex;

const MB = 1024 * 1024;
/** Most a template may download (docs/templates.md › Media); the gig's video loops get more. */
const BUDGET: Record<string, number> = { gig: 25 * MB };
const BUDGET_DEFAULT = 15 * MB;
const BUDGET_TOTAL = 70 * MB;

function kindOf(mime: string): MediaKind {
  if (mime.startsWith('font/')) return 'font';
  return mime.split('/')[0] as MediaKind;
}

/** What fetchAssets would hand the seed, without a browser. */
function fakeMedia(seed: TemplateSeed): TemplateMedia {
  return Object.fromEntries(
    seed.assets.map((a) => {
      const e = index.files[a.path];
      if (!e) throw new Error(`${seed.id}: ${a.path} isn't in index.json`);
      const kind = kindOf(e.mime);
      const media: Media = {
        id: `med_${a.path.replace(/\W/g, '')}`,
        kind,
        name: e.name,
        mime: e.mime,
        size: e.bytes,
        ...(kind === 'image' || kind === 'video' ? { width: 1920, height: 1080 } : {}),
        ...(kind === 'audio' || kind === 'video' ? { duration: 60 } : {}),
      };
      return [a.key, media];
    }),
  );
}

describe.each([...TEMPLATES, FIXTURE_SEED])('template $id', (seed) => {
  it('passes every check', () => {
    expect(checkTemplate(seed, fakeMedia(seed))).toEqual([]);
  });

  it('says who it is for, what it needs and what it can’t do', () => {
    for (const list of [seed.needs, seed.replace, seed.limits])
      expect(list.length).toBeGreaterThan(0);
    expect(seed.learn.length).toBeGreaterThan(1);
  });

  it('starts its Learn checklist from nothing done', () => {
    const show = seed.make(fakeMedia(seed));
    const steps = templateSteps(seed.learn, { show, runs: [], baseline: baselineOf(show) });
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual([]);
  });

  it('downloads within its budget', () => {
    const paths = new Set(seed.assets.map((a) => a.path));
    let bytes = [...paths].reduce((n, p) => n + (index.files[p]?.bytes ?? 0), 0);
    const thumb = join(root, '..', thumbnailOf(seed));
    if (existsSync(thumb)) bytes += statSync(thumb).size;
    expect(bytes).toBeLessThanOrEqual(BUDGET[seed.id] ?? BUDGET_DEFAULT);
  });
});

describe('template media', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(join(dir, d.name)) : [relative(root, join(dir, d.name))],
    );
  const onDisk = files(root).filter(
    (f) => f !== 'index.json' && !f.endsWith('.txt') && !f.endsWith('thumb.webp'),
  );

  it('lists every file it ships, with the bytes it has', () => {
    expect(onDisk.sort()).toEqual(Object.keys(index.files).sort());
    for (const [path, e] of Object.entries(index.files)) {
      const data = readFileSync(join(root, path));
      expect(data.length, path).toBe(e.bytes);
      expect(createHash('sha256').update(data).digest('hex'), path).toBe(e.sha256);
    }
  });

  it('may use every file: public domain, CC0, or OFL for fonts, each credited', () => {
    for (const [path, e] of Object.entries(index.files)) {
      const { credit } = e;
      expect(LICENCES, path).toContain(credit.licence);
      expect(credit.licence === 'OFL-1.1', path).toBe(e.mime.startsWith('font/'));
      for (const field of ['title', 'creator', 'source', 'url'] as const)
        expect(credit[field], `${path} ${field}`).toBeTruthy();
      if (credit.licence === 'PD') expect(credit.basis, `${path} basis`).toBeTruthy();
    }
    // A font's own licence travels with it.
    for (const [path, e] of Object.entries(index.files))
      if (e.mime.startsWith('font/')) {
        expect(e.licenceFile, path).toBeTruthy();
        expect(existsSync(join(root, e.licenceFile!)), path).toBe(true);
      }
  });

  it('stays within the total budget', () => {
    const total = files(root).reduce((n, f) => n + statSync(join(root, f)).size, 0);
    expect(total).toBeLessThanOrEqual(BUDGET_TOTAL);
  });
});

describe('the harness', () => {
  it('measures contrast as WCAG does', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrast('rgba(255, 255, 255, 0.5)', '#000000')).toBeNull();
  });

  const variant = (change: (show: ReturnType<TemplateSeed['make']>) => void): TemplateSeed => ({
    ...FIXTURE_SEED,
    make(media) {
      const show = FIXTURE_SEED.make(media);
      change(show);
      return show;
    },
  });
  const layer = (show: ReturnType<TemplateSeed['make']>, name: string) =>
    show.layers.find((l) => l.name === name)!;

  it('lets an intense frame be, since relaxed keeps the frame off', () => {
    const seed = variant((show) => Object.assign(layer(show, 'Title plate'), { intense: true }));
    expect(checkTemplate(seed, fakeMedia(seed)).join('\n')).not.toContain('still shows');
  });

  it('notices when every answer leads to the same place', () => {
    const seed = variant((show) => {
      const river = show.scenes.find((x) => x.name === 'The river')!;
      for (const r of show.rules) r.then = [{ type: 'jumpScene', sceneId: river.id, fire: true }];
    });
    expect(checkTemplate(seed, fakeMedia(seed)).join('\n')).toContain('leads to the same place');
  });

  it('checks text against both ends of a gradient, and see-through fills need a shadow', () => {
    const light = variant((show) =>
      Object.assign(layer(show, 'Title plate'), {
        fill: 'linear-gradient(180deg, #ffffff, #f4ecd8)',
      }),
    );
    light.make = ((make) => (media) => {
      const show = make(media);
      Object.assign(layer(show, 'Title'), { color: '#ffffff' });
      return show;
    })(light.make);
    expect(checkTemplate(light, fakeMedia(light)).join('\n')).toContain('“Title” contrasts');
    const faint = variant((show) =>
      Object.assign(layer(show, 'Title plate'), { fill: 'rgba(244, 236, 216, 0.05)' }),
    );
    expect(checkTemplate(faint, fakeMedia(faint)).join('\n')).toContain('“Title” sits over');
  });

  it('reads a font stack by its first family', () => {
    const seed = variant((show) => {
      for (const l of show.layers) if ('fontFamily' in l) l.fontFamily += ', serif';
    });
    expect(checkTemplate(seed, fakeMedia(seed))).toEqual([]);
  });

  it('catches small, cramped, unreadable and unused things', () => {
    const broken: TemplateSeed = {
      ...FIXTURE_SEED,
      assets: [...FIXTURE_SEED.assets, { key: 'spare', path: 'fonts/Anton.woff2' }],
      make(media) {
        const show = FIXTURE_SEED.make(media);
        const title = show.layers.find((l) => l.name === 'Title')!;
        Object.assign(title, { fontSize: 20 });
        const sub = show.layers.find((l) => l.name === 'Subtitle')!;
        Object.assign(sub, { color: '#e8e0cc', y: 400 });
        const ending = show.layers.find((l) => l.name === 'Ending')!;
        Object.assign(ending, { x: 0, shadow: undefined, h: 60 });
        return show;
      },
    };
    const problems = checkTemplate(broken, fakeMedia(broken)).join('\n');
    expect(problems).toContain('“Title” is 20 px');
    expect(problems).toContain('“Subtitle” contrasts');
    expect(problems).toContain('“Subtitle” runs outside its frame “Title plate”');
    expect(problems).toContain('“Ending” runs outside the title-safe area');
    expect(problems).toContain('“Ending” sits over the stage with no backing');
    expect(problems).toContain('“Ending” doesn’t fit');
    expect(problems).toContain('Asset “spare” is fetched but never used');
  });
});
