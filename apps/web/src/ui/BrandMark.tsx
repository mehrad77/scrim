import { cn } from '../lib/cn.js';

/**
 * The spike mark: two crossed strips of tape, the floor mark for a position
 * (DESIGN_SYSTEM.md › Mark). It replaces the 🎭 emoji, which renders differently on every phone.
 */
export function SpikeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-6', className)} fill="currentColor">
      <rect x="1.5" y="9.75" width="21" height="4.5" rx="0.5" transform="rotate(35 12 12)" />
      <rect
        x="1.5"
        y="9.75"
        width="21"
        height="4.5"
        rx="0.5"
        transform="rotate(-35 12 12)"
        opacity="0.75"
      />
    </svg>
  );
}

/** "Scrim" in Fraunces 600, beside the spike mark. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <SpikeMark className="size-[1.1em] text-accent" />
      <span className="font-display font-semibold tracking-tight">Scrim</span>
    </span>
  );
}
