import { useSyncExternalStore } from 'react';
import { cn } from '../lib/cn.js';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'good';
}

let toasts: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();

export function toast(text: string, tone: Toast['tone'] = 'info'): void {
  const t = { id: next++, text, tone };
  toasts = [...toasts, t].slice(-4);
  listeners.forEach((l) => l());
  setTimeout(
    () => {
      toasts = toasts.filter((x) => x.id !== t.id);
      listeners.forEach((l) => l());
    },
    tone === 'error' ? 8000 : 4000,
  );
}

export function errorToast(e: unknown): void {
  toast(e instanceof Error ? e.message : String(e), 'error');
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2"
      aria-live="polite"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto max-w-sm rounded-lg border px-3 py-2 text-sm shadow-xl',
            t.tone === 'error' && 'border-rose-500/50 bg-rose-950 text-rose-100',
            t.tone === 'good' && 'border-green-500/40 bg-green-950 text-green-100',
            t.tone === 'info' && 'border-ink-700 bg-ink-800 text-ink-100',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
