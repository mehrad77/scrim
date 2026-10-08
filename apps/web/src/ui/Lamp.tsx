import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type LampTone = 'go' | 'standby' | 'fault' | 'warn' | 'off';

const fill: Record<LampTone, string> = {
  go: 'bg-lamp-go',
  standby: 'bg-lamp-standby',
  fault: 'bg-lamp-fault',
  warn: 'bg-warn',
  off: 'bg-transparent',
};

const word: Record<LampTone, string> = {
  go: 'text-fg',
  standby: 'text-fg',
  fault: 'text-fault',
  warn: 'text-warn',
  off: 'text-fg-subtle',
};

/**
 * The one way state is shown (DESIGN_SYSTEM.md › Lamps): a square LED, a word, and an icon for
 * anything abnormal. Never colour alone; lamps never blink. An LED lights at once and goes out
 * over the fast duration (micro in the reduced profile).
 */
export function Lamp({
  tone,
  children,
  icon,
  className,
  title,
}: {
  tone: LampTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', word[tone], className)}
      data-info={title}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-[1px] border border-line-control transition-colors duration-(--dur-fast)',
          'in-data-[motion=reduced]:duration-(--dur-micro)',
          fill[tone],
          tone !== 'off' && 'transition-none',
        )}
      />
      {icon}
      <span className="label-caps">{children}</span>
    </span>
  );
}
