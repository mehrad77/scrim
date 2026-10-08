import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Hold-to-confirm for rare, consequential actions (Reset, Take over, leaving Show mode): press
 * and hold for `ms`; the fill shows progress. No dialog, so nothing ever covers GO.
 */
export function HoldButton({
  children,
  onConfirm,
  ms = 1000,
  icon,
  className,
  danger,
  label,
}: {
  children: ReactNode;
  onConfirm: () => void;
  ms?: number;
  icon?: ReactNode;
  className?: string;
  danger?: boolean;
  /** Spoken and shown in the Info strip, e.g. "Hold to reset to the top". */
  label: string;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, ms);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      aria-label={label}
      data-info={label}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') stop();
      }}
      className={cn(
        'relative inline-flex h-7 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-control border border-line-control bg-control px-2 text-caption font-medium select-none hover:bg-control-hover',
        danger ? 'text-fault' : 'text-fg',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 origin-left bg-control-active"
        style={{
          transform: `scaleX(${holding ? 1 : 0})`,
          transition: holding ? `transform ${ms}ms linear` : 'none',
        }}
      />
      <span className="relative inline-flex items-center gap-1">
        {icon}
        {children}
      </span>
    </button>
  );
}
