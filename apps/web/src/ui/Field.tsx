import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Check } from 'lucide-react';
import { Checkbox } from 'react-aria-components';
import { cn } from '../lib/cn.js';

const control =
  'w-full min-w-0 rounded-control border border-line-control bg-control px-2 text-ui text-fg placeholder:text-fg-subtle focus:border-fg-muted focus:outline-none disabled:opacity-50';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1 text-caption text-fg-muted', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-caption text-fg-subtle">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-control', className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'py-1.5', className)} {...rest} />;
}

export { Select } from './Select.js';

/** Text input that commits on blur or Enter, so typing doesn't spam undo history. */
export function CommitInput({
  value,
  onCommit,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return (
    <input
      className={cn(control, 'h-control', className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(value);
      }}
      {...rest}
    />
  );
}

/**
 * Evaluate what was typed in a number field: plain numbers, arithmetic, or a change relative to
 * the current value when it starts with +, * or / ("+10", "*2"). Null when it isn't a number.
 */
export function evaluateNumber(text: string, current: number): number | null {
  let t = text.trim();
  if (!t) return null;
  if (/^[+*/]/.test(t)) t = `${current}${t}`;
  if (!/^[\d+\-*/().\s]+$/.test(t)) return null;
  try {
    const n = Function(`"use strict"; return (${t});`)() as unknown;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * A number field in the precision kit (DESIGN_SYSTEM.md › Scrub field): drag its label to scrub
 * (Shift ×10, Alt ×0.1), use ↑/↓ the same way, or type math ("+10", "*2", "(x/2)+6").
 * `onCommit(value, scrubbing)` is called live while scrubbing so callers can coalesce undo.
 */
export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  className,
  suffix,
  label,
  'aria-label': ariaLabel,
}: {
  value: number;
  onCommit: (v: number, scrubbing?: boolean) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  suffix?: string;
  /** A short scrub label inside the field ("X", "W"). */
  label?: string;
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(round(value))), [value]);
  const clamp = (n: number) => {
    let x = round(n);
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    return x;
  };
  const commit = () => {
    const n = evaluateNumber(draft, value);
    if (n === null) return setDraft(String(round(value)));
    const c = clamp(n);
    if (c !== value) onCommit(c);
    else setDraft(String(round(value)));
  };
  const factor = (e: { shiftKey: boolean; altKey: boolean }) =>
    e.shiftKey ? 10 : e.altKey ? 0.1 : 1;

  const scrub = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = value;
    let moved = 0;
    el.setPointerCapture(e.pointerId);
    try {
      void el.requestPointerLock?.()?.catch?.(() => undefined);
    } catch {
      // pointer lock is optional
    }
    const move = (ev: PointerEvent) => {
      moved += ev.movementX;
      onCommit(clamp(start + Math.round(moved / 2) * step * factor(ev)), true);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (document.pointerLockElement) document.exitPointerLock();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <div className={cn('relative', className)}>
      {label && (
        <span
          aria-hidden
          onPointerDown={scrub}
          data-info={`Drag to change ${label} (Shift ×10, Alt ×0.1)`}
          className="absolute top-1/2 left-0 flex h-full w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center text-caption text-fg-subtle select-none hover:text-fg"
        >
          {label}
        </span>
      )}
      <input
        inputMode="decimal"
        aria-label={ariaLabel ?? label}
        className={cn(
          control,
          'h-control font-mono tabular-nums',
          label && 'pl-6',
          suffix && 'pr-7',
        )}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          else if (e.key === 'Escape') setDraft(String(round(value)));
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const dir = e.key === 'ArrowUp' ? 1 : -1;
            onCommit(clamp(value + dir * step * factor(e)));
          }
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-caption text-fg-subtle">
          {suffix}
        </span>
      )}
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <Checkbox
      isSelected={checked}
      onChange={onChange}
      className="group flex cursor-default items-center gap-2 text-ui text-fg-muted outline-none select-none"
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded-control border border-line-control bg-control group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-focus group-data-[selected]:border-fg group-data-[selected]:bg-fg">
        <Check size={12} className="hidden text-app group-data-[selected]:block" />
      </span>
      {label}
    </Checkbox>
  );
}
