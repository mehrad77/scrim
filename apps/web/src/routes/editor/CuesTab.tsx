import { uid, type Cue, type Show } from '@scrim/format';
import { Copy, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { removeCue } from '../../lib/refs.js';
import { Stage } from '../../render/Stage.js';
import { useEditor, useShow } from '../../state/editor.js';
import { IconButton } from '../../ui/Button.js';
import { CommitInput, Field, NumberInput, TextArea, Toggle } from '../../ui/Field.js';
import { Columns, Divider, Pane } from '../../ui/Layout.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { ActionList } from './ActionEditor.js';
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
  const state = useMemo(() => previewState(show, cueId), [show, cueId]);
  return (
    <Panel title="After this cue" bodyClassName="flex flex-col gap-2 p-2">
      {show.outputs.map((o) => (
        <div key={o.id}>
          <div className="mb-1 text-caption text-fg-subtle">{o.name}</div>
          <div className="aspect-video overflow-hidden rounded-control border border-line-subtle bg-black">
            <Stage show={show} state={state} outputId={o.id} variant="editor" />
          </div>
        </div>
      ))}
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
