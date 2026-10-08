import { createCue, cueOrder, uid, type Cue, type Show } from '@scrim/format';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  FolderPlus,
  Plus,
  Timer,
  Trash2,
} from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '../../lib/cn.js';
import { removeCue, removeScene } from '../../lib/refs.js';
import { Stage } from '../../render/Stage.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { confirmDialog, promptDialog } from '../../ui/dialog.js';
import { CommitInput, Field, NumberInput, TextArea, Toggle } from '../../ui/Field.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { ActionList } from './ActionEditor.js';
import { previewState } from './preview.js';

export function CuesTab() {
  return (
    <div className="grid h-full grid-cols-[340px_minmax(0,1fr)_360px] gap-2 p-2">
      <CueList />
      <CueEditor />
      <CuePreview />
    </div>
  );
}

function CueList() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const cueId = useEditor((s) => s.selection.cueId);
  const numbers = useMemo(() => new Map(cueOrder(show).map((c, i) => [c.id, i + 1])), [show]);

  const addScene = async () => {
    const name = await promptDialog('New scene', `Scene ${show.scenes.length + 1}`, 'Scene name');
    if (!name) return;
    const scene = { id: uid('scn'), name };
    const cue = createCue(scene.id, 'New cue');
    update((d) => {
      d.scenes.push(scene);
      d.cues.push(cue);
    });
    select({ cueId: cue.id });
  };

  const addCue = (sceneId: string, after?: Cue) => {
    const cue = createCue(sceneId, 'New cue');
    update((d) => {
      const i = after
        ? d.cues.findIndex((c) => c.id === after.id)
        : d.cues.findLastIndex((c) => c.sceneId === sceneId);
      d.cues.splice(i + 1, 0, cue);
    });
    select({ cueId: cue.id });
  };

  const moveCue = (cue: Cue, dir: -1 | 1) =>
    update((d) => {
      const inScene = d.cues.filter((c) => c.sceneId === cue.sceneId);
      const i = inScene.findIndex((c) => c.id === cue.id);
      const other = inScene[i + dir];
      if (other) {
        const a = d.cues.findIndex((c) => c.id === cue.id);
        const b = d.cues.findIndex((c) => c.id === other.id);
        [d.cues[a], d.cues[b]] = [d.cues[b]!, d.cues[a]!];
        return;
      }
      // Past the edge of the scene: move into the neighbouring scene.
      const si = d.scenes.findIndex((s) => s.id === cue.sceneId);
      const target = d.scenes[si + dir];
      if (!target) return;
      const c = d.cues.find((x) => x.id === cue.id)!;
      c.sceneId = target.id;
      d.cues = d.cues.filter((x) => x.id !== cue.id);
      const targetCues = d.cues.filter((x) => x.sceneId === target.id);
      const anchor = dir > 0 ? targetCues[0] : targetCues.at(-1);
      const at = anchor
        ? d.cues.findIndex((x) => x.id === anchor.id) + (dir > 0 ? 0 : 1)
        : d.cues.length;
      d.cues.splice(at, 0, c);
    });

  const moveScene = (sceneId: string, dir: -1 | 1) =>
    update((d) => {
      const i = d.scenes.findIndex((s) => s.id === sceneId);
      const j = i + dir;
      if (j < 0 || j >= d.scenes.length) return;
      [d.scenes[i], d.scenes[j]] = [d.scenes[j]!, d.scenes[i]!];
    });

  return (
    <Panel
      title="Cue list"
      bodyClassName="p-1"
      actions={
        <Button size="sm" icon={<FolderPlus size={13} />} onClick={addScene}>
          Scene
        </Button>
      }
    >
      {show.scenes.map((scene) => {
        const cues = show.cues.filter((c) => c.sceneId === scene.id);
        return (
          <div key={scene.id} className="mb-2">
            <div className="group flex items-center gap-1 rounded px-1 py-1">
              <ChevronRight size={14} className="text-fg-subtle" />
              <CommitInput
                aria-label="Scene name"
                value={scene.name}
                onCommit={(name) =>
                  update((d) => {
                    const s = d.scenes.find((x) => x.id === scene.id);
                    if (s && name.trim()) s.name = name.trim();
                  })
                }
                className="h-7 border-transparent bg-transparent text-xs font-semibold tracking-wide text-fg-muted uppercase hover:border-line-subtle"
              />
              <div className="flex opacity-0 group-hover:opacity-100">
                <IconButton
                  label="Move scene up"
                  icon={<ArrowUp size={12} />}
                  onClick={() => moveScene(scene.id, -1)}
                />
                <IconButton
                  label="Move scene down"
                  icon={<ArrowDown size={12} />}
                  onClick={() => moveScene(scene.id, 1)}
                />
                <IconButton
                  label="Delete scene"
                  icon={<Trash2 size={12} />}
                  onClick={async () => {
                    if (
                      await confirmDialog(
                        'Delete scene?',
                        <>
                          “{scene.name}” and its {cues.length} cue(s) will be removed.
                        </>,
                        'Delete',
                        true,
                      )
                    ) {
                      update((d) => removeScene(d, scene.id));
                    }
                  }}
                />
              </div>
              <IconButton
                label="Add cue to scene"
                icon={<Plus size={13} />}
                onClick={() => addCue(scene.id)}
              />
            </div>
            <ul>
              {cues.map((cue) => (
                <li
                  key={cue.id}
                  onClick={() => select({ cueId: cue.id })}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded py-1.5 pr-1 pl-3',
                    cue.id === cueId ? 'bg-control-active' : 'hover:bg-control-hover',
                  )}
                >
                  <span className="w-6 text-right font-mono text-xs text-fg-subtle">
                    {numbers.get(cue.id)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{cue.name}</div>
                    <div className="truncate text-[11px] text-fg-subtle">
                      {cue.actions.length} action{cue.actions.length === 1 ? '' : 's'}
                      {cue.notes && ` · ${cue.notes}`}
                    </div>
                  </div>
                  {cue.follow.auto && (
                    <span
                      className="flex items-center gap-0.5 text-[11px] text-standby"
                      title="Auto-follows into the next cue"
                    >
                      <Timer size={11} />
                      {cue.follow.delay}s
                    </span>
                  )}
                  <div className="flex opacity-0 group-hover:opacity-100">
                    <IconButton
                      label="Move up"
                      icon={<ArrowUp size={12} />}
                      onClick={(e) => (e.stopPropagation(), moveCue(cue, -1))}
                    />
                    <IconButton
                      label="Move down"
                      icon={<ArrowDown size={12} />}
                      onClick={(e) => (e.stopPropagation(), moveCue(cue, 1))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Panel>
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
          <div className="mb-2 text-xs text-fg-muted">When this cue fires</div>
          <ActionList
            show={show}
            actions={cue.actions}
            onChange={(actions) => set((c) => void (c.actions = actions))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-subtle p-2">
          <Toggle
            checked={cue.follow.auto}
            onChange={(auto) => set((c) => void (c.follow.auto = auto))}
            label="Then fire the next cue automatically"
          />
          {cue.follow.auto && (
            <div className="flex items-center gap-2 text-xs text-fg-muted">
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
          <div className="mb-1 text-[11px] text-fg-subtle">{o.name}</div>
          <div className="aspect-video overflow-hidden rounded border border-line-subtle bg-black">
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
    <div className="mt-2 text-xs">
      <div className="mb-1 text-[11px] text-fg-subtle">State (assuming no audience input)</div>
      {show.vars.map((v) => (
        <div key={v.id} className="flex justify-between border-b border-line-subtle py-1">
          <span className="text-fg-muted">{v.name}</span>
          <span className="font-mono text-fg">{JSON.stringify(state[v.id])}</span>
        </div>
      ))}
    </div>
  );
}
