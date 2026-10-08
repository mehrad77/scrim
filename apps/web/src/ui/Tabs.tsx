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
            'h-8 rounded-md px-3 text-sm font-medium transition-colors',
            value === t.id
              ? 'bg-ink-700 text-ink-100'
              : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
