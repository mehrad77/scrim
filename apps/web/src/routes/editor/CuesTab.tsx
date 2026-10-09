import { createCue, uid, type Cue, type Show } from '@scrim/format';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { removeCue } from '../../lib/refs.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, Field, NumberInput, Select, TextArea, Toggle } from '../../ui/Field.js';
import { Columns, Divider, Pane } from '../../ui/Layout.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { ActionList, defaultAction } from './ActionEditor.js';
import { AfterThisCue } from './AfterThisCue.js';
import { RecipeCards } from './recipes.js';
import { CueList } from './CueList.js';
import { SectionInput } from './SectionInput.js';
import { Fold, useSimpleEditor, useUnfolded } from './simple.js';

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
        <AfterThisCue />
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
  // The simple editor folds the section, the relaxed version and the performer's wait.
  const simple = useSimpleEditor();
  const [unfolded] = useUnfolded('cue.more');
  const more = !simple || unfolded;
  if (!cue) {
    return (
      <Panel title="Cue">
        <Empty
          title={show.cues.length ? 'No cue selected' : 'No cues yet'}
          action={
            !show.cues.length &&
            show.scenes[0] && (
              <Button
                icon={<Plus size={14} />}
                onClick={() => {
                  const c = createCue(show.scenes[0]!.id, 'New cue');
                  update((d) => void d.cues.push(c));
                  select({ cueId: c.id });
                }}
              >
                Add a cue
              </Button>
            )
          }
        >
          A cue is a set of actions fired together when the operator presses GO.
          {show.cues.length ? ' Pick one in the list to edit it.' : ''}
        </Empty>
        <div className="mx-auto w-full max-w-md px-3 pb-4">
          <p className="mb-2 text-caption text-fg-muted">Or build a scene of cues in one go:</p>
          <RecipeCards kind="content" />
        </div>
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
        <div className="flex gap-2">
          <Field label="Name" className="flex-1">
            <CommitInput value={cue.name} onCommit={(name) => set((c) => void (c.name = name))} />
          </Field>
          {more && (
            <Field label="Section" className="w-36">
              <SectionInput
                show={show}
                info="Verse, Chorus: a key or a performer can jump to this part of the scene"
                value={cue.section ?? ''}
                onCommit={(section) =>
                  set((c) => {
                    if (section) c.section = section;
                    else delete c.section;
                  })
                }
              />
            </Field>
          )}
        </div>
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
        <Fold
          id="cue.more"
          label="More options: section, relaxed version, waiting for a performer"
          count={[cue.section, cue.gentle, cue.waitFor].filter((x) => x !== undefined).length}
        >
          {null}
        </Fold>
        {more && <RelaxedVersion show={show} cue={cue} set={set} />}
        {more && show.triggers.length > 0 && (
          <Field
            label="Wait for a performer"
            hint="While this cue is on standby, their remote says “Your cue” and you see when they're ready."
          >
            <Select
              aria-label="Wait for a performer"
              value={cue.waitFor ?? ''}
              onChange={(e) =>
                set((c) => {
                  if (e.target.value) c.waitFor = e.target.value;
                  else delete c.waitFor;
                })
              }
            >
              <option value="">Nobody</option>
              {show.triggers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
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

/**
 * What the cue does in a relaxed performance: the same with relaxed's limits (slower fades,
 * intense layers left out), a gentler version of its own, or none of its actions.
 */
function RelaxedVersion({
  show,
  cue,
  set,
}: {
  show: Show;
  cue: Cue;
  set: (fn: (c: Cue) => void) => void;
}) {
  const mode = !cue.gentle ? 'same' : cue.gentle.length ? 'gentle' : 'skip';
  return (
    <div className="flex flex-col gap-2 rounded-control border border-line-subtle p-2">
      <Field label="In a relaxed performance">
        <Select
          value={mode}
          onChange={(e) =>
            set((c) => {
              if (e.target.value === 'same') delete c.gentle;
              // A gentler version starts from what the cue does now, or one action to edit.
              else if (e.target.value === 'skip') c.gentle = [];
              else
                c.gentle = c.actions.length
                  ? structuredClone(c.actions)
                  : [defaultAction('show', show)];
            })
          }
        >
          <option value="same">The same, softened: slower fades, intense layers left out</option>
          <option value="gentle">Something gentler instead…</option>
          <option value="skip">Nothing: leave this cue’s actions out</option>
        </Select>
      </Field>
      {mode === 'gentle' && (
        <ActionList
          show={show}
          actions={cue.gentle!}
          onChange={(gentle) => set((c) => void (c.gentle = gentle))}
        />
      )}
    </div>
  );
}
