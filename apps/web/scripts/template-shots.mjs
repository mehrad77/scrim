// Thumbnails and contact sheets for the templates (docs/templates.md › The visual bar).
// With the dev server running (pnpm dev):
//   node scripts/template-shots.mjs                 every template
//   node scripts/template-shots.mjs gig quiz        some
//   BASE=http://localhost:5173 node scripts/template-shots.mjs
// For each template it builds the show in a real page, then for each hero cue writes the
// settled stage to the journal and opens the real output window at 1920 × 1080, which restores
// from it. It writes public/templates/<id>/thumb.webp (the first hero) and a contact sheet
// under .shots/<id>/ (not committed), and fails if any text overflows its box.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:5173';
const shots = join(here, '../.shots');
const publicDir = join(here, '../public/templates');
const wanted = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
await page.goto(`${BASE}/`);

const ids = await page.evaluate(async () => {
  const { TEMPLATES } = await import('/src/templates/index.ts');
  return TEMPLATES.map((t) => t.id).concat('fixture');
});
const todo = wanted.length ? wanted : ids.filter((id) => id !== 'fixture');
let failed = false;
const sheet = [];

for (const id of todo) {
  const made = await page.evaluate(async (id) => {
    const { TEMPLATES } = await import('/src/templates/index.ts');
    const { FIXTURE_SEED } = await import('/src/templates/fixture.ts');
    const { createFromTemplate } = await import('/src/templates/create.ts');
    const { saveShow } = await import('/src/storage/shows.ts');
    const seed = [...TEMPLATES, FIXTURE_SEED].find((t) => t.id === id);
    if (!seed) throw new Error(`No template ${id}`);
    const show = await createFromTemplate(seed, seed.title);
    await saveShow(show);
    const byName = (n) => show.cues.find((c) => c.name === n);
    const heroes = seed.heroes?.length
      ? seed.heroes.map((n) => {
          const c = byName(n);
          if (!c) throw new Error(`${id}: no hero cue named “${n}”`);
          return c;
        })
      : show.scenes.flatMap((s) => show.cues.filter((c) => c.sceneId === s.id).slice(-1));
    return {
      showId: show.id,
      outputId: show.outputs[0].id,
      heroes: heroes.map((c) => ({ id: c.id, name: c.name })),
    };
  }, id);
  mkdirSync(join(shots, id), { recursive: true });
  const frames = [];
  for (const [i, hero] of made.heroes.entries()) {
    await page.evaluate(
      async ({ showId, cueId }) => {
        const { previewAt } = await import('/src/lib/simulate.ts');
        const { getShow } = await import('/src/storage/shows.ts');
        const { db } = await import('/src/storage/db.ts');
        const show = await getShow(showId);
        const { state } = previewAt(show, cueId);
        await (
          await db()
        ).put('journal', {
          showId,
          runId: 'shots',
          mode: 'rehearsal',
          savedAt: Date.now(),
          state,
        });
      },
      { showId: made.showId, cueId: hero.id },
    );
    const out = await context.newPage();
    await out.goto(`${BASE}/output/${made.showId}/${made.outputId}`);
    // The output waits 1.5 s for an operator before it restores from the journal.
    await out.waitForTimeout(2200);
    // As if the audience room were open, so join codes on stage show what they will.
    await out.evaluate((showId) => {
      const ch = new BroadcastChannel(`scrim:${showId}`);
      ch.postMessage({
        t: 'join',
        v: 1,
        // A placeholder, not an address: thumbnails are published and someone may scan one.
        join: { code: 'SCRIM', url: 'Scrim: the room code appears here when the room opens' },
      });
      ch.close();
    }, made.showId);
    const report = await out.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))),
      );
      for (const v of document.querySelectorAll('video'))
        if (v.readyState < 2)
          await new Promise((r) => {
            v.addEventListener('loadeddata', r, { once: true });
            setTimeout(r, 4000);
          });
      await new Promise((r) => setTimeout(r, 600));
      // Text that the layout cuts off, measured as drawn, on layers that are on stage.
      const { db } = await import('/src/storage/db.ts');
      const showId = location.pathname.split('/')[2];
      const show = await (await db()).get('shows', showId);
      const over = [];
      for (const l of show.layers) {
        if (!['text', 'counter', 'state'].includes(l.kind)) continue;
        const box = document.querySelector(`[data-layer="${l.id}"] > div`);
        if (!box?.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        // The words as laid out, not the font's ink, which tall faces push past their lines.
        const words = box.firstElementChild?.getBoundingClientRect();
        const room = box.getBoundingClientRect();
        if ((words && words.height > room.height + 2) || box.scrollWidth > box.clientWidth + 2)
          over.push(l.name);
      }
      // The window's own status strip fades after 5 s; a shot doesn't wait for it.
      for (const el of document.querySelectorAll('div'))
        if (
          el.childElementCount &&
          /holding last picture|Operator connected|Waiting for the show/.test(
            el.textContent ?? '',
          ) &&
          /absolute|fixed/.test(el.className) &&
          !el.querySelector('[data-layer]')
        )
          el.style.display = 'none';
      return { over };
    });
    const png = join(shots, id, `${String(i + 1).padStart(2, '0')}.png`);
    await out.screenshot({ path: png });
    await out.close();
    if (report.over.length) {
      failed = true;
      console.error(`${id} › ${hero.name}: text overflows: ${report.over.join(', ')}`);
    }
    frames.push({
      file: `${id}/${String(i + 1).padStart(2, '0')}.png`,
      cue: hero.name,
      over: report.over,
    });
    if (i === 0) {
      const thumb = join(publicDir, id, 'thumb.webp');
      mkdirSync(dirname(thumb), { recursive: true });
      execFileSync('cwebp', ['-q', '86', '-m', '6', '-resize', '960', '540', png, '-o', thumb], {
        stdio: 'ignore',
      });
    }
  }
  sheet.push({ id, frames });
  console.log(`${id}: ${frames.length} frames`);
}
await browser.close();

const html = `<!doctype html><meta charset="utf-8"><title>Template contact sheets</title>
<style>body{background:#111;color:#eee;font:14px system-ui;margin:24px}h2{font-weight:600;margin:32px 0 8px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}figure{margin:0}
img{width:100%;display:block;border:1px solid #333}figcaption{color:#aaa;padding:4px 0}.bad{color:#f66}</style>
${sheet
  .map(
    (t) =>
      `<h2>${t.id}</h2><div class="g">${t.frames
        .map(
          (f) =>
            `<figure><img src="${f.file}"><figcaption>${f.cue}${f.over.length ? ` <span class="bad">overflow: ${f.over.join(', ')}</span>` : ''}</figcaption></figure>`,
        )
        .join('')}</div>`,
  )
  .join('')}`;
writeFileSync(join(shots, 'index.html'), html);
console.log(`Contact sheet: ${join(shots, 'index.html')}`);
if (failed) process.exit(1);
