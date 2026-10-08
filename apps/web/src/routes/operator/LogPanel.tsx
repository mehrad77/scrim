import { cn } from '../../lib/cn.js';
import { Panel } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

export function LogPanel() {
  const [, snap] = useHost();
  const entries = [...snap.log].reverse();
  return (
    <Panel title="Run log" className="h-full" bodyClassName="p-2 font-mono text-caption">
      {entries.map((e, i) => (
        <div
          key={i}
          className={cn(
            'flex gap-2 py-0.5',
            e.kind === 'warning' && 'text-warn',
            e.kind === 'panic' && 'text-fault',
            e.kind === 'cue' && 'text-fg',
            e.kind === 'moment' && 'text-info',
            e.kind === 'trigger' && 'text-fg-muted',
            e.kind === 'info' && 'text-fg-subtle',
          )}
        >
          <span className="shrink-0 text-fg-subtle">{new Date(e.at).toLocaleTimeString()}</span>
          <span>{e.text}</span>
        </div>
      ))}
    </Panel>
  );
}
