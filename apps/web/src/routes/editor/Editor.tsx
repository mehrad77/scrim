import { Download, History, Lock, PanelsTopLeft, Play, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { isTyping, overlayOpen } from '../../host/inputs.js';
import { flushSave, forwardKey, useEditor } from '../../state/editor.js';
import { exportShow, getShow } from '../../storage/shows.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput } from '../../ui/Field.js';
import { Tabs } from '../../ui/Tabs.js';
import { checkLogic } from '../../lib/logic.js';
import { errorToast, toast } from '../../ui/toast.js';
import { CuesTab } from './CuesTab.js';
import { HistoryTab } from './HistoryTab.js';
import { InputsTab } from './InputsTab.js';
import { InteractionTab } from './InteractionTab.js';
import { OutputsTab } from './OutputsTab.js';
import { StageTab } from './StageTab.js';
import { readPrefs } from '../../lib/prefs.js';
import { resetLayouts, toggleFocusCanvas } from '../../ui/Layout.js';
import { MenuButton } from '../../ui/Menu.js';
import { MotionRoot } from '../../ui/MotionRoot.js';
import { InfoStrip } from '../../ui/Tooltip.js';

type Tab = 'stage' | 'cues' | 'interaction' | 'inputs' | 'outputs' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'stage', label: 'Stage' },
  { id: 'cues', label: 'Cues' },
  { id: 'interaction', label: 'Interaction' },
  { id: 'inputs', label: 'Controls' },
  { id: 'outputs', label: 'Outputs & audio' },
  { id: 'history', label: 'History' },
];

export default function Editor() {
  const { id } = useParams();
  const show = useEditor((s) => s.show);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>(
    () => (sessionStorage.getItem('scrim.editorTab') as Tab) || 'stage',
  );

  useEffect(() => {
    if (!id) return;
    void getShow(id).then((s) => (s ? useEditor.getState().load(s) : setMissing(true)));
    return () => void flushSave();
  }, [id]);

  useEffect(() => {
    sessionStorage.setItem('scrim.editorTab', tab);
  }, [tab]);

  useEffect(() => {
    if (show) document.title = `${show.name} · Scrim`;
  }, [show]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
        e.preventDefault();
        if (e.shiftKey) useEditor.getState().redo();
        else useEditor.getState().undo();
        return;
      }
      if (e.key === '|' && e.shiftKey && !mod && !isTyping(e.target)) {
        e.preventDefault();
        toggleFocusCanvas();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flushSave();
        return;
      }
      // Panic works from the editor too, but Esc first closes an open dialog or menu and
      // cancels a field edit; only a bare Esc reaches the running show.
      if (e.key === 'Escape' && !isTyping(e.target) && !overlayOpen()) forwardKey(e.key);
    };
    const onUnload = () => void flushSave();
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  if (missing) {
    return (
      <div className="p-8">
        <p>This show isn't on this machine.</p>
        <Link to="/" className="text-accent-text underline">
          Back to shows
        </Link>
      </div>
    );
  }
  if (!show || show.id !== id)
    return <div className="p-6 text-ui text-fg-subtle">Loading show…</div>;

  return (
    <MotionRoot>
      <div className="flex h-full flex-col" data-density={readPrefs().editorDensity}>
        <EditorHeader tab={tab} setTab={setTab} />
        <LockBanner />
        <main className="min-h-0 flex-1 border-t border-line-subtle">
          {tab === 'stage' && <StageTab />}
          {tab === 'cues' && <CuesTab />}
          {tab === 'interaction' && <InteractionTab />}
          {tab === 'inputs' && <InputsTab />}
          {tab === 'outputs' && <OutputsTab />}
          {tab === 'history' && <HistoryTab />}
        </main>
        <InfoStrip />
      </div>
    </MotionRoot>
  );
}

function EditorHeader({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const show = useEditor((s) => s.show)!;
  const update = useEditor((s) => s.update);
  const saving = useEditor((s) => s.saving);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  // The logic check, counted on the tab where each problem is fixed.
  const problems = useMemo(() => {
    const count: Partial<Record<Tab, number>> = {};
    for (const i of checkLogic(show)) count[i.area] = (count[i.area] ?? 0) + 1;
    return count;
  }, [show]);
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-panel px-3 py-2">
      <Link to="/" data-info="All shows" aria-label="All shows" className="shrink-0">
        <img src="/favicon.svg" alt="Scrim" className="size-7" />
      </Link>
      <CommitInput
        aria-label="Show name"
        value={show.name}
        onCommit={(name) => name.trim() && update((d) => void (d.name = name.trim()))}
        className="w-56 border-transparent bg-transparent text-base font-semibold hover:border-line-subtle"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ ...t, badge: problems[t.id] }))}
        className="overflow-x-auto"
      />
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-2 text-caption text-fg-subtle" aria-live="polite">
          {saving === 'pending' ? 'Saving…' : saving === 'error' ? 'Not saved!' : 'Saved'}
        </span>
        <MenuButton
          label="View"
          icon={<PanelsTopLeft size={15} />}
          items={[
            {
              id: 'focus',
              label: 'Focus canvas',
              shortcut: '⇧\\',
              disabled: tab !== 'stage',
              onAction: toggleFocusCanvas,
            },
            {
              id: 'reset',
              label: 'Reset layout',
              onAction: () =>
                toast('Panel layout reset', 'info', { label: 'Undo', run: resetLayouts() }),
            },
          ]}
        />
        <IconButton
          label="Undo"
          shortcut="⌘Z"
          icon={<Undo2 size={15} />}
          disabled={!canUndo}
          onClick={() => useEditor.getState().undo()}
        />
        <IconButton
          label="Redo"
          shortcut="⇧⌘Z"
          icon={<Redo2 size={15} />}
          disabled={!canRedo}
          onClick={() => useEditor.getState().redo()}
        />
        <IconButton
          label="Versions"
          icon={<History size={15} />}
          onClick={() => setTab('history')}
        />
        <Button
          size="sm"
          icon={<Download size={14} />}
          onClick={async () => {
            await flushSave();
            try {
              await exportShow(useEditor.getState().show!);
            } catch (e) {
              errorToast(e);
            }
          }}
        >
          Export
        </Button>
        <Button
          size="sm"
          variant="accent"
          icon={<Play size={14} />}
          onClick={async () => {
            await flushSave();
            window.open(`/show/${show.id}/run`, `scrim-run-${show.id}`);
          }}
        >
          Run show
        </Button>
      </div>
    </header>
  );
}

function LockBanner() {
  const locked = useEditor((s) => s.showModeLock && !s.unlocked);
  if (!locked) return null;
  return (
    <div className="flex items-center gap-3 border-b border-line-strong bg-control px-4 py-2 text-ui text-fg">
      <Lock size={16} />
      <span>
        This show is running in Show mode. Editing is locked so nothing changes mid-performance.
      </span>
      <Button
        size="sm"
        variant="danger"
        className="ml-auto"
        onClick={() => useEditor.getState().unlock()}
      >
        Unlock and edit live
      </Button>
    </div>
  );
}
