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
        className={cn(control, 'h-control', suffix && 'pr-7')}
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
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
