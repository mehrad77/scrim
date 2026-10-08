import { X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { cn } from '../lib/cn.js';

interface ToastAction {
  label: string;
  run: () => void;
}

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'good';
  action?: ToastAction | undefined;
}

let toasts: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, { left: number; started: number; handle: number | null }>();

function emit() {
  listeners.forEach((l) => l());
}

function dismiss(id: number) {
  const t = timers.get(id);
  if (t?.handle) clearTimeout(t.handle);
  timers.delete(id);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

function start(id: number) {
  const t = timers.get(id);
  if (!t || t.handle !== null) return;
  t.started = Date.now();
  t.handle = window.setTimeout(() => dismiss(id), t.left);
}

function pause(id: number) {
  const t = timers.get(id);
  if (!t || t.handle === null) return;
  clearTimeout(t.handle);
  t.handle = null;
  t.left = Math.max(1000, t.left - (Date.now() - t.started));
}

/**
 * Show a short message. Errors stay until dismissed; others last at least 5 s (longer with an
 * action such as Undo), and pause while hovered or focused.
 */
export function toast(text: string, tone: Toast['tone'] = 'info', action?: ToastAction): void {
  const t: Toast = { id: next++, text, tone, action };
  toasts = [...toasts, t].slice(-4);
  if (tone !== 'error') {
    timers.set(t.id, { left: action ? 8000 : 5000, started: 0, handle: null });
    start(t.id);
  }
  emit();
}

export function errorToast(e: unknown): void {
  toast(e instanceof Error ? e.message : String(e), 'error');
}

/** Toasts live in one corner lane, never over GO, PANIC or the cue list. F6 jumps to them. */
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F6' || !toasts.length) return;
      e.preventDefault();
      region.current?.querySelector<HTMLElement>('button')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Nothing from the interface reaches an output window (UX_PRINCIPLES.md › Safety invariants).
  if (/^\/(output|remote-output)/.test(location.pathname)) return null;
  return (
    <div
      ref={region}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-10 z-40 flex flex-col items-end gap-2"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          onPointerEnter={() => pause(t.id)}
          onPointerLeave={() => start(t.id)}
          onFocus={() => pause(t.id)}
          onBlur={() => start(t.id)}
          className={cn(
            'pointer-events-auto flex max-w-sm items-center gap-3 rounded-overlay border bg-raised py-2 pr-2 pl-3 text-ui text-fg shadow-overlay',
            t.tone === 'error' ? 'border-lamp-fault' : 'border-line-control',
          )}
        >
          <span className="min-w-0 flex-1">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="h-7 shrink-0 rounded-control border border-line-control px-2 text-caption font-medium hover:bg-control-hover"
              onClick={() => {
                t.action?.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="flex size-7 shrink-0 items-center justify-center rounded-control text-fg-icon hover:bg-control-hover"
            onClick={() => dismiss(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
