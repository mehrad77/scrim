import { formatValue, mediaPosition } from '@scrim/engine';
import type { AudioLayer, Var, VarValue, VideoLayer } from '@scrim/format';
import { Pause, Pin, PinOff, Play, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { epochNow, formatClock } from '../../lib/clock.js';
import { cn } from '../../lib/cn.js';
import { valueLabel } from '../../lib/logic.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, NumberInput, Select, Toggle } from '../../ui/Field.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { Mappable } from './MapMode.js';
import { useHost } from './Operator.js';
import { usePins } from './pins.js';

/**
 * Show state as values (UX principle 7): now, before the last cue, and at the top of the show.
 * Rehearsal can override "now"; any value can be pinned to the message strip.
 */
export function StatePanel() {
  const [host, snap] = useHost();
  const { show, state, mode } = snap;
  const rehearsal = mode === 'rehearsal';
  const [changedOnly, setChangedOnly] = useState(false);
  const [pins, togglePin] = usePins(show.id);
  const before = state.back?.state.vars;
  const text = (varId: string, v: VarValue | undefined) =>
    typeof v === 'string' || typeof v === 'number'
      ? valueLabel(show, varId, v) || '—'
      : formatValue(v) || '—';
  const vars = show.vars.filter(
    (v) => !changedOnly || text(v.id, state.vars[v.id]) !== text(v.id, v.initial),
  );
  return (
    <Panel
      title="Show state"
      className="h-full"
      bodyClassName="p-2"
      actions={
        show.vars.length > 0 && (
          <Toggle checked={changedOnly} onChange={setChangedOnly} label="Changed only" />
        )
      }
    >
      {show.triggers.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-caption text-fg-subtle">Fire a trigger</div>
          <div className="flex flex-wrap gap-1">
            {show.triggers.map((t) => (
              <Mappable key={t.id} command={{ type: 'trigger', triggerId: t.id }}>
                <Button
                  size="sm"
                  icon={<Zap size={12} style={{ color: t.color }} />}
                  onClick={() =>
                    host.dispatch({ type: 'trigger', triggerId: t.id, source: 'operator' })
                  }
                >
                  {t.name}
                </Button>
              </Mappable>
            ))}
          </div>
        </div>
      )}
      {show.vars.length === 0 && (
        <Empty title="No state values">
          Values the show remembers, like votes and scores, appear here.
        </Empty>
      )}
      {show.vars.length > 0 && (
        <ul aria-label="State values">
          {vars.map((v) => {
            const now = text(v.id, state.vars[v.id]);
            const was = before ? text(v.id, before[v.id]) : '—';
            const pinned = pins.includes(v.id);
            return (
              <li key={v.id} className="border-b border-line-subtle py-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate font-mono text-caption text-fg-muted">
                    {v.name}
                  </span>
                  {rehearsal ? (
                    <VarEditor
                      def={v}
                      value={state.vars[v.id]}
                      label={(o) => valueLabel(show, v.id, o)}
                      onSet={(value) => host.dispatch({ type: 'setVar', varId: v.id, value })}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-ui text-fg">{now}</span>
                  )}
                  <IconButton
                    label={pinned ? 'Unpin from the message strip' : 'Pin to the message strip'}
                    icon={pinned ? <PinOff size={12} /> : <Pin size={12} />}
                    className={pinned ? 'text-fg' : undefined}
                    onClick={() => togglePin(v.id)}
                  />
                </div>
                <div className="mt-0.5 ml-26 flex gap-3 text-caption text-fg-subtle">
                  <span className="min-w-0 truncate">
                    before last cue{' '}
                    <span className={cn(was !== now && was !== '—' && 'text-fg-muted')}>{was}</span>
                  </span>
                  <span className="min-w-0 truncate">at the top {text(v.id, v.initial)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {changedOnly && vars.length === 0 && show.vars.length > 0 && (
        <p className="py-2 text-caption text-fg-subtle">Nothing has changed since the top.</p>
      )}
      {!rehearsal && show.vars.length > 0 && (
        <p className="mt-2 text-caption text-fg-subtle">Switch to Rehearsal to override values.</p>
      )}
    </Panel>
  );
}

function VarEditor({
  def,
  value,
  label,
  onSet,
}: {
  def: Var;
  value: VarValue | undefined;
  label: (option: string) => string;
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
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </Select>
    );
  }
  if (def.type === 'text' || def.type === 'choice')
    return <CommitInput className="flex-1" value={String(value ?? '')} onCommit={onSet} />;
  return (
    <span className="min-w-0 flex-1 truncate font-mono text-ui">{formatValue(value) || '—'}</span>
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
      {media.length === 0 && (
        <Empty title="No video or sound">
          Video and sound layers can be paused and scrubbed here.
        </Empty>
      )}
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
              <span className="min-w-0 flex-1 truncate text-ui">{l.name}</span>
              <span className="font-mono text-caption text-fg-muted">
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
