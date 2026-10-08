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
            'pointer-events-auto max-w-sm rounded-overlay border bg-raised px-3 py-2 text-sm text-fg shadow-overlay',
            t.tone === 'error' && 'border-lamp-fault',
            t.tone === 'good' && 'border-line-control',
            t.tone === 'info' && 'border-line-control',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
