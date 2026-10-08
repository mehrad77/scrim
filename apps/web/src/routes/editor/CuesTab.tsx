import { cueOrder, uid, type Cue, type Show } from '@scrim/format';
import { Copy, Play, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { step } from '@scrim/engine';
import { removeCue } from '../../lib/refs.js';
import { Stage } from '../../render/Stage.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, Field, NumberInput, TextArea, Toggle } from '../../ui/Field.js';
import { Columns, Divider, Pane } from '../../ui/Layout.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { ActionList } from './ActionEditor.js';
import { cueEnd } from './CueDock.js';
import { CueList } from './CueList.js';
import { previewState } from './preview.js';

export function CuesTab() {
  return (
    <Columns id="editor.cues">
      <Pane id="list" size={340} min={260} side>
        <CueList />
      </Pane>
      <Divider />
      <Pane id="editor" min={320}>
        <CueEditor />
      </Pane>
      <Divider />
      <Pane id="preview" size={360} min={260} max={560} side collapsible>
        <CuePreview />
      </Pane>
    </Columns>
  );
}

function CueEditor() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const cueId = useEditor((s) => s.selection.cueId);
  const cue = show.cues.find((c) => c.id === cueId);
  if (!cue) {
    return (
      <Panel title="Cue">
        <Empty>
          Select a cue to edit what it does. A cue is a set of actions fired together when the
          operator presses GO.
        </Empty>
      </Panel>
    );
  }
  const set = (fn: (c: Cue) => void, coalesce?: string) =>
    update(
      (d) => {
        const c = d.cues.find((x) => x.id === cue.id);
        if (c) fn(c);
      },
      coalesce ? { coalesce: `${cue.id}:${coalesce}` } : undefined,
    );
  return (
    <Panel
      title="Cue"
      bodyClassName="p-3"
      actions={
        <>
          <IconButton
            label="Duplicate cue"
            icon={<Copy size={13} />}
            onClick={() => {
              const copy = {
                ...structuredClone(cue),
                id: uid('cue'),
                name: `${cue.name} copy`,
                updatedAt: Date.now(),
              };
              update(
                (d) => void d.cues.splice(d.cues.findIndex((c) => c.id === cue.id) + 1, 0, copy),
              );
              select({ cueId: copy.id });
            }}
          />
          <IconButton
            label="Delete cue"
            icon={<Trash2 size={13} />}
            onClick={() => {
              update((d) => removeCue(d, cue.id));
              select({ cueId: null });
            }}
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <CommitInput value={cue.name} onCommit={(name) => set((c) => void (c.name = name))} />
        </Field>
        <div>
          <div className="mb-2 text-caption text-fg-muted">When this cue fires</div>
          <ActionList
            show={show}
            actions={cue.actions}
            onChange={(actions) => set((c) => void (c.actions = actions))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-line-subtle p-2">
          <Toggle
            checked={cue.follow.auto}
            onChange={(auto) => set((c) => void (c.follow.auto = auto))}
            label="Then fire the next cue automatically"
          />
          {cue.follow.auto && (
            <div className="flex items-center gap-2 text-caption text-fg-muted">
              after
              <NumberInput
                className="w-20"
                value={cue.follow.delay}
                min={0}
                step={0.5}
                suffix="s"
                onCommit={(delay) => set((c) => void (c.follow.delay = delay))}
              />
            </div>
          )}
        </div>
        <Field label="Notes for the operator">
          <TextArea
            rows={3}
            defaultValue={cue.notes}
            key={cue.id}
            onBlur={(e) =>
              e.target.value !== cue.notes && set((c) => void (c.notes = e.target.value))
            }
            placeholder="e.g. Wait for the actor to reach the door"
          />
        </Field>
      </div>
    </Panel>
  );
}

function CuePreview() {
  const show = useShow();
  const cueId = useEditor((s) => s.selection.cueId);
  const cue = show.cues.find((c) => c.id === cueId);
  const settled = useMemo(() => previewState(show, cueId), [show, cueId]);
  // Play the cue with its real fades and delays: the state just before it, fired at T0, read at
  // T0 + t. Editor only; outputs never animate from here.
  const [t, setT] = useState<number | null>(null);
  const length = cue ? Math.max(0.5, cueEnd(cue)) : 0;
  const T0 = 1e9;
  const playing = useMemo(() => {
    if (!cue || t === null) return null;
    const order = cueOrder(show);
    const i = order.findIndex((c) => c.id === cue.id);
    const before = previewState(show, i > 0 ? order[i - 1]!.id : null);
    const fired = step(
      show,
      before,
      { type: 'fireCue', cueId: cue.id, source: 'system' },
      T0,
    ).state;
    return step(show, fired, { type: 'tick' }, T0 + t * 1000).state;
  }, [show, cue, t]);
  useEffect(() => {
    if (t === null || t >= length) return;
    const start = performance.now() - t * 1000;
    let raf = 0;
    const loop = () => {
      const next = (performance.now() - start) / 1000;
      if (next >= length) return setT(length);
      setT(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // Restart the loop only when play starts, not on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t === null, length]);
  const state = playing ?? settled;
  return (
    <Panel
      title="After this cue"
      bodyClassName="flex flex-col gap-2 p-2"
      actions={
        cue && (
          <Button
            size="sm"
            icon={<Play size={13} />}
            onClick={() => setT(0)}
            title="Play this cue with its fades and delays"
          >
            Play
          </Button>
        )
      }
    >
      {show.outputs.map((o) => (
        <div key={o.id}>
          <div className="mb-1 text-caption text-fg-subtle">{o.name}</div>
          <div className="aspect-video overflow-hidden rounded-control border border-line-subtle bg-black">
            <Stage
              show={show}
              state={state}
              outputId={o.id}
              variant="editor"
              clock={() => (playing ? T0 + (t ?? 0) * 1000 : Date.now())}
            />
          </div>
        </div>
      ))}
      {cue && (
        <input
          type="range"
          aria-label="Scrub through this cue"
          min={0}
          max={length}
          step={0.05}
          value={t ?? length}
          onChange={(e) => setT(Number(e.target.value))}
          className="w-full accent-accent"
        />
      )}
      <StatePreview show={show} state={state.vars} />
    </Panel>
  );
}

function StatePreview({ show, state }: { show: Show; state: Record<string, unknown> }) {
  if (!show.vars.length) return null;
  return (
    <div className="mt-2 text-caption">
      <div className="mb-1 text-caption text-fg-subtle">State (assuming no audience input)</div>
      {show.vars.map((v) => (
        <div key={v.id} className="flex justify-between border-b border-line-subtle py-1">
          <span className="text-fg-muted">{v.name}</span>
          <span className="font-mono text-fg">{JSON.stringify(state[v.id])}</span>
        </div>
      ))}
    </div>
  );
}
