import { createShow, type Show } from '@scrim/format';
import { Copy, Download, FolderOpen, HardDrive, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { createDemoShow } from '../lib/demo.js';
import { formatBytes, timeAgo } from '../lib/clock.js';
import { opfsSupported } from '../storage/media.js';
import { requestPersistence, storageInfo, type StorageInfo } from '../storage/quota.js';
import {
  deleteShow,
  duplicateShow,
  exportShow,
  importShow,
  listShows,
  saveShow,
} from '../storage/shows.js';
import { Button, IconButton } from '../ui/Button.js';
import { ask, confirmDialog, promptDialog } from '../ui/dialog.js';
import { Badge } from '../ui/Panel.js';
import { errorToast, toast } from '../ui/toast.js';

export function Library() {
  const navigate = useNavigate();
  const [shows, setShows] = useState<Show[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setShows(await listShows());
    setStorage(await storageInfo());
  }, []);

  useEffect(() => {
    document.title = 'Scrim';
    void refresh();
  }, [refresh]);

  const create = async () => {
    const name = await promptDialog('New show', 'Untitled show', 'Show name');
    if (!name) return;
    const show = createShow(name);
    await saveShow(show);
    navigate(`/show/${show.id}`);
  };

  const demo = async () => {
    setBusy('Building the demo show…');
    try {
      const show = await createDemoShow();
      await saveShow(show);
      navigate(`/show/${show.id}`);
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(null);
    }
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

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scrim</h1>
            <p className="text-sm text-ink-300">
              Show control in your browser. Build a show, press GO.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FolderOpen size={16} />} onClick={() => fileInput.current?.click()}>
            Import .scrim
          </Button>
          <Button icon={<Sparkles size={16} />} onClick={demo}>
            Demo show
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={create}>
            New show
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
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          This browser can't store media for offline shows. Use a current Chrome or Edge on the show
          machine.
        </div>
      )}

      {busy && (
        <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm text-ink-200">
          {busy}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shows === null ? null : shows.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-ink-700 p-10 text-center">
            <p className="text-ink-200">No shows on this machine yet.</p>
            <p className="mt-1 text-sm text-ink-400">
              Start a new one, import a .scrim file, or open the demo to see an interactive show.
            </p>
          </div>
        ) : (
          shows.map((show) => (
            <ShowCard key={show.id} show={show} onChanged={refresh} onBusy={setBusy} />
          ))
        )}
      </section>

      {storage && (
        <footer className="mt-auto flex flex-wrap items-center gap-3 text-xs text-ink-400">
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
    </div>
  );
}

function ShowCard({
  show,
  onChanged,
  onBusy,
}: {
  show: Show;
  onChanged: () => void;
  onBusy: (s: string | null) => void;
}) {
  const size = show.media.reduce((n, m) => n + m.size, 0);
  const run = () => window.open(`/show/${show.id}/run`, `scrim-run-${show.id}`);
  return (
    <article className="group flex flex-col rounded-xl border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-ink-600">
      <Link to={`/show/${show.id}`} className="flex-1">
        <h2 className="truncate text-base font-semibold">{show.name}</h2>
        <p className="mt-1 text-xs text-ink-400">
          {show.cues.length} cues · {show.scenes.length} scenes · {show.outputs.length} output
          {show.outputs.length === 1 ? '' : 's'} · {formatBytes(size)} media
        </p>
        <p className="mt-0.5 text-xs text-ink-500">Edited {timeAgo(show.updatedAt)}</p>
      </Link>
      <div className="mt-4 flex items-center gap-1">
        <Button size="sm" variant="go" icon={<Play size={14} />} onClick={run}>
          Run
        </Button>
        <Link to={`/show/${show.id}`}>
          <Button size="sm">Edit</Button>
        </Link>
        <div className="ml-auto flex gap-0.5 opacity-60 group-hover:opacity-100">
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
                onChanged();
              }
            }}
          />
        </div>
      </div>
    </article>
  );
}
