import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import type { RunLogEntry } from '../../storage/db.js';
import { Panel } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

const tone: Record<RunLogEntry['kind'], string> = {
  warning: 'text-warn',
  panic: 'text-fault',
  cue: 'text-fg',
  moment: 'text-info',
  trigger: 'text-fg-muted',
  rule: 'text-fg-muted',
  info: 'text-fg-subtle',
};

export function LogPanel() {
  const [, snap] = useHost();
  const entries = [...snap.log].reverse();
  return (
    <Panel title="Run log" className="h-full" bodyClassName="p-2 font-mono text-caption">
      {entries.map((e, i) => {
        const time = (
          <span className="shrink-0 text-fg-subtle">{new Date(e.at).toLocaleTimeString()}</span>
        );
        if (!e.detail?.length) {
          return (
            <div key={i} className={cn('flex gap-2 py-0.5', tone[e.kind])}>
              {time}
              <span>{e.text}</span>
            </div>
          );
        }
        // Skipped rules fold away; open them to see what each rule saw.
        return (
          <details key={i} className={cn('group py-0.5', tone[e.kind])}>
            <summary className="flex cursor-default list-none gap-2 [&::-webkit-details-marker]:hidden">
              {time}
              <span className="flex items-center gap-0.5">
                <ChevronRight size={12} className="shrink-0 group-open:rotate-90" aria-hidden />
                {e.text}
              </span>
            </summary>
            <ul className="mt-0.5 ml-[calc(9ch+1rem)] text-fg-subtle">
              {e.detail.map((d, j) => (
                <li key={j}>{d}</li>
              ))}
            </ul>
          </details>
        );
      })}
    </Panel>
  );
}
