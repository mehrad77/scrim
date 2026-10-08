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
    <section className={cn('flex min-h-0 flex-col bg-panel', className)}>
      {(title || actions) && (
        <header className="flex h-panel-head shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-3">
          <h2 className="label-caps truncate text-fg-muted">{title}</h2>
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
        'inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-caption font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * An empty state does three jobs: says what's here, teaches, and offers the first action
 * (UX principle 8). The headline is in Fraunces on brand surfaces (Library, audience).
 */
export function Empty({
  title,
  action,
  brand = false,
  children,
}: {
  title?: string;
  action?: ReactNode;
  brand?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center">
      {title && (
        <p
          className={cn(
            'text-fg',
            brand ? 'font-display text-heading font-semibold' : 'text-ui font-medium',
          )}
        >
          {title}
        </p>
      )}
      {children && <div className="max-w-sm text-ui text-fg-subtle">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-control border border-line-control bg-control-hover px-1.5 py-0.5 label-caps text-fg-muted">
      {children}
    </kbd>
  );
}
