import { cueOrder, type Show } from '@scrim/format';
import {
  BookmarkPlus,
  CircleCheck,
  Circle,
  Copy,
  Download,
  FolderOpen,
  HardDrive,
  History,
  Play,
  RotateCcw,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatBytes, timeAgo } from '../lib/clock.js';
import { openShortcutSheet, useCommands } from '../lib/commands.js';
import { createDemoShow } from '../lib/demo.js';
import {
  demoRecord,
  forgetTemplate,
  learnSteps,
  rememberDemo,
  setDemoRecord,
  templateRecord,
  templateSteps,
  type DemoRecord,
  type LearnStep,
  type TemplateRecord,
} from '../lib/learn.js';
import { readLocal, writeLocal } from '../lib/local.js';
import { blankShow, STARTERS } from '../lib/starters.js';
import { db, type JournalRecord, type RunRecord } from '../storage/db.js';
import { opfsSupported } from '../storage/media.js';
import { requestPersistence, storageInfo, type StorageInfo } from '../storage/quota.js';
import {
  deleteShow,
  duplicateShow,
  exportShow,
  getShow,
  importShow,
  listRuns,
  listShows,
  saveShow,
} from '../storage/shows.js';
import { deleteTemplate, fromTemplate, listTemplates, saveTemplate } from '../storage/templates.js';
import { SpikeMark } from '../ui/BrandMark.js';
import { Button, IconButton } from '../ui/Button.js';
import { CommandPalette } from '../ui/CommandPalette.js';
import { ask, confirmDialog, promptDialog } from '../ui/dialog.js';
import { KeyHints } from '../ui/KeyHints.js';
import { Badge, Empty } from '../ui/Panel.js';
import { openPreferences, PreferencesHost } from '../ui/PreferencesHost.js';
import { ShortcutSheet } from '../ui/ShortcutSheet.js';
import { errorToast, toast } from '../ui/toast.js';
import { FirstRun, WELCOMED_KEY } from './library/FirstRun.js';
import { StartGallery } from './library/StartGallery.js';
import { templateById } from '../templates/index.js';
import type { TemplateSeed } from '../templates/types.js';

/** A run newer than this is offered on the Library's front page. */
const RESUME_WITHIN_MS = 12 * 60 * 60 * 1000;

export function Library() {
  const navigate = useNavigate();
  const [shows, setShows] = useState<Show[] | null>(null);
  const [templates, setTemplates] = useState<Show[]>([]);
  const [journal, setJournal] = useState<JournalRecord | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [welcomed, setWelcomed] = useState(() => readLocal(WELCOMED_KEY, false));
  const [resumeHidden, setResumeHidden] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [all, tpl, journals] = await Promise.all([
      listShows(),
      listTemplates(),
      db().then((d) => d.getAll('journal')),
    ]);
    setShows(all);
    setTemplates(tpl);
    setJournal(
      journals
        .filter(
          (j) =>
            j.state.lastFired !== null &&
            Date.now() - j.savedAt < RESUME_WITHIN_MS &&
            all.some((s) => s.id === j.showId),
        )
        .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null,
    );
    setStorage(await storageInfo());
  }, []);

  useEffect(() => {
    document.title = 'Scrim';
    void refresh();
  }, [refresh]);

  const open = async (show: Show) => {
    await saveShow(show);
    navigate(`/show/${show.id}`);
  };

  const create = async () => {
    const name = await promptDialog('New show', 'Untitled show', 'Show name');
    if (name) await open(blankShow(name));
  };

  const demo = async () => {
    const existing = demoRecord();
    if (existing && (await getShow(existing.id))) return navigate(`/show/${existing.id}`);
    // A demo made before the Library kept track of it: adopt it rather than make another.
    const older = shows?.find((s) => s.name === 'The Two Doors (demo)');
    if (older) {
      rememberDemo(older);
      return navigate(`/show/${older.id}`);
    }
    setBusy('Building the demo show…');
    try {
      const show = await createDemoShow();
      rememberDemo(show);
      await open(show);
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(null);
    }
  };

  const starter = (id: string) => {
    const s = STARTERS.find((x) => x.id === id);
    if (s) void open(s.make());
  };

  const template = async (t: Show) => {
    const name = await promptDialog('New show from template', t.name, 'Show name');
    if (name) await open(fromTemplate(t, name));
  };

  const onImport = async (file: File) => {
    setBusy(`Importing ${file.name}…`);
    try {
      const show = await importShow(file, (existing) =>
        ask<'replace' | 'copy'>(
          'This show is already here',
          <>
            “{existing.name}” already exists on this machine. Replace it with the imported version,
            or keep both?
          </>,
          [
            { label: 'Keep both', value: 'copy' },
            { label: 'Replace', value: 'replace', variant: 'danger' },
          ],
        ),
      );
      if (show) {
        toast(`Imported “${show.name}”`, 'good');
        await refresh();
      }
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(null);
    }
  };

  useCommands(
    [
      {
        id: 'new',
        group: 'Shows',
        title: 'New show',
        aliases: ['create', 'blank'],
        run: () => void create(),
      },
      {
        id: 'demo',
        group: 'Shows',
        title: 'Open the demo show',
        aliases: ['example', 'learn'],
        run: () => void demo(),
      },
      ...STARTERS.map((s) => ({
        id: `starter:${s.id}`,
        group: 'Shows',
        title: `New show: ${s.title}`,
        aliases: ['starter', 'template'],
        run: () => starter(s.id),
      })),
      {
        id: 'import',
        group: 'Shows',
        title: 'Import a .scrim file…',
        aliases: ['open', 'load'],
        run: () => fileInput.current?.click(),
      },
      ...(shows ?? []).map((sh) => ({
        id: `open:${sh.id}`,
        group: 'Open',
        title: sh.name,
        aliases: ['edit', 'show'],
        run: () => navigate(`/show/${sh.id}`),
      })),
      {
        id: 'welcome',
        group: 'Help',
        title: 'Show the welcome questions again',
        aliases: ['first run', 'onboarding'],
        run: () => {
          writeLocal(WELCOMED_KEY, false);
          setWelcomed(false);
        },
      },
      {
        id: 'shortcuts',
        group: 'Help',
        title: 'Keyboard shortcuts',
        shortcut: '?',
        run: openShortcutSheet,
      },
      {
        id: 'prefs',
        group: 'Help',
        title: 'Preferences',
        aliases: ['settings', 'theme', 'accent'],
        shortcut: '⌘,',
        run: openPreferences,
      },
    ],
    [shows],
  );

  const persist = async () => {
    const ok = await requestPersistence();
    toast(
      ok
        ? 'Storage is now persistent'
        : 'The browser declined; install the app or bookmark it and try again',
      ok ? 'good' : 'error',
    );
    setStorage(await storageInfo());
  };

  const resumeShow = journal && shows?.find((s) => s.id === journal.showId);
  const demoInfo = demoRecord();

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-display font-semibold tracking-tight">
            <SpikeMark className="size-9 text-accent" />
            Scrim
          </h1>
          <p className="text-ui text-fg-muted">
            Show control in your browser. Build a show, press GO.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton
            label="Preferences"
            shortcut="⌘,"
            icon={<Settings size={16} />}
            className="h-control w-control"
            onClick={openPreferences}
          />
          <Button icon={<FolderOpen size={16} />} onClick={() => fileInput.current?.click()}>
            Import .scrim
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".scrim,application/zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onImport(f);
            }}
          />
        </div>
      </header>

      {!opfsSupported() && (
        <div className="rounded-control border border-line-control bg-panel p-4 text-ui text-warn">
          This browser can't store media for offline shows. Use a current Chrome or Edge on the show
          machine.
        </div>
      )}

      {busy && (
        <div
          role="status"
          className="rounded-control border border-line-subtle bg-control p-3 text-ui text-fg-muted"
        >
          {busy}
        </div>
      )}

      {shows?.length === 0 && !welcomed && <FirstRun onDone={() => setWelcomed(true)} />}

      {resumeShow && journal && !resumeHidden && (
        <ResumeCard show={resumeShow} journal={journal} onHide={() => setResumeHidden(true)} />
      )}

      <StartGallery
        templates={templates}
        onBlank={() => void create()}
        onDemo={() => void demo()}
        onStarter={starter}
        onTemplate={(t) => void template(t)}
        onDeleteTemplate={async (t) => {
          await deleteTemplate(t.id);
          await refresh();
          toast(`Deleted the template “${t.name}”`, 'info', {
            label: 'Undo',
            run: () => void saveTemplate(t, t.name).then(refresh),
          });
        }}
      />

      <section aria-labelledby="shows-heading" className="flex flex-col gap-3">
        <h2 id="shows-heading" className="font-display text-heading font-semibold">
          Your shows
        </h2>
        {shows === null ? null : shows.length === 0 ? (
          <div className="rounded-control border border-dashed border-line-subtle">
            <Empty
              brand
              title="No shows on this machine yet"
              action={
                <Button variant="primary" onClick={() => void demo()}>
                  Open the demo
                </Button>
              }
            >
              Start from a card above, import a .scrim file, or open the demo to see a whole show
              with an audience vote. Shows stay on this machine.
            </Empty>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shows.map((show) => (
              <ShowCard
                key={show.id}
                show={show}
                demo={show.id === demoInfo?.id ? demoInfo : null}
                onChanged={refresh}
                onBusy={setBusy}
              />
            ))}
          </ul>
        )}
      </section>

      {storage && (
        <footer className="mt-auto flex flex-wrap items-center gap-3 text-caption text-fg-subtle">
          <HardDrive size={14} />
          <span>
            {formatBytes(storage.usage)} used of {formatBytes(storage.quota)} available
          </span>
          {storage.persisted ? (
            <Badge tone="good">Persistent storage</Badge>
          ) : (
            <>
              <Badge tone="warn">Storage may be cleared by the browser</Badge>
              <Button size="sm" onClick={persist}>
                Keep my shows
              </Button>
            </>
          )}
        </footer>
      )}
      <CommandPalette />
      <ShortcutSheet />
      <KeyHints />
      <PreferencesHost />
    </div>
  );
}

/** "Pick up where you left off": the most recent run in the last few hours. */
function ResumeCard({
  show,
  journal,
  onHide,
}: {
  show: Show;
  journal: JournalRecord;
  onHide: () => void;
}) {
  const cue = cueOrder(show).find((c) => c.id === journal.state.lastFired);
  return (
    <section
      aria-label="Resume last run"
      className="flex flex-wrap items-center gap-3 rounded-control border border-line-strong bg-panel p-4"
    >
      <History size={18} className="text-fg-icon" aria-hidden />
      <p className="min-w-0 flex-1 text-ui">
        <span className="font-medium text-fg">Pick up where you left off:</span>{' '}
        <span className="text-fg-muted">
          “{show.name}”, last cue “{cue?.name ?? '?'}”, {timeAgo(journal.savedAt)}.
        </span>
      </p>
      <Button
        variant="go"
        icon={<Play size={14} />}
        onClick={() => window.open(`/show/${show.id}/run`, `scrim-run-${show.id}`)}
      >
        Resume run
      </Button>
      <IconButton label="Hide" icon={<X size={14} />} onClick={onHide} />
    </section>
  );
}

function ShowCard({
  show,
  demo,
  onChanged,
  onBusy,
}: {
  show: Show;
  demo: DemoRecord | null;
  onChanged: () => void;
  onBusy: (s: string | null) => void;
}) {
  const size = show.media.reduce((n, m) => n + m.size, 0);
  const run = () => window.open(`/show/${show.id}/run`, `scrim-run-${show.id}`);
  const record = demo ? null : templateRecord(show.id);
  const seed = record && templateById(record.template);
  const made = record && seed ? { record, seed } : null;
  return (
    <li className="group flex flex-col rounded-control border border-line-subtle bg-panel p-4 hover:border-line-control">
      <Link
        to={`/show/${show.id}`}
        className="flex-1 outline-none focus-visible:outline-2 focus-visible:outline-focus"
      >
        <h3 className="flex items-center gap-2 text-body font-semibold">
          <span className="truncate">{show.name}</span>
          {demo && <Badge>Demo</Badge>}
        </h3>
        <p className="mt-1 text-caption text-fg-subtle">
          {show.cues.length} cues · {show.scenes.length} scenes · {show.outputs.length} output
          {show.outputs.length === 1 ? '' : 's'} · {formatBytes(size)} media
        </p>
        <p className="mt-0.5 text-caption text-fg-subtle">Edited {timeAgo(show.updatedAt)}</p>
      </Link>
      {demo ? (
        <DemoLearn show={show} demo={demo} onChanged={onChanged} />
      ) : (
        made && <TemplateLearn show={show} seed={made.seed} record={made.record} />
      )}
      <div className="mt-4 flex items-center gap-1">
        <Button size="sm" variant="go" icon={<Play size={14} />} onClick={run}>
          Run
        </Button>
        <Link to={`/show/${show.id}`}>
          <Button size="sm">Edit</Button>
        </Link>
        <div className="ml-auto flex gap-0.5 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton
            label="Save as template"
            icon={<BookmarkPlus size={14} />}
            onClick={async () => {
              const name = await promptDialog('Save as template', show.name, 'Template name');
              if (!name) return;
              await saveTemplate(show, name);
              toast(`“${name}” is in the start gallery`, 'good');
              onChanged();
            }}
          />
          <IconButton
            label="Export .scrim"
            icon={<Download size={14} />}
            onClick={async () => {
              onBusy(`Exporting ${show.name}…`);
              try {
                await exportShow(show);
              } catch (e) {
                errorToast(e);
              } finally {
                onBusy(null);
              }
            }}
          />
          <IconButton
            label="Duplicate"
            icon={<Copy size={14} />}
            onClick={async () => {
              await saveShow(duplicateShow(show, `${show.name} copy`));
              onChanged();
            }}
          />
          <IconButton
            label="Delete"
            icon={<Trash2 size={14} />}
            onClick={async () => {
              if (
                await confirmDialog(
                  'Delete show?',
                  <>
                    “{show.name}”, its history and any media no other show uses will be removed from
                    this machine.
                  </>,
                  'Delete',
                  true,
                )
              ) {
                await deleteShow(show.id);
                forgetTemplate(show.id);
                onChanged();
              }
            }}
          />
        </div>
      </div>
    </li>
  );
}

/** The demo's Learn checklist: it ticks itself as the person does each thing. */
function DemoLearn({
  show,
  demo,
  onChanged,
}: {
  show: Show;
  demo: DemoRecord;
  onChanged: () => void;
}) {
  const runs = useRuns(show);
  const steps = learnSteps(show, runs, demo);

  // The demo is disposable: put it back to new, with Undo.
  const restore = async () => {
    const before = structuredClone(show);
    const fresh = await createDemoShow();
    fresh.id = show.id;
    await saveShow(fresh);
    rememberDemo(fresh);
    onChanged();
    toast('The demo is back to new', 'info', {
      label: 'Undo',
      run: () => {
        setDemoRecord(demo);
        void saveShow(before).then(onChanged);
      },
    });
  };

  return (
    <Checklist steps={steps}>
      <li className="mt-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw size={13} />}
          onClick={() => void restore()}
        >
          Restore the demo
        </Button>
      </li>
    </Checklist>
  );
}

/** A show made from a template: its own checklist for making the template theirs. */
function TemplateLearn({
  show,
  seed,
  record,
}: {
  show: Show;
  seed: TemplateSeed;
  record: TemplateRecord;
}) {
  const runs = useRuns(show);
  return <Checklist steps={templateSteps(seed.learn, { show, runs, baseline: record.baseline })} />;
}

function useRuns(show: Show): RunRecord[] {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  useEffect(() => void listRuns(show.id).then(setRuns), [show.id, show.updatedAt]);
  return runs;
}

function Checklist({ steps, children }: { steps: LearnStep[]; children?: ReactNode }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <details className="mt-3 rounded-control border border-line-subtle">
      <summary className="flex cursor-default list-none items-center gap-2 px-3 py-2 text-caption [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-fg">Learn</span>
        <span className="text-fg-subtle tabular-nums">
          {done} of {steps.length}
        </span>
        <span
          className="ml-auto h-1 w-24 overflow-hidden rounded-control bg-control-hover"
          aria-hidden
        >
          <span
            className="block h-full origin-left bg-accent"
            style={{ transform: `scaleX(${done / steps.length})` }}
          />
        </span>
      </summary>
      <ul className="flex flex-col gap-1 px-3 pb-3">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-caption">
            {s.done ? (
              <CircleCheck size={14} className="mt-px shrink-0 text-go" aria-label="Done" />
            ) : (
              <Circle size={14} className="mt-px shrink-0 text-fg-icon" aria-label="To do" />
            )}
            <span>
              <span className={s.done ? 'text-fg-muted' : 'text-fg'}>{s.title}</span>
              {!s.done && <span className="block text-fg-subtle">{s.hint}</span>}
            </span>
          </li>
        ))}
        {children}
      </ul>
    </details>
  );
}
