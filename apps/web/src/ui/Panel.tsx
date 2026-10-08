import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn('flex min-h-0 flex-col rounded-lg border border-ink-800 bg-ink-900', className)}
    >
      {(title || actions) && (
        <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-ink-800 px-3">
          <h2 className="truncate text-xs font-semibold tracking-wide text-ink-300 uppercase">
            {title}
          </h2>
          <div className="flex items-center gap-1">{actions}</div>
        </header>
      )}
      <div className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'live';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'bg-ink-800 text-ink-200',
    good: 'bg-green-500/15 text-green-300',
    warn: 'bg-amber-500/15 text-amber-300',
    bad: 'bg-rose-500/20 text-rose-300',
    live: 'bg-live text-white',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-6 text-center text-sm text-ink-400">{children}</div>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[11px] text-ink-200">
      {children}
    </kbd>
  );
}
