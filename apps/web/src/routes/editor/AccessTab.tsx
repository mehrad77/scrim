import { cueOrder, type AccessText, type Cue, type Show } from '@scrim/format';
import { Captions, Eraser, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usesAccess } from '../../lib/access.js';
import { cn } from '../../lib/cn.js';
import { syntheticLayer } from '../../lib/layers.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, Select, TextArea, Toggle } from '../../ui/Field.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';

/** Languages offered for a show's own words; any code can still be typed into the show file. */
const COMMON = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'pl',
  'sv',
  'cy',
  'ga',
  'ar',
  'he',
  'fa',
  'ur',
  'hi',
  'bn',
  'zh',
  'ja',
  'ko',
  'vi',
  'tr',
  'ru',
  'uk',
  'ro',
  'el',
  'sw',
  'tl',
];

/** "French (fr)", in the editor's own language. */
export function languageLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
    return name && name !== code ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

type Kind = keyof AccessText;

/**
 * The access coordinator's page (users-and-journey › personal access channel): captions,
 * audio description and content warnings written against the cue list, in the show's language
 * and its translations, and the audience moments' words in each language.
 */
export function AccessTab() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const languages = show.languages ?? { base: 'en', others: [] };
  const [lang, setLang] = useState(languages.base);
  const editing = [languages.base, ...languages.others].includes(lang) ? lang : languages.base;
  const translating = editing !== languages.base;
  const order = useMemo(() => cueOrder(show), [show]);
  const openCaptions = show.layers.some(
    (l) => l.kind === 'text' && /\{\{\s*caption\s*\}\}/.test(l.text),
  );

  const setLanguages = (next: { base: string; others: string[] }) =>
    update((d) => {
      d.languages = next;
      if (next.base === 'en' && !next.others.length) delete d.languages;
    });

  const addOpenCaptions = () => {
    const out = show.outputs[0];
    if (!out) return;
    update((d) => {
      const layer = syntheticLayer(d, out, 'text');
      if (layer.kind !== 'text') return;
      Object.assign(layer, {
        name: 'Open captions',
        text: '{{caption}}',
        visible: true,
        fontSize: Math.round(out.height / 22),
        sizing: 'autoHeight',
        background: 'rgba(0,0,0,0.6)',
        x: Math.round(out.width * 0.1),
        w: Math.round(out.width * 0.8),
        y: Math.round(out.height * 0.82),
        h: Math.round(out.height * 0.12),
        pin: { x: 'center', y: 'bottom' },
      });
      d.layers.push(layer);
    });
    toast('Open captions added to the stage: a text layer showing {{caption}}', 'good');
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-px bg-line-subtle">
      <section className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-panel px-3 py-2 text-caption text-fg-muted">
        <label className="flex items-center gap-2">
          The show is written in
          <Select
            className="w-48"
            value={languages.base}
            onChange={(e) =>
              setLanguages({
                base: e.target.value,
                others: languages.others.filter((o) => o !== e.target.value),
              })
            }
          >
            {[...new Set([languages.base, ...COMMON])].map((c) => (
              <option key={c} value={c}>
                {languageLabel(c)}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          Translated into
          {languages.others.map((o) => (
            <span
              key={o}
              className="flex items-center gap-1 rounded-control border border-line-control px-2 py-0.5 text-fg"
            >
              {languageLabel(o)}
              <IconButton
                label={`Stop translating into ${languageLabel(o)}`}
                icon={<X size={12} />}
                className="size-5"
                onClick={() =>
                  setLanguages({ ...languages, others: languages.others.filter((x) => x !== o) })
                }
              />
            </span>
          ))}
          <Select
            aria-label="Add a language"
            className="w-44"
            value=""
            onChange={(e) =>
              e.target.value &&
              setLanguages({ ...languages, others: [...languages.others, e.target.value] })
            }
          >
            <option value="">Add a language…</option>
            {COMMON.filter((c) => c !== languages.base && !languages.others.includes(c)).map(
              (c) => (
                <option key={c} value={c}>
                  {languageLabel(c)}
                </option>
              ),
            )}
          </Select>
        </div>
        {languages.others.length > 0 && (
          <label className="flex items-center gap-2">
            Writing in
            <Select className="w-48" value={editing} onChange={(e) => setLang(e.target.value)}>
              {[languages.base, ...languages.others].map((c) => (
                <option key={c} value={c}>
                  {languageLabel(c)}
                  {c === languages.base ? ' — the show’s own' : ''}
                </option>
              ))}
            </Select>
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          {openCaptions ? (
            <span className="flex items-center gap-1.5 text-fg-subtle">
              <Captions size={14} /> Captions also show on stage
            </span>
          ) : (
            <Button
              size="sm"
              icon={<Captions size={13} />}
              onClick={addOpenCaptions}
              title="A text layer showing {{caption}} at the bottom of the first output, for everyone"
            >
              Add open captions on stage
            </Button>
          )}
        </div>
      </section>

      <div
        className={cn(
          'grid min-h-0 gap-px',
          translating ? 'grid-cols-[minmax(0,1fr)_20rem]' : 'grid-cols-1',
        )}
      >
        <Panel
          title={translating ? `Access track · ${languageLabel(editing)}` : 'Access track'}
          bodyClassName="p-0"
        >
          {!translating && (
            <p className="max-w-[80ch] px-3 pt-2 pb-1 text-caption text-fg-subtle">
              {usesAccess(show)
                ? 'Phones that ask for it get captions, audio description read by their own voice, a buzz on the cues you mark, and the warning of the cue on standby. Each person’s choices stay on their phone.'
                : 'Write a caption, a description or a warning against a cue, and audience phones offer them in their Access menu. Add a language above to translate them and the moments.'}
            </p>
          )}
          {!order.length ? (
            <Empty title="No cues yet">Captions and descriptions are written against cues.</Empty>
          ) : (
            <AccessTable show={show} order={order} lang={translating ? editing : null} />
          )}
        </Panel>
        {translating && (
          <Panel title="Audience moments" bodyClassName="p-3">
            <MomentTranslations show={show} lang={editing} />
          </Panel>
        )}
      </div>
    </div>
  );
}

function AccessTable({ show, order, lang }: { show: Show; order: Cue[]; lang: string | null }) {
  const update = useEditor((s) => s.update);
  // What a cue with no caption keeps showing: the latest caption above it.
  const carried = useMemo(() => {
    const out = new Map<string, string>();
    let last = '';
    for (const c of order) {
      out.set(c.id, last);
      if (c.access?.caption !== undefined) last = c.access.caption;
    }
    return out;
  }, [order]);

  const set = (cueId: string, kind: Kind, value: string | undefined) =>
    update((d) => {
      const c = d.cues.find((x) => x.id === cueId);
      if (!c) return;
      const a = (c.access ??= {});
      if (lang) {
        const t = ((a.i18n ??= {})[lang] ??= {});
        if (value) t[kind] = value;
        else delete t[kind];
        if (!Object.keys(t).length) delete a.i18n[lang];
        if (!Object.keys(a.i18n).length) delete a.i18n;
      } else if (value === undefined) delete a[kind];
      else a[kind] = value;
      if (!Object.keys(a).length) delete c.access;
    });

  let scene = '';
  return (
    <table className="w-full border-collapse text-ui">
      <thead className="sticky top-0 z-10 bg-panel text-left text-caption text-fg-subtle">
        <tr>
          <th className="w-10 px-2 py-1.5 font-normal">#</th>
          <th className="w-36 px-2 py-1.5 font-normal">Cue</th>
          <th className="px-2 py-1.5 font-normal">Caption: what is said or sung</th>
          <th className="px-2 py-1.5 font-normal">Audio description: what is seen</th>
          <th className="w-48 px-2 py-1.5 font-normal">Warning, shown while on standby</th>
          {!lang && <th className="w-16 px-2 py-1.5 font-normal">Buzz</th>}
        </tr>
      </thead>
      <tbody>
        {order.map((c, i) => {
          const sceneName = show.scenes.find((s) => s.id === c.sceneId)?.name ?? '';
          const header = sceneName !== scene;
          scene = sceneName;
          const own = (k: Kind) => c.access?.[k] ?? '';
          const value = (k: Kind) => (lang ? (c.access?.i18n?.[lang]?.[k] ?? '') : own(k));
          const cleared = !lang && c.access?.caption === '';
          return [
            header && (
              <tr key={`s:${c.id}`}>
                <td
                  colSpan={6}
                  className="label-caps border-t border-line-subtle px-2 pt-3 pb-1 text-fg-subtle"
                >
                  {sceneName}
                </td>
              </tr>
            ),
            <tr key={c.id} className="border-t border-line-subtle align-top">
              <td className="px-2 py-1.5 font-mono text-caption text-fg-subtle tabular-nums">
                {i + 1}
              </td>
              <td className="px-2 py-1.5">{c.name}</td>
              <td className="px-1 py-1">
                <div className="flex items-start gap-1">
                  <Cell
                    key={`${c.id}:caption:${lang}`}
                    label={`Caption for ${c.name}`}
                    value={value('caption')}
                    placeholder={
                      lang
                        ? own('caption')
                        : cleared
                          ? 'Clears the caption here'
                          : carried.get(c.id)
                            ? `Still: ${carried.get(c.id)}`
                            : ''
                    }
                    onCommit={(v) =>
                      set(c.id, 'caption', lang ? v : v || (cleared ? '' : undefined))
                    }
                  />
                  {!lang && (
                    <IconButton
                      label={cleared ? 'Keep the caption from before' : 'Clear the caption here'}
                      icon={<Eraser size={13} />}
                      aria-pressed={cleared}
                      variant={cleared ? 'primary' : 'ghost'}
                      onClick={() => set(c.id, 'caption', cleared ? undefined : '')}
                    />
                  )}
                </div>
              </td>
              <td className="px-1 py-1">
                <Cell
                  key={`${c.id}:description:${lang}`}
                  label={`Audio description for ${c.name}`}
                  value={value('description')}
                  placeholder={lang ? own('description') : ''}
                  onCommit={(v) => set(c.id, 'description', v || undefined)}
                />
              </td>
              <td className="px-1 py-1">
                <Cell
                  key={`${c.id}:warning:${lang}`}
                  label={`Warning before ${c.name}`}
                  value={value('warning')}
                  placeholder={lang ? own('warning') : 'e.g. Loud bang'}
                  onCommit={(v) => set(c.id, 'warning', v || undefined)}
                />
              </td>
              {!lang && (
                <td className="px-2 py-2">
                  <Toggle
                    checked={!!c.access?.buzz}
                    onChange={(on) =>
                      update((d) => {
                        const x = d.cues.find((y) => y.id === c.id);
                        if (!x) return;
                        const a = (x.access ??= {});
                        if (on) a.buzz = true;
                        else delete a.buzz;
                        if (!Object.keys(a).length) delete x.access;
                      })
                    }
                    label={<span className="sr-only">Buzz phones at {c.name}</span>}
                  />
                </td>
              )}
            </tr>,
          ];
        })}
      </tbody>
    </table>
  );
}

function Cell({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
}) {
  return (
    <TextArea
      aria-label={label}
      // Arabic, Hebrew and the like read right to left, whatever the editor's direction.
      dir="auto"
      rows={1}
      defaultValue={value}
      placeholder={placeholder}
      className="field-sizing-content min-h-control w-full resize-none"
      onBlur={(e) => e.target.value.trim() !== value && onCommit(e.target.value.trim())}
    />
  );
}

/** The prompt and options of every moment, in one translation. */
function MomentTranslations({ show, lang }: { show: Show; lang: string }) {
  const update = useEditor((s) => s.update);
  if (!show.moments.length)
    return <p className="text-caption text-fg-subtle">This show has no audience moments.</p>;
  const set = (
    momentId: string,
    fn: (t: { prompt?: string; options?: Record<string, string> }) => void,
  ) =>
    update((d) => {
      const m = d.moments.find((x) => x.id === momentId);
      if (!m) return;
      const t = ((m.i18n ??= {})[lang] ??= {});
      fn(t);
      if (t.options && !Object.keys(t.options).length) delete t.options;
      if (!Object.keys(t).length) delete m.i18n[lang];
      if (!Object.keys(m.i18n).length) delete m.i18n;
    });
  return (
    <div className="flex flex-col gap-4">
      {show.moments.map((m) => {
        const t = m.i18n?.[lang];
        return (
          <div key={m.id} className="flex flex-col gap-1.5">
            <div className="text-ui font-medium">{m.name}</div>
            <CommitInput
              aria-label={`${m.name}: prompt in ${languageLabel(lang)}`}
              dir="auto"
              lang={lang}
              value={t?.prompt ?? ''}
              placeholder={m.prompt}
              onCommit={(v) =>
                set(m.id, (x) => {
                  if (v.trim()) x.prompt = v.trim();
                  else delete x.prompt;
                })
              }
            />
            {m.type === 'vote' &&
              m.options.map((o) => (
                <CommitInput
                  key={o.id}
                  aria-label={`${o.label} in ${languageLabel(lang)}`}
                  dir="auto"
                  lang={lang}
                  className="ml-4"
                  value={t?.options?.[o.id] ?? ''}
                  placeholder={o.label}
                  onCommit={(v) =>
                    set(m.id, (x) => {
                      x.options ??= {};
                      if (v.trim()) x.options[o.id] = v.trim();
                      else delete x.options[o.id];
                    })
                  }
                />
              ))}
          </div>
        );
      })}
      <p className="flex items-center gap-1 text-caption text-fg-subtle">
        <Plus size={12} /> Empty fields fall back to the show’s own words.
      </p>
    </div>
  );
}
