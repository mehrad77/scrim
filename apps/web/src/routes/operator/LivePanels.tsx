import { formatValue, mediaPosition } from '@scrim/engine';
import type { AudioLayer, Var, VarValue, VideoLayer } from '@scrim/format';
import { Pause, Play, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { epochNow, formatClock } from '../../lib/clock.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, NumberInput, Select } from '../../ui/Field.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

export function StatePanel() {
  const [host, snap] = useHost();
  const { show, state, mode } = snap;
  const rehearsal = mode === 'rehearsal';
  return (
    <Panel title="Show state" className="h-full" bodyClassName="p-2">
      {show.triggers.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[11px] text-fg-subtle">Fire a trigger</div>
          <div className="flex flex-wrap gap-1">
            {show.triggers.map((t) => (
              <Button
                key={t.id}
                size="sm"
                icon={<Zap size={12} style={{ color: t.color }} />}
                onClick={() =>
                  host.dispatch({ type: 'trigger', triggerId: t.id, source: 'operator' })
                }
              >
                {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      {show.vars.length === 0 && <Empty>No state values in this show.</Empty>}
      {show.vars.map((v) => (
        <div key={v.id} className="flex items-center gap-2 border-b border-line-subtle py-1.5">
          <span className="w-32 shrink-0 truncate font-mono text-xs text-fg-muted">{v.name}</span>
          {rehearsal ? (
            <VarEditor
              def={v}
              value={state.vars[v.id]}
              onSet={(value) => host.dispatch({ type: 'setVar', varId: v.id, value })}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              {formatValue(state.vars[v.id]) || '—'}
            </span>
          )}
        </div>
      ))}
      {!rehearsal && show.vars.length > 0 && (
        <p className="mt-2 text-[11px] text-fg-subtle">Switch to Rehearsal to override values.</p>
      )}
    </Panel>
  );
}

function VarEditor({
  def,
  value,
  onSet,
}: {
  def: Var;
  value: VarValue | undefined;
  onSet: (v: VarValue) => void;
}) {
  if (def.type === 'number')
    return <NumberInput className="flex-1" value={Number(value) || 0} onCommit={onSet} />;
  if (def.type === 'choice' && def.options?.length) {
    return (
      <Select
        className="flex-1"
        value={String(value ?? '')}
        onChange={(e) => onSet(e.target.value)}
      >
        <option value="">—</option>
        {def.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </Select>
    );
  }
  if (def.type === 'text' || def.type === 'choice')
    return <CommitInput className="flex-1" value={String(value ?? '')} onCommit={onSet} />;
  return (
    <span className="min-w-0 flex-1 truncate font-mono text-sm">{formatValue(value) || '—'}</span>
  );
}

export function MediaPanel() {
  const [host, snap] = useHost();
  const { show, state, mode } = snap;
  const [now, setNow] = useState(epochNow);
  useEffect(() => {
    const id = setInterval(() => setNow(epochNow()), 250);
    return () => clearInterval(id);
  }, []);
  const media = show.layers.filter(
    (l): l is VideoLayer | AudioLayer => l.kind === 'video' || l.kind === 'audio',
  );
  return (
    <Panel title="Media" className="h-full" bodyClassName="p-2">
      {media.length === 0 && <Empty>No video or sound layers.</Empty>}
      {media.map((l) => {
        const clock = state.layers[l.id]?.media;
        const duration = show.media.find((m) => m.id === l.mediaId)?.duration;
        const pos = clock ? mediaPosition(clock, now) : 0;
        const shown = duration ? (l.loop ? pos % duration : Math.min(pos, duration)) : pos;
        return (
          <div key={l.id} className="border-b border-line-subtle py-2">
            <div className="flex items-center gap-2">
              <IconButton
                label={clock?.playing ? 'Pause' : 'Play'}
                icon={clock?.playing ? <Pause size={13} /> : <Play size={13} />}
                disabled={mode === 'show'}
                onClick={() =>
                  host.dispatch({
                    type: 'action',
                    action: clock?.playing
                      ? { type: 'pause', layerId: l.id }
                      : { type: 'play', layerId: l.id, restart: false },
                  })
                }
              />
              <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
              <span className="font-mono text-xs text-fg-muted">
                {formatClock(shown)}
                {duration ? ` / ${formatClock(duration)}` : ''}
              </span>
            </div>
            {duration && mode === 'rehearsal' && (
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={shown}
                className="mt-1 w-full accent-fg"
                onChange={(e) =>
                  host.dispatch({ type: 'seek', layerId: l.id, time: Number(e.target.value) })
                }
                aria-label={`Scrub ${l.name}`}
              />
            )}
          </div>
        );
      })}
    </Panel>
  );
}
