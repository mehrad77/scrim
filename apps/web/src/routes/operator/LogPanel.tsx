import { cn } from '../../lib/cn.js';
import { Panel } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

export function LogPanel() {
  const [, snap] = useHost();
  const entries = [...snap.log].reverse();
  return (
    <Panel title="Run log" className="h-full" bodyClassName="p-2 font-mono text-[11px]">
      {entries.map((e, i) => (
        <div
          key={i}
          className={cn(
            'flex gap-2 py-0.5',
            e.kind === 'warning' && 'text-amber-300',
            e.kind === 'panic' && 'text-rose-300',
            e.kind === 'cue' && 'text-ink-100',
            e.kind === 'moment' && 'text-violet-300',
            e.kind === 'trigger' && 'text-sky-300',
            e.kind === 'info' && 'text-ink-400',
          )}
        >
          <span className="shrink-0 text-ink-500">{new Date(e.at).toLocaleTimeString()}</span>
          <span>{e.text}</span>
        </div>
      ))}
    </Panel>
  );
}
