import { RotateCcw, Search, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Button as AriaButton,
  Dialog,
  Heading,
  Input,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  SearchField,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components';
import { readLocal, writeLocal } from '../lib/local.js';
import {
  DEFAULT_PREFS,
  readPrefs,
  writePrefs,
  type ContrastPref,
  type MotionPref,
  type Prefs,
  type ThemePref,
} from '../lib/prefs.js';
import { usePrefs } from '../lib/usePrefs.js';
import { Button, IconButton } from './Button.js';
import { isEscapePanic } from './escape.js';
import { Toggle } from './Field.js';
import { resetLayouts } from './Layout.js';
import { toast } from './toast.js';

/**
 * The Preferences dialog itself. `PreferencesHost` (PreferencesHost.tsx) loads this module the
 * first time it opens, so no surface pays for it up front.
 */
export default function PreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    // Below the toast lane (z-40), so an Undo toast stays visible and clickable over the backdrop.
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      isKeyboardDismissDisabled={isEscapePanic()}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
    >
      <Modal
        data-overlay-open
        className="flex max-h-[min(720px,calc(100vh-32px))] w-[min(640px,calc(100vw-32px))] flex-col rounded-overlay border border-line-strong bg-overlay text-fg shadow-overlay"
      >
        <Dialog className="flex min-h-0 flex-col outline-none">
          {({ close }) => <PreferencesPanel close={close} />}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------------------------------------------------------------------------------------------
// Rows

type Section = 'Appearance' | 'Help' | 'Layout';
const SECTIONS: Section[] = ['Appearance', 'Help', 'Layout'];

interface Row {
  id: string;
  section: Section;
  label: string;
  description: string;
  /** Extra words the search matches. */
  keywords: string;
  /** The preferences this row edits. It counts as changed when any differs from its default. */
  keys: (keyof Prefs)[];
  control: (prefs: Prefs) => ReactNode;
}

interface Option<T> {
  value: T;
  label: string;
}

const THEMES: Option<ThemePref>[] = [
  { value: 'booth', label: 'Booth' },
  { value: 'paper', label: 'Paper' },
  { value: 'system', label: 'System' },
];
const CONTRASTS: Option<ContrastPref>[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
  { value: 'system', label: 'System' },
];
const SCALES: Option<number>[] = [
  { value: 0.9, label: '90%' },
  { value: 1, label: '100%' },
  { value: 1.1, label: '110%' },
  { value: 1.25, label: '125%' },
];
const DENSITIES: Option<Prefs['editorDensity']>[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
];
const MOTIONS: Option<MotionPref>[] = [
  { value: 'system', label: 'System' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'full', label: 'Full' },
];

const HUE_MIN = 50;
const HUE_MAX = 355;
const ACCENTS = [
  { name: 'UV', hue: 330 },
  { name: 'Violet', hue: 295 },
  { name: 'Indigo', hue: 265 },
  { name: 'Blue', hue: 235 },
  { name: 'Cyan', hue: 205 },
  { name: 'Teal', hue: 175 },
  { name: 'Green', hue: 145 },
  { name: 'Lime', hue: 115 },
];
const swatch = (hue: number) => `oklch(0.72 0.17 ${hue})`;
/** The slider track shows the hue under the thumb, from 50 to 355 degrees. */
const HUE_TRACK = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) =>
  swatch(Math.round(HUE_MIN + (i * (HUE_MAX - HUE_MIN)) / 12)),
).join(', ')})`;

const ROWS: Row[] = [
  {
    id: 'theme',
    section: 'Appearance',
    label: 'Theme',
    description: 'Booth is dark for the tech table; Paper is light for daytime work.',
    keywords: 'dark light mode colour color night day',
    keys: ['theme'],
    control: (p) => (
      <Segmented
        label="Theme"
        value={p.theme}
        options={THEMES}
        onChange={(theme) => writePrefs({ theme })}
      />
    ),
  },
  {
    id: 'accent',
    section: 'Appearance',
    label: 'Accent',
    description:
      'One colour for selection and focus. Reds and ambers are reserved for faults and warnings.',
    keywords: 'colour color hue highlight swatch',
    keys: ['accentHue'],
    control: (p) => <AccentControl hue={p.accentHue} />,
  },
  {
    id: 'contrast',
    section: 'Appearance',
    label: 'Contrast',
    description: 'High strengthens text and borders. System follows your device.',
    keywords: 'high contrast accessibility visibility',
    keys: ['contrast'],
    control: (p) => (
      <Segmented
        label="Contrast"
        value={p.contrast}
        options={CONTRASTS}
        onChange={(contrast) => writePrefs({ contrast })}
      />
    ),
  },
  {
    id: 'scale',
    section: 'Appearance',
    label: 'Interface size',
    description: 'Scales text and controls. Output windows are never scaled.',
    keywords: 'scale zoom text size larger smaller font',
    keys: ['uiScale'],
    control: (p) => (
      <Segmented
        label="Interface size"
        value={p.uiScale}
        options={SCALES}
        onChange={(uiScale) => writePrefs({ uiScale })}
      />
    ),
  },
  {
    id: 'density',
    section: 'Appearance',
    label: 'Editor density',
    description: 'How tightly the editor packs its lists and fields.',
    keywords: 'compact comfortable spacing padding',
    keys: ['editorDensity'],
    control: (p) => (
      <Segmented
        label="Editor density"
        value={p.editorDensity}
        options={DENSITIES}
        onChange={(editorDensity) => writePrefs({ editorDensity })}
      />
    ),
  },
  {
    id: 'motion',
    section: 'Appearance',
    label: 'Motion',
    description: 'Show mode always uses reduced motion.',
    keywords: 'animation reduced accessibility',
    keys: ['motion'],
    control: (p) => (
      <Segmented
        label="Motion"
        value={p.motion}
        options={MOTIONS}
        onChange={(motion) => writePrefs({ motion })}
      />
    ),
  },
  {
    id: 'brightness',
    section: 'Appearance',
    label: 'Thumbnail brightness',
    description:
      "Dims operator thumbnails in the Booth theme so a bright slide isn't the brightest light in the room.",
    keywords: 'dim operator slides preview',
    keys: ['thumbBrightness'],
    control: (p) => (
      <Range
        label="Thumbnail brightness"
        value={Math.round(p.thumbBrightness * 100)}
        min={30}
        max={100}
        unit="%"
        onChange={(v) => writePrefs({ thumbBrightness: v / 100 })}
      />
    ),
  },
  {
    id: 'info-strip',
    section: 'Help',
    label: 'Info strip',
    description: "The line along the bottom that names what's under the pointer.",
    keywords: 'hint status bar tooltip',
    keys: ['infoStrip'],
    control: (p) => (
      <OnOff
        name="Info strip"
        checked={p.infoStrip}
        onChange={(infoStrip) => writePrefs({ infoStrip })}
      />
    ),
  },
  {
    id: 'single-keys',
    section: 'Help',
    label: 'Single-key shortcuts',
    description:
      'Editor shortcuts that are one key with no modifier. GO and PANIC keys always work.',
    keywords: 'keyboard hotkeys keys accessibility',
    keys: ['singleKeys'],
    control: (p) => (
      <OnOff
        name="Single-key shortcuts"
        checked={p.singleKeys}
        onChange={(singleKeys) => writePrefs({ singleKeys })}
      />
    ),
  },
  {
    id: 'layouts',
    section: 'Layout',
    label: 'Panel layouts',
    description: 'Put every panel back to its default size and position.',
    keywords: 'panels sizes arrangement reset',
    keys: [],
    control: () => (
      <Button
        onClick={() => {
          const undo = resetLayouts();
          toast('Panel layouts reset', 'info', { label: 'Undo', run: undo });
        }}
      >
        Reset all layouts
      </Button>
    ),
  },
];

const matches = (row: Row, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    [row.section, row.label, row.description, row.keywords].join(' ').toLowerCase().includes(q)
  );
};

const sameValue = (a: unknown, b: unknown): boolean =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b;

const isChanged = (row: Row, prefs: Prefs): boolean =>
  row.keys.some((k) => !sameValue(prefs[k], DEFAULT_PREFS[k]));

function pickKeys(source: Partial<Prefs>, keys: readonly (keyof Prefs)[]): Partial<Prefs> {
  const entries = keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]);
  return Object.fromEntries(entries) as Partial<Prefs>;
}

// ---------------------------------------------------------------------------------------------
// The dialog

function PreferencesPanel({ close }: { close: () => void }) {
  const prefs = usePrefs();
  const [query, setQuery] = useState('');
  const [incoming, setIncoming] = useState<ImportData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = ROWS.filter((r) => matches(r, query));
  const anyChanged = ROWS.some((r) => isChanged(r, prefs));

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear it so choosing the same file again still fires a change.
    e.target.value = '';
    if (!file) return;
    const data = await readImport(file);
    if (!data) toast("That file isn't a Scrim preferences file", 'error');
    else if (!importParts(data).length) toast('That file has no preferences to import', 'info');
    else setIncoming(data);
  };

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Heading slot="title" className="text-title font-semibold">
              {incoming ? 'Import preferences' : 'Preferences'}
            </Heading>
            <p className="text-caption text-fg-subtle">
              {incoming
                ? 'Choose what to bring in from this file.'
                : "Saved on this machine. Shows aren't affected."}
            </p>
          </div>
          <IconButton label="Close" icon={<X size={14} />} onClick={close} />
        </div>
        {!incoming && (
          <SearchField
            aria-label="Search preferences"
            autoFocus
            value={query}
            onChange={setQuery}
            className="group relative"
          >
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-fg-icon"
            />
            <Input
              placeholder="Search preferences"
              className="h-control w-full rounded-control border border-line-control bg-control pr-7 pl-7 text-ui text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-search-cancel-button]:appearance-none"
            />
            <AriaButton
              aria-label="Clear search"
              className="absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center rounded-control text-fg-icon outline-none group-data-[empty]:hidden hover:bg-control-hover data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
            >
              <X size={14} />
            </AriaButton>
          </SearchField>
        )}
      </header>

      {incoming ? (
        <ImportView
          data={incoming}
          onCancel={() => setIncoming(null)}
          onDone={() => {
            setIncoming(null);
            close();
          }}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-1">
            {visible.length === 0 ? (
              <p role="status" className="py-8 text-center text-ui text-fg-subtle">
                Nothing matches
              </p>
            ) : (
              SECTIONS.map((section) => {
                const rows = visible.filter((r) => r.section === section);
                if (!rows.length) return null;
                return (
                  <section key={section} aria-label={section} className="pt-3">
                    <h3 className="label-caps text-fg-subtle">{section}</h3>
                    <ul>
                      {rows.map((row) => (
                        <PrefRow key={row.id} row={row} prefs={prefs} />
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
          <footer className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-4 py-3">
            <p className="min-w-0 flex-1 text-caption text-fg-subtle">
              A dot marks a setting you've changed.
            </p>
            <Button variant="ghost" disabled={!anyChanged} onClick={resetAll}>
              Reset all
            </Button>
            <Button onClick={exportPreferences}>Export…</Button>
            <Button onClick={() => fileInput.current?.click()}>Import…</Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              aria-hidden
              tabIndex={-1}
              className="hidden"
              onChange={(e) => void onPick(e)}
            />
          </footer>
        </>
      )}
    </>
  );
}

function PrefRow({ row, prefs }: { row: Row; prefs: Prefs }) {
  const changed = isChanged(row, prefs);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle py-3 last:border-b-0">
      <div className="min-w-48 flex-1">
        <div className="text-ui text-fg">{row.label}</div>
        <p className="text-caption text-fg-subtle">{row.description}</p>
      </div>
      <div className="flex items-center gap-2">
        {row.control(prefs)}
        <span className="flex w-2 justify-center">
          {changed && (
            <>
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              <span className="sr-only">Changed</span>
            </>
          )}
        </span>
        <span className="w-7">
          {changed && (
            <IconButton
              label="Reset to default"
              aria-label={`Reset ${row.label.toLowerCase()} to default`}
              icon={<RotateCcw size={14} />}
              onClick={() => writePrefs(pickKeys(DEFAULT_PREFS, row.keys))}
            />
          )}
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// Controls

/** A row of mutually exclusive choices. */
function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[String(value)]}
      onSelectionChange={(keys) => {
        const next = options.find((o) => keys.has(String(o.value)));
        if (next) onChange(next.value);
      }}
      className="inline-flex gap-0.5 rounded-control border border-line-control bg-control p-0.5"
    >
      {options.map((o) => (
        <ToggleButton
          key={String(o.value)}
          id={String(o.value)}
          className="h-6 rounded-control px-2.5 text-caption font-medium text-fg-muted outline-none select-none hover:bg-control-hover hover:text-fg data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus data-[selected]:bg-control-active data-[selected]:text-fg"
        >
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** A slider with its value beside it. The track may carry its own background. */
function Range({
  label,
  value,
  min,
  max,
  unit,
  track,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  track?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Slider
      aria-label={label}
      minValue={min}
      maxValue={max}
      step={1}
      value={value}
      onChange={onChange}
      className="flex w-56 items-center gap-3"
    >
      <SliderTrack className="relative flex h-5 flex-1 items-center">
        {({ state }) => (
          <>
            <div
              className="h-1 w-full rounded-control bg-line-control"
              style={track ? { background: track } : undefined}
            />
            {!track && (
              <div
                className="absolute h-1 rounded-control bg-fg-muted"
                style={{ width: `${state.getThumbPercent(0) * 100}%` }}
              />
            )}
            <SliderThumb className="top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-fg bg-app outline-none data-[dragging]:bg-fg data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus" />
          </>
        )}
      </SliderTrack>
      <SliderOutput className="w-11 shrink-0 text-right font-mono text-caption text-fg-muted tabular-nums">
        {({ state }) => `${state.getThumbValue(0)}${unit}`}
      </SliderOutput>
    </Slider>
  );
}

/** Eight preset swatches over a hue slider; both write the same preference. */
function AccentControl({ hue }: { hue: number }) {
  const preset = ACCENTS.find((a) => a.hue === hue);
  return (
    <div className="flex flex-col items-end gap-1">
      <RadioGroup
        aria-label="Accent presets"
        orientation="horizontal"
        value={preset ? String(preset.hue) : null}
        onChange={(v) => writePrefs({ accentHue: Number(v) })}
        className="flex gap-1.5"
      >
        {ACCENTS.map((a) => (
          <Radio
            key={a.name}
            value={String(a.hue)}
            aria-label={a.name}
            style={{ background: swatch(a.hue) }}
            className="block size-5 cursor-default rounded-control outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus data-[selected]:ring-2 data-[selected]:ring-fg data-[selected]:ring-inset"
          />
        ))}
      </RadioGroup>
      <Range
        label="Accent hue"
        value={hue}
        min={HUE_MIN}
        max={HUE_MAX}
        unit="°"
        track={HUE_TRACK}
        onChange={(accentHue) => writePrefs({ accentHue })}
      />
    </div>
  );
}

/** A checkbox whose name is the row's label; "On" and "Off" are just a visible hint. */
function OnOff({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Toggle
      checked={checked}
      onChange={onChange}
      label={
        <>
          <span className="sr-only">{name}</span>
          <span aria-hidden className="w-6">
            {checked ? 'On' : 'Off'}
          </span>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Reset, export and import

/** Put every preference back to its default, with an Undo. Panel layouts are separate. */
function resetAll(): void {
  const before = readPrefs();
  writePrefs({ ...DEFAULT_PREFS });
  toast('Preferences reset', 'info', { label: 'Undo', run: () => writePrefs(before) });
}

const LAYOUT_PREFIX = 'scrim.layout.';
/** react-resizable-panels adds its own prefix to the id that Layout.tsx gives it. */
const isLayoutKey = (key: string): boolean =>
  key.startsWith(LAYOUT_PREFIX) || key.startsWith(`react-resizable-panels:${LAYOUT_PREFIX}`);

function layoutKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isLayoutKey(key)) keys.push(key);
    }
  } catch {
    // storage unavailable; there are no saved layouts to list
  }
  return keys;
}

function exportPreferences(): void {
  const layouts: Record<string, unknown> = {};
  for (const key of layoutKeys()) {
    const value = readLocal<unknown>(key, null);
    if (value !== null) layouts[key] = value;
  }
  const file = {
    app: 'scrim',
    kind: 'preferences',
    version: 1,
    exportedAt: new Date().toISOString(),
    prefs: readPrefs(),
    layouts,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'scrim-preferences.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** What an imported file may bring in, after checking every value. */
interface ImportData {
  appearance: Partial<Prefs>;
  help: Partial<Prefs>;
  layouts: Record<string, Record<string, number>>;
}

const APPEARANCE_KEYS: (keyof Prefs)[] = [
  'theme',
  'accentHue',
  'contrast',
  'uiScale',
  'editorDensity',
  'motion',
  'thumbBrightness',
];
const HELP_KEYS: (keyof Prefs)[] = ['infoStrip', 'singleKeys'];
const MAX_IMPORT_BYTES = 1_000_000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keep only known keys with valid values; out-of-range numbers are clamped. */
function cleanPrefs(raw: unknown): Partial<Prefs> {
  if (!isRecord(raw)) return {};
  const { theme, contrast, motion, uiScale, accentHue, editorDensity, thumbBrightness } = raw;
  const { infoStrip, singleKeys } = raw;
  const out: Partial<Prefs> = {};
  if (theme === 'booth' || theme === 'paper' || theme === 'system') out.theme = theme;
  if (contrast === 'standard' || contrast === 'high' || contrast === 'system')
    out.contrast = contrast;
  if (motion === 'system' || motion === 'reduced' || motion === 'full') out.motion = motion;
  if (typeof uiScale === 'number' && SCALES.some((s) => s.value === uiScale)) out.uiScale = uiScale;
  if (typeof accentHue === 'number' && Number.isFinite(accentHue))
    out.accentHue = clamp(Math.round(accentHue), HUE_MIN, HUE_MAX);
  if (editorDensity === 'compact' || editorDensity === 'comfortable')
    out.editorDensity = editorDensity;
  if (typeof thumbBrightness === 'number' && Number.isFinite(thumbBrightness))
    out.thumbBrightness = clamp(thumbBrightness, 0.3, 1);
  if (typeof infoStrip === 'boolean') out.infoStrip = infoStrip;
  if (typeof singleKeys === 'boolean') out.singleKeys = singleKeys;
  return out;
}

/** A saved layout is a map of panel id to size. */
function cleanLayouts(raw: unknown): ImportData['layouts'] {
  const out: ImportData['layouts'] = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isLayoutKey(key) || key.length > 200 || !isRecord(value)) continue;
    const sizes = Object.values(value);
    if (sizes.length && sizes.every((n) => typeof n === 'number' && Number.isFinite(n)))
      out[key] = value as Record<string, number>;
  }
  return out;
}

/** Null when the text isn't a Scrim preferences file. */
function parseImport(text: string): ImportData | null {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(file) || file.kind !== 'preferences') return null;
  const prefs = cleanPrefs(file.prefs);
  return {
    appearance: pickKeys(prefs, APPEARANCE_KEYS),
    help: pickKeys(prefs, HELP_KEYS),
    layouts: cleanLayouts(file.layouts),
  };
}

async function readImport(file: File): Promise<ImportData | null> {
  if (file.size > MAX_IMPORT_BYTES) return null;
  try {
    return parseImport(await file.text());
  } catch {
    return null;
  }
}

type ImportPart = 'appearance' | 'help' | 'layouts';

/** The parts of the file that have something in them. */
function importParts(data: ImportData): ImportPart[] {
  const parts: ImportPart[] = [];
  if (Object.keys(data.appearance).length) parts.push('appearance');
  if (Object.keys(data.help).length) parts.push('help');
  if (Object.keys(data.layouts).length) parts.push('layouts');
  return parts;
}

function storedRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function restoreRaw(key: string, raw: string | null): void {
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  } catch {
    // storage unavailable; nothing to restore
  }
}

/** Write the picked parts, then offer Undo. Layouts apply the next time a screen opens. */
function applyImport(data: ImportData, picked: ImportPart[]): void {
  const before = readPrefs();
  const patch: Partial<Prefs> = {
    ...(picked.includes('appearance') ? data.appearance : {}),
    ...(picked.includes('help') ? data.help : {}),
  };
  if (Object.keys(patch).length) writePrefs(patch);

  const layouts = picked.includes('layouts') ? Object.entries(data.layouts) : [];
  const previous = layouts.map(([key]) => [key, storedRaw(key)] as const);
  layouts.forEach(([key, value]) => writeLocal(key, value));

  toast(
    layouts.length
      ? 'Preferences imported. Panel layouts apply the next time you open a screen.'
      : 'Preferences imported',
    'good',
    {
      label: 'Undo',
      run: () => {
        writePrefs(before);
        previous.forEach(([key, raw]) => restoreRaw(key, raw));
      },
    },
  );
}

/** The checklist shown after choosing a file. */
function ImportView({
  data,
  onCancel,
  onDone,
}: {
  data: ImportData;
  onCancel: () => void;
  onDone: () => void;
}) {
  const parts = importParts(data);
  const [picked, setPicked] = useState<ImportPart[]>(parts);
  const toggle = (part: ImportPart, on: boolean) =>
    setPicked((p) => (on ? [...p, part] : p.filter((x) => x !== part)));
  const labels: Record<ImportPart, string> = {
    appearance: 'Appearance (theme, accent, contrast, size, density, motion, brightness)',
    help: 'Help (info strip, single-key shortcuts)',
    layouts: `Panel layouts (${Object.keys(data.layouts).length} saved)`,
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <ul className="flex flex-col gap-3">
          {parts.map((part) => (
            <li key={part}>
              <Toggle
                checked={picked.includes(part)}
                onChange={(on) => toggle(part, on)}
                label={labels[part]}
              />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-fg-subtle">Importing never changes a show.</p>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-line-subtle px-4 py-3">
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!picked.length}
          onClick={() => {
            applyImport(data, picked);
            onDone();
          }}
        >
          Apply
        </Button>
      </footer>
    </>
  );
}
