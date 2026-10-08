import { cn } from '../lib/cn.js';

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex items-center gap-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'h-8 rounded-control px-3 text-sm font-medium transition-colors',
            value === t.id
              ? 'bg-control-active text-fg'
              : 'text-fg-muted hover:bg-control-hover hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
