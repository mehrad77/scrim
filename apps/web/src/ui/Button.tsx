import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Tip } from './Tooltip.js';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'go';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-fg text-app hover:bg-fg-muted',
  // The brand accent: editor and Library only, never on operator surfaces.
  accent: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-control text-fg hover:bg-control-hover border border-line-control',
  ghost: 'text-fg-muted hover:bg-control-hover hover:text-fg',
  danger: 'border border-line-control bg-control text-fault hover:bg-control-hover',
  go: 'bg-lamp-go text-on-lamp hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2 text-caption gap-1',
  md: 'h-control px-3 text-ui gap-2',
  lg: 'h-12 px-5 text-body gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Shortcut shown in the tooltip and Info strip. */
  shortcut?: string | undefined;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  title,
  shortcut,
  ...rest
}: ButtonProps) {
  const button = (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      data-shortcut={shortcut}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
  // A title becomes a real tooltip (and an Info strip line), not a native one.
  return title ? (
    <Tip label={title} shortcut={shortcut} disabled={rest.disabled}>
      {button}
    </Tip>
  ) : (
    button
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
