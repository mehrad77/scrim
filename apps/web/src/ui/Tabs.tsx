import { Tab, TabList, Tabs as RACTabs } from 'react-aria-components';
import { cn } from '../lib/cn.js';

/** Task tabs with arrow-key navigation. Switching is instant (no animated indicator). */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
  label = 'Sections',
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string; badge?: number | undefined }[];
  className?: string;
  label?: string;
}) {
  return (
    <RACTabs selectedKey={value} onSelectionChange={(k) => onChange(k as T)}>
      <TabList aria-label={label} className={cn('flex items-center gap-1', className)}>
        {tabs.map((t) => (
          <Tab
            key={t.id}
            id={t.id}
            className={({ isSelected }) =>
              cn(
                'flex h-control cursor-default items-center gap-1.5 rounded-control px-3 text-ui font-medium outline-none',
                isSelected
                  ? 'bg-control-active text-fg'
                  : 'text-fg-muted hover:bg-control-hover hover:text-fg',
              )
            }
          >
            {t.label}
            {!!t.badge && (
              <span className="rounded-control bg-control-hover px-1 text-caption text-warn tabular-nums">
                {t.badge}
              </span>
            )}
          </Tab>
        ))}
      </TabList>
    </RACTabs>
  );
}
