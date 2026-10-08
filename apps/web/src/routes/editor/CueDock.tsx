import type { Action, Cue, Easing } from '@scrim/format';
import { cueOrder } from '@scrim/format';
import { AlignStartVertical, ListOrdered } from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '../../lib/cn.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button } from '../../ui/Button.js';
import { Empty, Panel } from '../../ui/Panel.js';

type Timed = Extract<
  Action,
  { type: 'show' | 'hide' | 'fade' | 'play' | 'pause' | 'seek' | 'setText' | 'counter' }
>;
const TIMED = new Set(['show', 'hide', 'fade', 'play', 'pause', 'seek', 'setText', 'counter']);
const isTimed = (a: Action): a is Timed => TIMED.has(a.type);
const VERB: Record<Timed['type'], string> = {
  show: 'Show',
  hide: 'Hide',
  fade: 'Fade',
  play: 'Play',
  pause: 'Pause',
  seek: 'Jump',
  setText: 'Text',
  counter: 'Timer',
};
const snap = (s: number) => Math.max(0, Math.round(s * 10) / 10);

/** A small picture of an easing curve, so timing reads at a glance. */
export function EasingGlyph({ easing, className }: { easing: Easing; className?: string }) {
  const d = {
    linear: 'M1 11 L15 1',
    easeIn: 'M1 11 C9 11 13 7 15 1',
    easeOut: 'M1 11 C3 5 7 1 15 1',
    easeInOut: 'M1 11 C8 11 8 1 15 1',
  }[easing];
  return (
    <svg viewBox="0 0 16 12" className={cn('h-3 w-4', className)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The cue dock (UX principle 6, "Time is visible"): the selected cue's layer actions as bars on
 * a time ruler. Drag a bar to change its delay, its right edge to change its fade; with a bar
 * focused, ←/→ change the delay and Alt+←/→ the fade (Shift for whole seconds). The fields in the
 * Cues tab mirror all of this for keyboard and screen-reader users.
 */
export function CueDock() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const cueId = useEditor((s) => s.selection.cueId);
  const cue = show.cues.find((c) => c.id === cueId);
  const lane = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);

  if (!cue) {
    return (
      <Panel title="Cue timing" className="h-full">
        <Empty>Select a cue to see its actions on a timeline.</Empty>
      </Panel>
    );
  }
  const number = cueOrder(show).findIndex((c) => c.id === cue.id) + 1;
  const timed = cue.actions
    .map((a, i) => ({ a, i }))
    .filter((x): x is { a: Timed; i: number } => isTimed(x.a));
  const end = Math.max(
    4,
    cue.follow.auto ? cue.follow.delay + 1 : 0,
    ...timed.map(({ a }) => (a.delay ?? 0) + ('duration' in a ? a.duration : 0) + 1),
  );

  const set = (i: number, patch: Partial<Timed>, live = true) =>
    update(
      (d) => {
        const c = d.cues.find((x) => x.id === cue.id);
        const a = c?.actions[i];
        if (a && isTimed(a)) Object.assign(a, patch);
        if (c) c.updatedAt = Date.now();
      },
      live ? { coalesce: `dock:${cue.id}:${i}` } : undefined,
    );

  const startDrag = (i: number, a: Timed, edge: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const width = lane.current?.getBoundingClientRect().width ?? 1;
    const perPx = end / width;
    const x0 = e.clientX;
    const delay0 = a.delay ?? 0;
    const dur0 = 'duration' in a ? a.duration : 0;
    setDrag(i);
    const move = (ev: PointerEvent) => {
      const ds = (ev.clientX - x0) * perPx;
      if (edge) set(i, { duration: snap(dur0 + ds) } as Partial<Timed>);
      else set(i, { delay: snap(delay0 + ds) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const layerName = (id: string) => show.layers.find((l) => l.id === id)?.name ?? '?';

  return (
    <Panel
      title={`Cue ${number} timing · ${cue.name}`}
      className="h-full"
      bodyClassName="flex flex-col"
      actions={
        timed.length > 1 && (
          <>
            <Button
              size="sm"
              variant="ghost"
              icon={<ListOrdered size={13} />}
              title="Start each action half a second after the one before"
              onClick={() =>
                update((d) => {
                  const c = d.cues.find((x) => x.id === cue.id);
                  let t = 0;
                  for (const a of c?.actions ?? []) {
                    if (!isTimed(a)) continue;
                    a.delay = t;
                    t = snap(t + 0.5);
                  }
                })
              }
            >
              Stagger
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<AlignStartVertical size={13} />}
              title="Start every action together"
              onClick={() =>
                update((d) => {
                  for (const a of d.cues.find((x) => x.id === cue.id)?.actions ?? [])
                    if (isTimed(a)) delete a.delay;
                })
              }
            >
              Together
            </Button>
          </>
        )
      }
    >
      {timed.length === 0 ? (
        <Empty>
          This cue has no layer actions yet. Add one in the Cues tab or with “Cue it in”.
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-auto">
          <div className="w-40 shrink-0 border-r border-line-subtle">
            <div className="h-6 border-b border-line-subtle" />
            {timed.map(({ a, i }) => (
              <div key={i} className="flex h-8 items-center gap-1.5 truncate px-2 text-caption">
                <span className="label-caps text-fg-subtle">{VERB[a.type]}</span>
                <span className="truncate text-fg">{layerName(a.layerId)}</span>
              </div>
            ))}
          </div>
          <div ref={lane} className="relative min-w-0 flex-1">
            <TimeRuler end={end} />
            {cue.follow.auto && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-standby"
                style={{ left: `${(cue.follow.delay / end) * 100}%` }}
              >
                <span className="label-caps ml-1 text-standby">Next cue</span>
              </div>
            )}
            {timed.map(({ a, i }) => (
              <Bar
                key={i}
                action={a}
                end={end}
                active={drag === i}
                label={`${VERB[a.type]} ${layerName(a.layerId)}`}
                onMove={startDrag(i, a, false)}
                onStretch={startDrag(i, a, true)}
                onKey={(dDelay, dDur) => {
                  if (dDelay) set(i, { delay: snap((a.delay ?? 0) + dDelay) });
                  if (dDur && 'duration' in a)
                    set(i, { duration: snap(a.duration + dDur) } as Partial<Timed>);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function TimeRuler({ end }: { end: number }) {
  const ticks = Array.from({ length: Math.floor(end) + 1 }, (_, i) => i);
  return (
    <div className="relative h-6 border-b border-line-subtle">
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute top-0 h-full border-l border-line-subtle pl-1 font-mono text-caption text-fg-subtle tabular-nums"
          style={{ left: `${(t / end) * 100}%` }}
        >
          {t}s
        </span>
      ))}
    </div>
  );
}

function Bar({
  action: a,
  end,
  active,
  label,
  onMove,
  onStretch,
  onKey,
}: {
  action: Timed;
  end: number;
  active: boolean;
  label: string;
  onMove: (e: ReactPointerEvent) => void;
  onStretch: (e: ReactPointerEvent) => void;
  onKey: (dDelay: number, dDur: number) => void;
}) {
  const delay = a.delay ?? 0;
  const dur = 'duration' in a ? a.duration : 0;
  return (
    <div className="relative h-8">
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label}: starts at ${delay} s${'duration' in a ? `, fades over ${dur} s` : ''}`}
        aria-valuemin={0}
        aria-valuemax={end}
        aria-valuenow={delay}
        data-info="Drag to change when it starts · drag the right edge to change the fade"
        onPointerDown={onMove}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 1 : 0.1;
          const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!dir) return;
          e.preventDefault();
          if (e.altKey) onKey(0, dir * step);
          else onKey(dir * step, 0);
        }}
        className={cn(
          'absolute top-1.5 flex h-5 cursor-grab items-center gap-1 overflow-hidden rounded-control border px-1 text-caption outline-none focus-visible:outline-2 focus-visible:outline-focus',
          dur > 0
            ? 'border-accent bg-accent-subtle text-fg'
            : 'border-line-control bg-control text-fg-muted',
          active && 'cursor-grabbing',
        )}
        style={{
          left: `${(delay / end) * 100}%`,
          width: dur > 0 ? `${(dur / end) * 100}%` : undefined,
          minWidth: 20,
        }}
      >
        {'easing' in a && dur > 0 && (
          <EasingGlyph easing={a.easing} className="shrink-0 text-accent-text" />
        )}
        <span className="truncate font-mono tabular-nums">{dur > 0 ? `${dur}s` : '·'}</span>
        {'duration' in a && (
          <span
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation();
              onStretch(e);
            }}
            className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
          />
        )}
      </div>
    </div>
  );
}

export function cueEnd(cue: Cue): number {
  return Math.max(
    0,
    ...cue.actions.filter(isTimed).map((a) => (a.delay ?? 0) + ('duration' in a ? a.duration : 0)),
  );
}
