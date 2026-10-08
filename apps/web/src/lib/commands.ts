import { useEffect, useSyncExternalStore } from 'react';

/**
 * One command registry (UX_PRINCIPLES.md › Commands, shortcuts and the palette). Surfaces
 * register the commands they offer while mounted; the palette and the `?` sheet read them, so
 * titles and shortcuts never disagree with the buttons they stand for.
 */
export interface Command {
  id: string;
  title: string;
  /** Heading in the palette and the sheet: "Show", "Edit", "View", "Go to"… */
  group: string;
  /** Other words people search for. */
  aliases?: string[];
  /** The key as shown to people: "⌘Z", "Space", "⇧\". */
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

let sets = new Map<symbol, Command[]>();
let snapshot: Command[] = [];
const listeners = new Set<() => void>();

function publish() {
  snapshot = [...sets.values()].flat();
  for (const l of listeners) l();
}

/** Offer `commands` while the calling component is mounted. Pass `deps` like useEffect. */
export function useCommands(commands: Command[], deps: unknown[]): void {
  useEffect(() => {
    const token = Symbol('commands');
    sets = new Map(sets).set(token, commands);
    publish();
    return () => {
      sets = new Map(sets);
      sets.delete(token);
      publish();
    };
    // The caller lists what its commands depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useCommandList(): Command[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => snapshot,
  );
}

/** Commands grouped by heading, in registration order. */
export function grouped(commands: Command[]): [string, Command[]][] {
  const out = new Map<string, Command[]>();
  for (const c of commands) out.set(c.group, [...(out.get(c.group) ?? []), c]);
  return [...out];
}

const OPEN_PALETTE = 'scrim:open-palette';
const OPEN_SHEET = 'scrim:open-sheet';

export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE));
export const openShortcutSheet = () => window.dispatchEvent(new Event(OPEN_SHEET));

/** Open state for an overlay that opens on an event (and closes itself). */
export function onOpenEvent(name: 'palette' | 'sheet', open: () => void): () => void {
  const type = name === 'palette' ? OPEN_PALETTE : OPEN_SHEET;
  window.addEventListener(type, open);
  return () => window.removeEventListener(type, open);
}
