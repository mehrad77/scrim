import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/cn.js';

const control =
  'w-full min-w-0 rounded-control border border-line-control bg-control px-2 text-sm text-fg placeholder:text-fg-subtle focus:border-fg-muted focus:outline-none disabled:opacity-50';

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
    <label className={cn('flex flex-col gap-1 text-xs text-fg-muted', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-[11px] text-fg-subtle">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-8', className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'py-1.5', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'h-8 pr-6', className)} {...rest}>
      {children}
    </select>
  );
}

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
      className={cn(control, 'h-8', className)}
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

export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  className,
  suffix,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(round(value))), [value]);
  const commit = () => {
    let n = Number(draft);
    if (!Number.isFinite(n)) return setDraft(String(value));
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    if (n !== value) onCommit(n);
    else setDraft(String(round(value)));
  };
  return (
    <div className={cn('relative', className)}>
      <input
        type="number"
        className={cn(control, 'h-8', suffix && 'pr-7')}
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-fg-subtle">
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
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted select-none">
      <input
        type="checkbox"
        className="size-4 accent-accent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
