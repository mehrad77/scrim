import { ChevronDown, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { timeAgo } from '../../lib/clock.js';
import { cn } from '../../lib/cn.js';
import { flushSave, useEditor, useShow } from '../../state/editor.js';
import type { RunRecord, VersionRecord } from '../../storage/db.js';
import { addVersion, listRuns, listVersions, restoreVersion } from '../../storage/shows.js';
import { Button } from '../../ui/Button.js';
import { confirmDialog, promptDialog } from '../../ui/dialog.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';

export function HistoryTab() {
  const show = useShow();
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const refresh = useCallback(async () => {
    setVersions(await listVersions(show.id));
    setRuns(await listRuns(show.id));
  }, [show.id]);
  useEffect(() => void refresh(), [refresh]);

  return (
    <div className="grid h-full grid-cols-2 gap-px bg-line-subtle">
      <Panel
        title="Versions"
        bodyClassName="p-2"
        actions={
          <Button
            size="sm"
            icon={<Save size={13} />}
            onClick={async () => {
              const label = await promptDialog('Save a version', 'Before tech rehearsal', 'Label');
              if (!label) return;
              await flushSave();
              await addVersion(useEditor.getState().show!, label);
              void refresh();
            }}
          >
            Save version
          </Button>
        }
      >
        <p className="mb-2 text-caption text-fg-subtle">
          Scrim keeps a version every few minutes while you edit, and before every restore.
        </p>
        {versions.length === 0 && (
          <Empty title="No versions yet">
            A version is saved every few minutes while you edit, so you can always go back.
          </Empty>
        )}
        {versions.map((v) => (
          <div key={v.id} className="flex items-center gap-2 border-b border-line-subtle px-1 py-2">
            <div className="flex-1">
              <div className="text-ui">{v.label}</div>
              <div className="text-caption text-fg-subtle">
                {new Date(v.savedAt).toLocaleString()} · {v.show.cues.length} cues ·{' '}
                {v.show.layers.length} layers
              </div>
            </div>
            <Button
              size="sm"
              icon={<RotateCcw size={13} />}
              onClick={async () => {
                if (
                  !(await confirmDialog(
                    'Restore this version?',
                    'The current show is saved as a version first, so you can come back.',
                  ))
                )
                  return;
                await flushSave();
                const restored = await restoreVersion(v, useEditor.getState().show!);
                useEditor.getState().replace(restored);
                toast('Version restored', 'good');
                void refresh();
              }}
            >
              Restore
            </Button>
          </div>
        ))}
      </Panel>
      <Panel title="Run logs" bodyClassName="p-2">
        <p className="mb-2 text-caption text-fg-subtle">
          Every rehearsal and performance is logged: cues fired, audience results and warnings.
        </p>
        {runs.length === 0 && (
          <Empty title="No runs yet">Press Run show, then GO. Every run is logged here.</Empty>
        )}
        {runs.map((r) => (
          <RunItem key={r.id} run={r} />
        ))}
      </Panel>
    </div>
  );
}

function RunItem({ run }: { run: RunRecord }) {
  const [open, setOpen] = useState(false);
  const warnings = run.entries.filter((e) => e.kind === 'warning').length;
  const minutes = Math.round((run.endedAt - run.startedAt) / 60000);
  return (
    <div className="border-b border-line-subtle">
      <button
        className="flex w-full items-center gap-2 px-1 py-2 text-left"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown size={14} className={cn('transition-transform', !open && '-rotate-90')} />
        <div className="flex-1">
          <div className="text-ui">{new Date(run.startedAt).toLocaleString()}</div>
          <div className="text-caption text-fg-subtle">
            {minutes} min · {run.cuesFired} cues{warnings ? ` · ${warnings} warnings` : ''} ·{' '}
            {timeAgo(run.startedAt)}
          </div>
        </div>
      </button>
      {open && (
        <ol className="mb-2 max-h-80 overflow-auto px-6 font-mono text-caption">
          {run.entries.map((e, i) => (
            <li
              key={i}
              className={cn(
                'py-0.5',
                e.kind === 'warning' && 'text-warn',
                e.kind === 'panic' && 'text-fault',
                e.kind === 'cue' && 'text-fg',
                e.kind === 'info' && 'text-fg-subtle',
              )}
            >
              {new Date(e.at).toLocaleTimeString()} {e.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
