import { ChevronRight } from 'lucide-react';
import { useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { useShow } from '../../state/editor.js';

/**
 * The simple editor (UX_PRINCIPLES › 8, simple modes): every tab stays, but rules, values,
 * control mappings and exact numbers fold behind a labelled step. The show says which editor it
 * opens in; only a person flips it.
 */
export function useSimpleEditor(): boolean {
  return useShow().editor?.mode === 'simple';
}

// What was opened in this session; switching the simple editor on folds it all again.
const KEY = 'scrim.unfolded';
let opened = new Set<string>(read());
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function write(next: Set<string>): void {
  opened = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // private mode: folds last as long as the page
  }
  for (const l of listeners) l();
}

/** Fold everything away again. */
export const refold = () => write(new Set());

export function useUnfolded(id: string): [boolean, () => void] {
  const open = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => opened.has(id),
  );
  return [open, () => write(new Set([...opened, id]))];
}

const FOCUSABLE = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * What the simple editor folds away: "Rules, values and triggers (3) — show". In the full editor
 * it is just its content. It never removes a feature and never folds by itself; opened, it stays
 * open for the session. `card` is the panel-sized step, with a line saying what is inside.
 */
export function Fold({
  id,
  label,
  count,
  hint,
  card,
  className,
  children,
}: {
  id: string;
  label: string;
  count?: number;
  hint?: string;
  card?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const simple = useSimpleEditor();
  const [open, unfold] = useUnfolded(id);
  if (!simple || open) return <>{children}</>;
  return (
    <button
      type="button"
      aria-expanded={false}
      onClick={(e) => {
        // The button gives way to what it held: take focus to the first control revealed in
        // its place, or into the page when the whole view changed.
        const host = e.currentTarget.parentElement;
        const before = new Set(host ? [...host.querySelectorAll(FOCUSABLE)] : []);
        unfold();
        requestAnimationFrame(() => {
          const fresh =
            host?.isConnected &&
            [...host.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => !before.has(el));
          (fresh || document.querySelector<HTMLElement>(`main ${FOCUSABLE}`))?.focus();
        });
      }}
      className={cn(
        'flex items-start gap-2 rounded-control text-left outline-none focus-visible:outline-2 focus-visible:outline-focus',
        card
          ? 'border border-dashed border-line-control bg-control p-3 hover:bg-control-hover'
          : 'py-1 text-caption text-fg-muted hover:text-fg',
        className,
      )}
    >
      <ChevronRight size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className={cn('block', card && 'text-ui font-medium text-fg')}>
          {label}
          {count ? ` (${count})` : ''} <span className="font-normal text-fg-subtle">— show</span>
        </span>
        {card && hint && <span className="mt-0.5 block text-caption text-fg-muted">{hint}</span>}
      </span>
    </button>
  );
}
