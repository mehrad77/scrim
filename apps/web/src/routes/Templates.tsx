import type { Show } from '@scrim/format';
import {
  ArrowLeft,
  Download,
  FilePlus2,
  Layers,
  Radio,
  Vote,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Link, useNavigate, useParams } from 'react-router';
import { formatBytes } from '../lib/clock.js';
import { cn } from '../lib/cn.js';
import { STARTERS } from '../lib/starters.js';
import { saveShow } from '../storage/shows.js';
import { deleteTemplate, fromTemplate, listTemplates, saveTemplate } from '../storage/templates.js';
import { assetIndex, downloadNeeded, type AssetIndex, type Progress } from '../templates/assets.js';
import { createFromTemplate } from '../templates/create.js';
import { factsOf, placeholderMedia, type Fact } from '../templates/facts.js';
import { TEMPLATES } from '../templates/index.js';
import { GROUPS, thumbnailOf, type TemplateGroup, type TemplateSeed } from '../templates/types.js';
import { SpikeMark } from '../ui/BrandMark.js';
import { Button, IconButton } from '../ui/Button.js';
import { promptDialog } from '../ui/dialog.js';
import { Field, TextInput } from '../ui/Field.js';
import { isEscapePanic } from '../ui/escape.js';
import { errorToast, toast } from '../ui/toast.js';

const STARTER_ICONS: Record<string, LucideIcon> = { vote: Vote, slides: Layers, counter: Radio };
const TAPE_BG = [
  'bg-tape-1',
  'bg-tape-2',
  'bg-tape-3',
  'bg-tape-4',
  'bg-tape-5',
  'bg-tape-6',
  'bg-tape-7',
  'bg-tape-8',
];

const thumbUrl = (seed: TemplateSeed) => `${import.meta.env.BASE_URL}${thumbnailOf(seed)}`;

/** What the gallery knows about a template before anything downloads. */
interface Entry {
  seed: TemplateSeed;
  facts: Fact[];
  scenes: number;
  bytes: number;
}

/**
 * The template gallery (docs/templates.md): a starting show for each kind of person, grouped by
 * who it's for, with what it does read from the show itself. `/templates/:id` opens one.
 */
export default function Templates() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [index, setIndex] = useState<AssetIndex | null>(null);
  const [offline, setOffline] = useState(false);
  const [saved, setSaved] = useState<Show[]>([]);
  const [group, setGroup] = useState<TemplateGroup | null>(null);

  useEffect(() => {
    document.title = 'Templates · Scrim';
    assetIndex().then(setIndex, () => setOffline(true));
    void listTemplates().then(setSaved);
  }, []);

  const entries = useMemo(
    () =>
      index
        ? TEMPLATES.flatMap((seed): Entry[] => {
            try {
              const show = seed.make(placeholderMedia(seed, index));
              const bytes = new Set(seed.assets.map((a) => a.path));
              return [
                {
                  seed,
                  facts: factsOf(show),
                  scenes: show.scenes.length,
                  bytes: [...bytes].reduce((n, p) => n + (index.files[p]?.bytes ?? 0), 0),
                },
              ];
            } catch {
              return [];
            }
          })
        : [],
    [index],
  );
  const picked = id ? entries.find((e) => e.seed.id === id) : undefined;
  // A link to a template this version doesn't have: back to the gallery.
  useEffect(() => {
    if (id && index && !picked) navigate('/templates', { replace: true });
  }, [id, index, picked, navigate]);

  const open = async (show: Show) => {
    await saveShow(show);
    navigate(`/show/${show.id}`);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-4">
        <Link
          to="/"
          className="flex w-fit items-center gap-1 text-caption text-fg-muted outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        >
          <ArrowLeft size={14} aria-hidden /> Library
        </Link>
        <div className="flex items-start gap-3">
          <SpikeMark className="mt-1 size-9 shrink-0 text-accent" />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-display font-semibold tracking-tight">
              Start from a template
            </h1>
            <p className="max-w-2xl text-body text-fg-muted">
              Each one is a whole show for someone like you, ready to run tonight with real pictures
              and music. Change the words, swap in your own photos, and it’s yours.
            </p>
          </div>
        </div>
        <div role="group" aria-label="Who it’s for" className="flex flex-wrap gap-2">
          {[
            { id: null, title: 'All' },
            ...GROUPS.filter((g) => entries.some((e) => e.seed.group === g.id)),
          ].map((g) => (
            <button
              key={g.id ?? 'all'}
              aria-pressed={group === g.id}
              onClick={() => setGroup(g.id)}
              className={cn(
                'rounded-control border px-3 py-1 text-ui outline-none focus-visible:outline-2 focus-visible:outline-focus',
                group === g.id
                  ? 'border-fg bg-fg text-app'
                  : 'border-line-control text-fg-muted hover:bg-control-hover hover:text-fg',
              )}
            >
              {g.title}
            </button>
          ))}
        </div>
      </header>

      {offline && (
        <p role="status" className="rounded-control border border-line-control p-4 text-body">
          The templates need the internet the first time. Connect, then reload this page; the
          starters below work offline.
        </p>
      )}

      <ul aria-label="Templates" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {entries
          .filter((e) => !group || e.seed.group === group)
          .map((e) => (
            <TemplateCard
              key={e.seed.id}
              entry={e}
              onOpen={() => navigate(`/templates/${e.seed.id}`, { replace: true })}
            />
          ))}
      </ul>

      <section id="learn" aria-labelledby="learn-h" className="scroll-mt-6">
        <h2 id="learn-h" className="mb-1 font-display text-heading font-semibold">
          Learn one idea
        </h2>
        <p className="mb-4 text-caption text-fg-muted">
          Small shows that teach one thing each, with no media.
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {STARTERS.map((s) => {
            const Icon = STARTER_ICONS[s.id] ?? FilePlus2;
            return (
              <li key={s.id}>
                <button
                  onClick={() => void open(s.make())}
                  className="flex h-full w-full flex-col gap-2 rounded-control border border-line-subtle bg-panel p-4 text-left outline-none hover:border-line-control hover:bg-control focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <Icon size={18} className="text-fg-icon" aria-hidden />
                  <span className="font-display text-title font-semibold">{s.title}</span>
                  <span className="text-caption text-fg-muted">{s.blurb}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {saved.length > 0 && (
        <section aria-labelledby="yours-h">
          <h2 id="yours-h" className="mb-1 font-display text-heading font-semibold">
            Your templates
          </h2>
          <p className="mb-4 text-caption text-fg-muted">
            Saved on this machine with Save as template in the Library.
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {saved.map((t) => (
              <li key={t.id} className="group relative">
                <button
                  onClick={async () => {
                    const name = await promptDialog('New show from template', t.name, 'Show name');
                    if (name) await open(fromTemplate(t, name));
                  }}
                  className="flex h-full w-full flex-col gap-2 rounded-control border border-line-subtle bg-panel p-4 text-left outline-none hover:border-line-control hover:bg-control focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <Layers size={18} className="text-fg-icon" aria-hidden />
                  <span className="font-display text-title font-semibold">{t.name}</span>
                  <span className="text-caption text-fg-muted">{t.cues.length} cues</span>
                </button>
                <button
                  aria-label={`Delete template ${t.name}`}
                  onClick={async () => {
                    await deleteTemplate(t.id);
                    setSaved(await listTemplates());
                    toast(`Deleted template “${t.name}”`, 'info', {
                      label: 'Undo',
                      run: () =>
                        void saveTemplate(t, t.name).then(async () =>
                          setSaved(await listTemplates()),
                        ),
                    });
                  }}
                  className="absolute top-2 right-2 rounded-control p-1 text-fg-icon opacity-0 outline-none group-hover:opacity-100 hover:bg-control-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {picked && index && (
        <TemplateDetail
          entry={picked}
          index={index}
          onClose={() => navigate('/templates', { replace: true })}
          onMade={(show) => navigate(`/show/${show.id}`)}
        />
      )}
    </div>
  );
}

function Thumb({ seed, className }: { seed: TemplateSeed; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn('relative aspect-video overflow-hidden bg-black', className)}>
      {!failed && (
        <img
          src={thumbUrl(seed)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center p-4 text-center font-display text-heading text-fg-muted">
          {seed.title}
        </span>
      )}
    </div>
  );
}

function TemplateCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { seed, facts } = entry;
  return (
    <li>
      <button
        onClick={onOpen}
        className="group flex h-full w-full flex-col overflow-hidden rounded-control border border-line-subtle bg-panel text-left outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span
          aria-hidden
          className={cn(
            'h-1',
            TAPE_BG[GROUPS.findIndex((g) => g.id === seed.group) % TAPE_BG.length],
          )}
        />
        <Thumb seed={seed} className="border-b border-line-subtle" />
        <span className="flex flex-1 flex-col gap-2 p-4">
          <span className="label-caps text-fg-subtle">
            {GROUPS.find((g) => g.id === seed.group)?.title}
          </span>
          <span className="font-display text-heading font-semibold text-fg">{seed.title}</span>
          <span className="text-caption text-fg-muted">{seed.forWho}</span>
          <span className="mt-auto flex flex-wrap gap-1 pt-2">
            {facts.slice(0, 3).map((f) => (
              <span
                key={f.id}
                className="label-caps rounded-control border border-line-control px-1.5 py-0.5 text-fg-muted"
              >
                {f.label}
              </span>
            ))}
          </span>
        </span>
      </button>
    </li>
  );
}

/** One template: what it does for you, what it needs, its credits, and "Make my show". */
function TemplateDetail({
  entry,
  index,
  onClose,
  onMade,
}: {
  entry: Entry;
  index: AssetIndex;
  onClose: () => void;
  onMade: (show: Show) => void;
}) {
  const { seed, facts } = entry;
  const [name, setName] = useState(seed.title);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [needed, setNeeded] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void downloadNeeded(seed, index).then(
      (n) => alive && setNeeded(n),
      () => undefined,
    );
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [seed, index]);

  const credits = useMemo(() => {
    const seen = new Set<string>();
    return seed.assets.flatMap((a) => {
      const e = index.files[a.path];
      if (!e || seen.has(e.credit.url + e.credit.title)) return [];
      seen.add(e.credit.url + e.credit.title);
      return [e];
    });
  }, [seed, index]);

  const make = async (ev: FormEvent) => {
    ev.preventDefault();
    if (progress) return;
    abort.current = new AbortController();
    setProgress({ done: 0, total: 1, bytes: 0, totalBytes: 0 });
    try {
      const signal = abort.current.signal;
      const show = await createFromTemplate(seed, name, setProgress, signal);
      // Stopped or closed while the last file was being stored: make nothing.
      if (signal.aborted) return;
      await saveShow(show);
      toast(
        `“${show.name}” is ready. The Learn list in the Library shows how to make it yours.`,
        'good',
      );
      onMade(show);
    } catch (e) {
      setProgress(null);
      if (!abort.current.signal.aborted) errorToast(e);
    }
  };

  const busy = !!progress;
  const pct = progress && progress.totalBytes ? progress.bytes / progress.totalBytes : 0;

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(o) => !o && (abort.current?.abort(), onClose())}
      isDismissable={!busy}
      isKeyboardDismissDisabled={isEscapePanic()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <Modal className="flex max-h-[calc(100vh-32px)] w-[min(960px,calc(100vw-32px))] flex-col overflow-hidden rounded-overlay border border-line-strong bg-overlay text-fg shadow-overlay">
        <Dialog aria-label={seed.title} className="flex min-h-0 flex-col outline-none">
          <div className="relative">
            <Thumb seed={seed} />
            <IconButton
              label="Close"
              icon={<X size={14} />}
              className="absolute top-3 right-3 bg-overlay"
              onClick={() => (abort.current?.abort(), onClose())}
            />
          </div>
          <div className="grid min-h-0 gap-6 overflow-auto p-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-4">
              <div>
                <Heading slot="title" className="font-display text-heading font-semibold">
                  {seed.title}
                </Heading>
                <p className="mt-1 text-caption text-fg-subtle">For {lower(seed.forWho)}</p>
              </div>
              <p className="text-body">{seed.blurb}</p>
              <List title="What it does" items={facts.map((f) => `${f.label}: ${f.detail}`)} />
              <List title="You’ll need" items={seed.needs} />
              <List title="Make it yours" items={seed.replace} />
              <List title="Not yet" items={seed.limits} />
            </div>
            <div className="flex flex-col gap-4">
              <form
                onSubmit={make}
                className="flex flex-col gap-3 rounded-control border border-line-control p-4"
              >
                <Field label="Name your show">
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                    autoFocus
                  />
                </Field>
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  icon={<Download size={16} />}
                  disabled={busy}
                >
                  Make my show
                </Button>
                {progress ? (
                  <div className="flex flex-col gap-1">
                    <span
                      className="h-1 overflow-hidden rounded-control bg-control-hover"
                      aria-hidden
                    >
                      <span
                        className="block h-full origin-left bg-accent"
                        style={{ transform: `scaleX(${pct})` }}
                      />
                    </span>
                    <span role="status" className="text-caption text-fg-muted tabular-nums">
                      Getting the pictures and music: {progress.done} of {progress.total} files,{' '}
                      {formatBytes(progress.bytes)} of {formatBytes(progress.totalBytes)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
                      Stop
                    </Button>
                  </div>
                ) : (
                  <p className="text-caption text-fg-subtle">
                    {needed === null
                      ? `About ${formatBytes(entry.bytes)} to download.`
                      : needed === 0
                        ? 'Everything it needs is already on this machine.'
                        : `${formatBytes(needed)} to download, once; after that it works offline.`}
                  </p>
                )}
              </form>
              <section aria-labelledby="credits-h">
                <h3 id="credits-h" className="label-caps mb-2 text-fg-subtle">
                  Pictures, music and type
                </h3>
                <ul className="flex flex-col gap-2">
                  {credits.map((e) => (
                    <li key={e.name} className="text-caption text-fg-muted">
                      <a
                        href={e.credit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-fg underline-offset-2 hover:underline"
                      >
                        {e.credit.title}
                      </a>
                      , {e.credit.creator}
                      {e.credit.year ? ` (${e.credit.year})` : ''}. {e.credit.source},{' '}
                      {licenceName(e.credit.licence)}.
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="label-caps mb-1 text-fg-subtle">{title}</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-ui">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function licenceName(l: string): string {
  return l === 'PD' ? 'public domain' : l === 'CC0-1.0' ? 'CC0' : 'SIL Open Font License';
}
