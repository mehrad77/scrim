import type { Show } from '@scrim/format';
import { produce } from 'immer';
import { create } from 'zustand';
import { saveShow } from '../storage/shows.js';
import { ShowChannel } from '../transport/local.js';
import { errorToast } from '../ui/toast.js';

const HISTORY = 100;
const SAVE_DEBOUNCE_MS = 400;

export interface Selection {
  outputId: string | null;
  layerId: string | null;
  cueId: string | null;
}

interface EditorState {
  show: Show | null;
  past: Show[];
  future: Show[];
  saving: 'idle' | 'pending' | 'saved' | 'error';
  savedAt: number | null;
  selection: Selection;
  /** Set by a running host in Show mode; editing is locked unless overridden. */
  showModeLock: boolean;
  unlocked: boolean;
  load(show: Show): void;
  update(recipe: (draft: Show) => void, opts?: { coalesce?: string }): void;
  undo(): void;
  redo(): void;
  select(sel: Partial<Selection>): void;
  replace(show: Show): void;
  unlock(): void;
}

let channel: ShowChannel | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastCoalesce: { key: string; at: number } | null = null;

export const useEditor = create<EditorState>((set, get) => ({
  show: null,
  past: [],
  future: [],
  saving: 'idle',
  savedAt: null,
  selection: { outputId: null, layerId: null, cueId: null },
  showModeLock: false,
  unlocked: false,

  load(show) {
    channel?.close();
    channel = new ShowChannel(show.id);
    channel.post({ t: 'hello', clientId: 'editor', role: 'editor', outputId: null });
    channel.on((m) => {
      if (m.t === 'state') set({ showModeLock: m.mode === 'show' });
      if (m.t === 'closing') set({ showModeLock: false });
    });
    set({
      show,
      past: [],
      future: [],
      saving: 'saved',
      savedAt: show.updatedAt,
      selection: { outputId: show.outputs[0]?.id ?? null, layerId: null, cueId: null },
      showModeLock: false,
      unlocked: false,
    });
  },

  update(recipe, opts) {
    const { show, past, showModeLock, unlocked } = get();
    if (!show) return;
    if (showModeLock && !unlocked) return;
    const now = Date.now();
    let next = produce(show, recipe);
    if (next === show) return;
    // Stamp cues whose content changed, for "changed since last run".
    const prevCues = new Map(show.cues.map((c) => [c.id, c]));
    next = produce(next, (d) => {
      d.updatedAt = now;
      for (const c of d.cues) {
        const before = prevCues.get(c.id);
        if (!before || before !== next.cues.find((x) => x.id === c.id)) c.updatedAt = now;
      }
    });
    // Rapid edits of the same field (dragging, typing) form one undo step.
    const coalesce =
      opts?.coalesce && lastCoalesce?.key === opts.coalesce && now - lastCoalesce.at < 1000;
    lastCoalesce = opts?.coalesce ? { key: opts.coalesce, at: now } : null;
    set({
      show: next,
      past: coalesce ? past : [...past, show].slice(-HISTORY),
      future: [],
      saving: 'pending',
    });
    scheduleSave();
  },

  undo() {
    const { show, past, future } = get();
    const prev = past.at(-1);
    if (!show || !prev) return;
    set({
      show: { ...prev, updatedAt: Date.now() },
      past: past.slice(0, -1),
      future: [show, ...future],
      saving: 'pending',
    });
    scheduleSave();
  },

  redo() {
    const { show, past, future } = get();
    const next = future[0];
    if (!show || !next) return;
    set({
      show: { ...next, updatedAt: Date.now() },
      past: [...past, show],
      future: future.slice(1),
      saving: 'pending',
    });
    scheduleSave();
  },

  select(sel) {
    set({ selection: { ...get().selection, ...sel } });
  },

  replace(show) {
    const { show: current, past } = get();
    set({ show, past: current ? [...past, current] : past, future: [], saving: 'pending' });
    scheduleSave();
  },

  unlock() {
    set({ unlocked: true });
  },
}));

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
}

export async function flushSave(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const { show, saving } = useEditor.getState();
  if (!show || saving !== 'pending') return;
  try {
    await saveShow(show);
    // A running operator view picks up the edit live.
    channel?.post({ t: 'showSaved', show });
    if (useEditor.getState().show === show)
      useEditor.setState({ saving: 'saved', savedAt: Date.now() });
  } catch (e) {
    useEditor.setState({ saving: 'error' });
    errorToast(e);
  }
}

/** Forward GO/panic keys pressed in the editor to a running operator view. */
export function forwardKey(key: string): void {
  channel?.post({ t: 'key', key });
}

export function useShow(): Show {
  const show = useEditor((s) => s.show);
  if (!show) throw new Error('No show loaded');
  return show;
}
