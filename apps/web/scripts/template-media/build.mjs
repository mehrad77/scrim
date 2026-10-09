// Builds the template media (docs/templates.md › Media) from sources.json:
//   node scripts/template-media/build.mjs           fetch and encode what changed
//   node scripts/template-media/build.mjs --force   encode everything again
//   node scripts/template-media/build.mjs fonts/    only paths starting with this
// Downloads go to .cache/ (not committed); encoded files to public/templates/, described in
// public/templates/index.json with their size, hash and credit. Needs ffmpeg and cwebp.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '.cache');
const out = join(here, '../../public/templates');
const indexFile = join(out, 'index.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const MIME = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

const { assets } = JSON.parse(readFileSync(join(here, 'sources.json'), 'utf8'));
const index = existsSync(indexFile)
  ? JSON.parse(readFileSync(indexFile, 'utf8'))
  : { version: 1, files: {} };
const force = process.argv.includes('--force');
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));

const sha = (data) => createHash('sha256').update(data).digest('hex');
const recipeOf = (a) => sha(JSON.stringify({ fetch: a.fetch, process: a.process ?? null }));

async function download(url) {
  mkdirSync(cache, { recursive: true });
  const file = join(cache, sha(url).slice(0, 16) + (extname(new URL(url).pathname) || '.bin'));
  if (existsSync(file)) return file;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** The latin subset's woff2 from the Google Fonts CSS API. */
async function googleFont({ googleFonts, style }) {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=${googleFonts.replace(/ /g, '+')}&display=swap`,
      { headers: { 'User-Agent': UA } },
    )
  ).text();
  const blocks = css.split('/* ').filter((b) => b.startsWith('latin */'));
  const block = blocks.find((b) => b.includes(`font-style: ${style}`));
  const url = block && /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
  if (!url) throw new Error(`No latin ${style} face for ${googleFonts}`);
  return download(url);
}

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });

function encode(asset, input, target) {
  const p = asset.process ?? {};
  const ext = extname(target);
  if (ext === '.woff2') return void writeFileSync(target, readFileSync(input));
  if (ext === '.webp') {
    const png = join(cache, `${sha(target).slice(0, 12)}.png`);
    const vf = p.vf ?? "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease";
    run('ffmpeg', ['-y', '-i', input, '-vf', vf, '-frames:v', '1', png]);
    run('cwebp', ['-q', String(p.quality ?? 82), '-m', '6', '-mt', png, '-o', target]);
    return;
  }
  if (ext === '.mp4') {
    // A seamless loop: the clip's last `xfade` seconds dissolve into its first, so the end
    // frame is the start frame.
    const { start = 0, seconds = 15, xfade = 1 } = p;
    const vf = p.vf ? `,${p.vf}` : '';
    const graph =
      `[0:v]split[a][b];[a]trim=start=${xfade}:end=${seconds + xfade},setpts=PTS-STARTPTS[A];` +
      `[b]trim=start=0:end=${xfade},setpts=PTS-STARTPTS[B];` +
      `[A][B]xfade=transition=fade:duration=${xfade}:offset=${seconds - xfade}` +
      `,scale='min(1920,iw)':-2,fps=30${vf},format=yuv420p[out]`;
    run('ffmpeg', [
      '-y',
      '-ss',
      String(start),
      '-t',
      String(seconds + xfade + 0.5),
      '-i',
      input,
      '-filter_complex',
      graph,
      '-map',
      '[out]',
      '-an',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-preset',
      'slow',
      '-crf',
      String(p.crf ?? 26),
      '-movflags',
      '+faststart',
      target,
    ]);
    return;
  }
  if (ext === '.m4a') {
    const { start = 0, seconds, fadeIn = 0, fadeOut = 0 } = p;
    const filters = ['loudnorm=I=-18:TP=-1.5:LRA=11'];
    if (fadeIn) filters.push(`afade=t=in:d=${fadeIn}`);
    if (fadeOut && seconds) filters.push(`afade=t=out:st=${seconds - fadeOut}:d=${fadeOut}`);
    if (p.af) filters.push(p.af);
    run('ffmpeg', [
      '-y',
      '-ss',
      String(start),
      ...(seconds ? ['-t', String(seconds)] : []),
      '-i',
      input,
      '-vn',
      '-af',
      filters.join(','),
      '-ac',
      '2',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      target,
    ]);
    return;
  }
  throw new Error(`${asset.path}: no encoder for ${ext}`);
}

let built = 0;
for (const asset of assets) {
  if (only && !asset.path.startsWith(only)) continue;
  const target = join(out, asset.path);
  const recipe = recipeOf(asset);
  const known = index.files[asset.path];
  // A font's licence travels beside it, one file per family.
  const licenceFile = asset.licenceText
    ? `${dirname(asset.path)}/OFL-${asset.credit.title.replace(/ Italic$/, '').replace(/\W+/g, '')}.txt`
    : undefined;
  if (!force && known?.recipe === recipe && existsSync(target)) {
    // Credits can change without encoding again.
    Object.assign(known, { credit: asset.credit, name: asset.name, licenceFile });
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  const input = asset.fetch.googleFonts
    ? await googleFont(asset.fetch)
    : await download(asset.fetch.url);
  encode(asset, input, target);
  if (licenceFile)
    writeFileSync(join(out, licenceFile), readFileSync(await download(asset.licenceText)));
  const data = readFileSync(target);
  index.files[asset.path] = {
    name: asset.name,
    mime: MIME[extname(target)],
    bytes: statSync(target).size,
    sha256: sha(data),
    recipe,
    credit: asset.credit,
    ...(licenceFile ? { licenceFile } : {}),
  };
  built++;
  console.log(`built ${asset.path} (${(data.length / 1024).toFixed(0)} KB)`);
}

// Drop files that left sources.json.
const paths = new Set(assets.map((a) => a.path));
for (const path of Object.keys(index.files)) if (!paths.has(path)) delete index.files[path];
index.files = Object.fromEntries(
  Object.entries(index.files).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
console.log(`${built} built, ${Object.keys(index.files).length} in the index.`);
