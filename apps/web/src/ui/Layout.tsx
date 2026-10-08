import { useSyncExternalStore, type ReactNode, type Ref } from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type PanelImperativeHandle,
} from 'react-resizable-panels';

const PREFIX = 'scrim.layout.';

/** Focus canvas: hide the panes on both sides of the Stage canvas (Shift+\\). */
export const FOCUS_CANVAS_EVENT = 'scrim:focus-canvas';
export function toggleFocusCanvas(): void {
  window.dispatchEvent(new Event(FOCUS_CANVAS_EVENT));
}

/** localStorage that never throws (it can be blocked); layouts are a per-machine convenience. */
const storage = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // not persisted; the layout still works for this session
    }
  },
};

let epoch = 0;
const subscribers = new Set<() => void>();
const bump = () => {
  epoch++;
  subscribers.forEach((s) => s());
};

/** Forget every saved panel layout on this machine. Returns an undo. */
export function resetLayouts(): () => void {
  const saved: [string, string][] = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) {
        saved.push([k, localStorage.getItem(k) ?? '']);
        localStorage.removeItem(k);
      }
    }
  } catch {
    // nothing stored
  }
  bump();
  return () => {
    saved.forEach(([k, v]) => storage.setItem(k, v));
    bump();
  };
}

/**
 * A row of resizable panes, remembered per machine. Panes meet edge to edge with a 1 px divider;
 * `locked` freezes the layout (Show mode), `preview` resizes on release (the Stage canvas).
 */
export function Columns(props: {
  id: string;
  locked?: boolean;
  preview?: boolean;
  vertical?: boolean;
  children: ReactNode;
}) {
  const e = useSyncExternalStore(
    (s) => {
      subscribers.add(s);
      return () => subscribers.delete(s);
    },
    () => epoch,
  );
  return <ColumnsInner key={e} {...props} />;
}

function ColumnsInner({
  id,
  locked,
  preview,
  vertical,
  children,
}: {
  id: string;
  locked?: boolean | undefined;
  preview?: boolean | undefined;
  vertical?: boolean | undefined;
  children: ReactNode;
}) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: PREFIX + id,
    storage,
    onlySaveAfterUserInteractions: true,
  });
  return (
    <Group
      id={id}
      orientation={vertical ? 'vertical' : 'horizontal'}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      disabled={locked}
      resizePreviewMode={preview ? 'separator' : undefined}
      className="h-full min-h-0"
    >
      {children}
    </Group>
  );
}

/** A pane in `Columns`. Side panes keep their pixel width when the window resizes. */
export function Pane({
  id,
  size,
  min,
  max,
  side,
  collapsible,
  paneRef,
  children,
}: {
  id: string;
  size?: number | string;
  min?: number | string;
  max?: number | string;
  side?: boolean;
  collapsible?: boolean;
  paneRef?: Ref<PanelImperativeHandle | null>;
  children: ReactNode;
}) {
  return (
    <Panel
      id={id}
      defaultSize={size}
      minSize={min}
      maxSize={max}
      collapsible={collapsible}
      collapsedSize={0}
      groupResizeBehavior={side ? 'preserve-pixel-size' : 'preserve-relative-size'}
      panelRef={paneRef}
      className="flex h-full min-h-0 flex-col"
    >
      {children}
    </Panel>
  );
}

/** The 1 px divider between panes; drag it, or focus it and use the arrow keys. */
export function Divider({ vertical }: { vertical?: boolean }) {
  return (
    <Separator
      className={`${vertical ? 'h-px' : 'w-px'} bg-line-subtle outline-none hover:bg-line-control focus-visible:bg-fg data-[disabled]:hover:bg-line-subtle`}
    />
  );
}
