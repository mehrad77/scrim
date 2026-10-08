// Bundle budgets (DESIGN_SYSTEM.md › Guards). Run after `vite build`:
//   node scripts/bundle-budget.mjs            check
//   node scripts/bundle-budget.mjs --update   record the current sizes as the new baselines
// Each surface is measured as everything it downloads before it can run, gzipped. Output windows
// and the audience page run on show machines and phones, so they may grow at most 5% over their
// baseline; the editor may add 160 KB (DESIGN_SYSTEM.md › Guards).
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const budgetFile = new URL('../bundle-budget.json', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'));
const budget = JSON.parse(readFileSync(budgetFile, 'utf8'));

/** Every file a chunk loads before it can run: itself, its static imports and their CSS. */
function closure(key, files = new Set()) {
  const chunk = manifest[key];
  if (!chunk) throw new Error(`No chunk ${key} in the manifest`);
  if (files.has(chunk.file)) return files;
  files.add(chunk.file);
  for (const css of chunk.css ?? []) files.add(css);
  for (const imp of chunk.imports ?? []) closure(imp, files);
  return files;
}

const gz = (files) =>
  [...files].reduce((n, f) => n + gzipSync(readFileSync(new URL(f, dist))).length, 0);

const shell = closure('index.html');
const surfaces = {
  output: gz(closure('src/routes/OutputWindow.tsx', new Set(shell))),
  audience: gz(closure('audience.html')),
  // The shell plus the editor's first tab; the other tabs load when opened.
  editor: gz(closure('src/routes/editor/Editor.tsx', new Set(shell))),
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let failed = false;
for (const [name, size] of Object.entries(surfaces)) {
  const rule = budget[name];
  if (!rule) continue;
  const limit = rule.add ? rule.baseline + rule.add : Math.round(rule.baseline * (1 + rule.growth));
  const ok = size <= limit;
  failed ||= !ok;
  const change = `${size >= rule.baseline ? '+' : ''}${(((size - rule.baseline) / rule.baseline) * 100).toFixed(1)}%`;
  console.log(
    `${ok ? 'ok  ' : 'OVER'} ${name.padEnd(9)} ${kb(size).padStart(9)} gzip  ${change.padStart(7)}  (limit ${kb(limit)})`,
  );
}

if (process.argv.includes('--update')) {
  for (const [name, size] of Object.entries(surfaces)) budget[name].baseline = size;
  writeFileSync(budgetFile, `${JSON.stringify(budget, null, 2)}\n`);
  console.log('Baselines updated.');
} else if (failed) {
  console.error('Bundle budget exceeded. Trim the bundle, or update the baseline on purpose.');
  process.exit(1);
}
