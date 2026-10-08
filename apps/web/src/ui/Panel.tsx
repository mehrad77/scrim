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
      className={cn(
        'flex min-h-0 flex-col rounded-control border border-line-subtle bg-panel',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-3">
          <h2 className="truncate text-xs font-semibold tracking-wide text-fg-muted uppercase">
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
    neutral: 'bg-control-hover text-fg-muted',
    good: 'bg-lamp-go-tint text-go',
    warn: 'bg-control-hover text-warn',
    bad: 'bg-control-hover text-fault',
    live: 'bg-lamp-fault text-on-fault',
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
  return <div className="p-6 text-center text-sm text-fg-subtle">{children}</div>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-control border border-line-control bg-control-hover px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">
      {children}
    </kbd>
  );
}
