import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'go';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-ink-100 text-ink-950 hover:bg-white',
  secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-700',
  ghost: 'text-ink-200 hover:bg-ink-800 hover:text-ink-100',
  danger: 'bg-live text-white hover:bg-rose-400',
  go: 'bg-go text-ink-950 hover:bg-green-400',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2 text-xs gap-1',
  md: 'h-9 px-3 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, ...rest }: ButtonProps & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      className={cn('w-7 px-0', className)}
      {...rest}
    />
  );
}
