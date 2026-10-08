import { uid, type Moment, type MomentType, type Show, type Var } from '@scrim/format';
import { ArrowRight, Plus, Trash2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { checkLogic, usage } from '../../lib/logic.js';
import {
  createResultVars,
  initialFor,
  MOMENT_TYPES,
  newMoment,
  slug,
  syncResultVars,
  uniqueName,
} from '../../lib/moments.js';
import { removeMoment, removeTrigger, removeVar } from '../../lib/refs.js';
import { tryOutcomes } from '../../lib/simulate.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, Field, NumberInput, Select, TextArea, Toggle } from '../../ui/Field.js';
import { Columns, Divider, Pane } from '../../ui/Layout.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';
import { RulesPanel } from './RulesPanel.js';

/**
 * Interaction (UX principle 7): values and triggers on the left, rules as grouped sentences in
 * the middle, the selected audience moment on the right with "Try every outcome".
 */
export function InteractionTab() {
  const show = useShow();
  const [moment, setMoment] = useState<string | null>(show.moments[0]?.id ?? null);
  const issues = useMemo(() => checkLogic(show), [show]);
  return (
    <Columns id="editor.interaction">
      <Pane id="values" size={300} min={240} side>
        <div className="flex h-full min-h-0 flex-col gap-px bg-line-subtle">
          <VarsPanel />
          <TriggersPanel />
        </div>
      </Pane>
      <Divider />
      <Pane id="rules" min={360}>
        <RulesPanel issues={issues} onPickMoment={setMoment} />
      </Pane>
      <Divider />
      <Pane id="moments" size={360} min={300} side>
        <MomentsPanel selected={moment} onSelect={setMoment} />
      </Pane>
    </Columns>
  );
}

function UsedBy({ n }: { n: number }) {
  return (
    <span className={cn('shrink-0 text-caption tabular-nums', n ? 'text-fg-subtle' : 'text-warn')}>
      {n ? `used by ${n}` : 'unused'}
    </span>
  );
}

// ---- state values ----

function VarsPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const use = usage(show);
  const setVar = (id: string, fn: (v: Var) => void) =>
    update((d) => {
      const v = d.vars.find((x) => x.id === id);
      if (v) fn(v);
    });
  return (
    <Panel
      title="State values"
      className="flex-1"
      bodyClassName="p-2"
      actions={
        <IconButton
          label="Add state value"
          icon={<Plus size={14} />}
          onClick={() =>
            update(
              (d) =>
                void d.vars.push({
                  id: uid('var'),
                  name: uniqueName(d, 'score'),
                  type: 'number',
                  initial: 0,
                }),
            )
          }
        />
      }
    >
      {show.vars.length === 0 && (
        <Empty>
          Named values the show remembers — votes, scores, choices. Rules and cues can read and
          change them.
        </Empty>
      )}
      <div className="flex flex-col gap-2">
        {show.vars.map((v) => (
          <div key={v.id} className="rounded-control border border-line-subtle p-2">
            <div className="flex items-center gap-1">
              <CommitInput
                aria-label="Name"
                className="font-mono"
                value={v.name}
                onCommit={(name) => {
                  const clean = slug(name);
                  if (show.vars.some((x) => x.name === clean && x.id !== v.id))
                    return toast('That name is taken', 'error');
                  setVar(v.id, (x) => void (x.name = clean));
                }}
              />
              <Select
                aria-label="Type"
                className="w-28 shrink-0"
                value={v.type}
                onChange={(e) =>
                  setVar(v.id, (x) => {
                    x.type = e.target.value as Var['type'];
                    x.initial = initialFor(x.type);
                  })
                }
              >
                <option value="number">Number</option>
                <option value="text">Text</option>
                <option value="choice">Choice</option>
                <option value="tally">Tally</option>
                <option value="list">List</option>
              </Select>
              <IconButton
                label="Delete"
                icon={<Trash2 size={12} />}
                onClick={() => update((d) => removeVar(d, v.id))}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-caption text-fg-subtle">
              {v.type === 'number' && (
                <>
                  starts at
                  <NumberInput
                    className="w-24"
                    value={Number(v.initial) || 0}
                    onCommit={(n) => setVar(v.id, (x) => void (x.initial = n))}
                  />
                </>
              )}
              {v.type === 'text' && (
                <>
                  starts as
                  <CommitInput
                    value={String(v.initial)}
                    onCommit={(t) => setVar(v.id, (x) => void (x.initial = t))}
                  />
                </>
              )}
              {(v.type === 'choice' || v.type === 'tally') && (
                <>
                  options
                  <CommitInput
                    placeholder="left, right"
                    value={(v.options ?? []).join(', ')}
                    onCommit={(t) =>
                      setVar(v.id, (x) => {
                        x.options = t
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (x.type === 'tally')
                          x.initial = Object.fromEntries(x.options.map((o) => [o, 0]));
                      })
                    }
                  />
                </>
              )}
              {v.type === 'list' && <span>starts empty</span>}
              <span className="ml-auto">
                <UsedBy n={use.usedBy(v.id)} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---- triggers ----

function TriggersPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const use = usage(show);
  return (
    <Panel
      title="Triggers"
      bodyClassName="p-2"
      actions={
        <IconButton
          label="Add trigger"
          icon={<Plus size={14} />}
          onClick={() =>
            update(
              (d) =>
                void d.triggers.push({
                  id: uid('trg'),
                  name: `Trigger ${d.triggers.length + 1}`,
                  color: '#e11d48',
                }),
            )
          }
        />
      }
    >
      {show.triggers.length === 0 && (
        <Empty>
          Named buttons performers press on their phone, a pedal or a MIDI controller. Rules decide
          what they do.
        </Empty>
      )}
      {show.triggers.map((t) => (
        <div key={t.id} className="mb-1 flex items-center gap-1">
          <input
            type="color"
            aria-label="Color"
            value={t.color}
            className="h-8 w-9 shrink-0 rounded-control border border-line-subtle bg-panel"
            onChange={(e) =>
              update(
                (d) => {
                  const x = d.triggers.find((y) => y.id === t.id);
                  if (x) x.color = e.target.value;
                },
                { coalesce: `${t.id}:color` },
              )
            }
          />
          <CommitInput
            value={t.name}
            onCommit={(name) =>
              update((d) => {
                const x = d.triggers.find((y) => y.id === t.id);
                if (x) x.name = name;
              })
            }
          />
          <UsedBy n={use.usedBy(t.id)} />
          <IconButton
            label="Delete trigger"
            icon={<Trash2 size={12} />}
            onClick={() => update((d) => removeTrigger(d, t.id))}
          />
        </div>
      ))}
    </Panel>
  );
}

// ---- audience moments ----

function MomentsPanel({
  selected,
  onSelect: setSelected,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const moment = show.moments.find((m) => m.id === selected) ?? show.moments[0];
  return (
    <Panel
      title="Audience moments"
      className="h-full"
      bodyClassName="p-2"
      actions={
        <Select
          value=""
          className="w-40"
          aria-label="Add audience moment"
          onChange={(e) => {
            if (!e.target.value) return;
            const m = newMoment(e.target.value as MomentType, show);
            update((d) => {
              createResultVars(d, m);
              d.moments.push(m);
            });
            setSelected(m.id);
          }}
        >
          <option value="">+ Add moment…</option>
          {MOMENT_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </Select>
      }
    >
      {show.moments.length === 0 && (
        <Empty>
          Audience moments open on every joined phone when a cue says so — a vote, a tap race, a
          slider, a name, a secret prop — and write the result into state.
        </Empty>
      )}
      <div className="mb-3 flex flex-wrap gap-1">
        {show.moments.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className={cn(
              'rounded-control border px-2 py-1 text-caption',
              m.id === moment?.id
                ? 'border-accent bg-control-hover'
                : 'border-line-subtle hover:bg-control-hover',
            )}
          >
            {m.name}
          </button>
        ))}
      </div>
      {moment && (
        <MomentEditor
          key={moment.id}
          show={show}
          moment={moment}
          onDeleted={() => setSelected(null)}
        />
      )}
    </Panel>
  );
}

function MomentEditor({
  show,
  moment: m,
  onDeleted,
}: {
  show: Show;
  moment: Moment;
  onDeleted: () => void;
}) {
  const update = useEditor((s) => s.update);
  const set = (fn: (x: Moment) => void, coalesce?: string) =>
    update(
      (d) => {
        const x = d.moments.find((y) => y.id === m.id);
        if (!x) return;
        fn(x);
        syncResultVars(d, x);
      },
      coalesce ? { coalesce: `${m.id}:${coalesce}` } : undefined,
    );
  const info = MOMENT_TYPES.find((t) => t.type === m.type)!;
  const used = show.cues.some((c) =>
    c.actions.some((a) => a.type === 'openMoment' && a.momentId === m.id),
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-fg-subtle">
        {info.label}: {info.hint}
        {!used && <span className="text-warn"> No cue opens this moment yet.</span>}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name (for the operator)">
          <CommitInput value={m.name} onCommit={(name) => set((x) => void (x.name = name))} />
        </Field>
        <Field label="Closes after" hint="0 = the operator closes it">
          <NumberInput
            value={m.durationSec}
            min={0}
            suffix="s"
            onCommit={(v) => set((x) => void (x.durationSec = v))}
          />
        </Field>
      </div>
      <Field label="What phones show">
        <CommitInput value={m.prompt} onCommit={(prompt) => set((x) => void (x.prompt = prompt))} />
      </Field>

      {m.type === 'vote' && (
        <Field label="Options (key used in rules · label phones see)">
          <div className="flex flex-col gap-1">
            {m.options.map((o, i) => (
              <div key={i} className="flex gap-1">
                <CommitInput
                  className="w-28 font-mono"
                  value={o.id}
                  onCommit={(id) => {
                    const clean = slug(id);
                    if (m.options.some((y, j) => y.id === clean && j !== i))
                      return toast('That key is taken', 'error');
                    const before = m.options[i]!.id;
                    update((d) => {
                      const x = d.moments.find((y) => y.id === m.id)!;
                      x.options[i]!.id = clean;
                      if (x.defaultResult === before) x.defaultResult = clean;
                      syncResultVars(d, x);
                      for (const r of d.rules)
                        for (const c of r.if)
                          if (c.varId === x.resultVarId && c.value === before) c.value = clean;
                    });
                  }}
                />
                <CommitInput
                  value={o.label}
                  onCommit={(label) => set((x) => void (x.options[i]!.label = label))}
                />
                <IconButton
                  label="Remove option"
                  icon={<Trash2 size={12} />}
                  disabled={m.options.length <= 2}
                  onClick={() => set((x) => void x.options.splice(i, 1))}
                />
              </div>
            ))}
            {m.options.length < 6 && (
              <Button
                size="sm"
                className="w-fit"
                icon={<Plus size={12} />}
                onClick={() =>
                  set(
                    (x) =>
                      void x.options.push({
                        id: String.fromCharCode(97 + x.options.length),
                        label: `Option ${String.fromCharCode(65 + x.options.length)}`,
                      }),
                  )
                }
              >
                Option
              </Button>
            )}
          </div>
        </Field>
      )}

      {m.type === 'slider' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Minimum">
            <NumberInput value={m.min} onCommit={(v) => set((x) => void (x.min = v))} />
          </Field>
          <Field label="Maximum">
            <NumberInput value={m.max} onCommit={(v) => set((x) => void (x.max = v))} />
          </Field>
        </div>
      )}

      {m.type === 'text' && (
        <Toggle
          checked={m.moderated}
          onChange={(v) => set((x) => void (x.moderated = v))}
          label="Operator approves each entry before it reaches the stage (recommended)"
        />
      )}

      {m.type === 'prop' && (
        <Field label="Variants (each phone gets one, by weight)">
          <div className="flex flex-col gap-2">
            {m.variants.map((v, i) => (
              <div key={v.id} className="rounded-control border border-line-subtle p-2">
                <div className="flex gap-1">
                  <CommitInput
                    value={v.label}
                    onCommit={(label) => set((x) => void (x.variants[i]!.label = label))}
                  />
                  <NumberInput
                    className="w-20"
                    value={v.weight}
                    min={0.1}
                    step={0.5}
                    onCommit={(w) => set((x) => void (x.variants[i]!.weight = w))}
                  />
                  <IconButton
                    label="Remove variant"
                    icon={<Trash2 size={12} />}
                    onClick={() => set((x) => void x.variants.splice(i, 1))}
                  />
                </div>
                <TextArea
                  className="mt-1"
                  rows={2}
                  defaultValue={v.content}
                  onBlur={(e) => set((x) => void (x.variants[i]!.content = e.target.value))}
                />
              </div>
            ))}
            <Button
              size="sm"
              className="w-fit"
              icon={<Plus size={12} />}
              onClick={() =>
                set(
                  (x) =>
                    void x.variants.push({
                      id: uid('v').slice(2),
                      label: 'New variant',
                      content: '',
                      weight: 1,
                    }),
                )
              }
            >
              Variant
            </Button>
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Result goes to">
          <Select
            value={m.resultVarId ?? ''}
            onChange={(e) => set((x) => void (x.resultVarId = e.target.value || null))}
          >
            <option value="">—</option>
            {show.vars.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        {(m.type === 'vote' || m.type === 'prop' || m.type === 'slider') && (
          <Field label="Tally goes to">
            <Select
              value={m.tallyVarId ?? ''}
              onChange={(e) => set((x) => void (x.tallyVarId = e.target.value || null))}
            >
              <option value="">—</option>
              {show.vars.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {(!m.resultVarId || ((m.type === 'vote' || m.type === 'prop') && !m.tallyVarId)) && (
        <Button
          size="sm"
          className="w-fit"
          icon={<Wand2 size={12} />}
          onClick={() =>
            update((d) =>
              createResultVars(
                d,
                d.moments.find((x) => x.id === m.id)!,
              ),
            )
          }
        >
          Create state values for the result
        </Button>
      )}
      <TryEveryOutcome show={show} moment={m} />
      <Field
        label="If nobody responds, use"
        hint="Every branch needs a default in case phones can't connect."
      >
        {m.type === 'vote' ? (
          <Select
            value={String(m.defaultResult)}
            onChange={(e) => set((x) => void (x.defaultResult = e.target.value))}
          >
            {m.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({o.id})
              </option>
            ))}
          </Select>
        ) : m.type === 'text' ? (
          <CommitInput
            value={String(m.defaultResult)}
            onCommit={(v) => set((x) => void (x.defaultResult = v))}
          />
        ) : (
          <NumberInput
            value={Number(m.defaultResult) || 0}
            onCommit={(v) => set((x) => void (x.defaultResult = v))}
          />
        )}
      </Field>
      <Button
        size="sm"
        variant="ghost"
        className="w-fit text-fault"
        icon={<Trash2 size={13} />}
        onClick={() => {
          update((d) => removeMoment(d, m.id));
          onDeleted();
        }}
      >
        Delete moment
      </Button>
    </div>
  );
}

/** One line per possible result, with the path the show then takes (UX principle 7). */
function TryEveryOutcome({ show, moment }: { show: Show; moment: Moment }) {
  const outcomes = useMemo(() => tryOutcomes(show, moment.id), [show, moment.id]);
  return (
    <section aria-label="Try every outcome" className="rounded-control border border-line-subtle">
      <h3 className="label-caps border-b border-line-subtle px-2 py-1.5 text-fg-subtle">
        Try every outcome
      </h3>
      {outcomes.length === 0 ? (
        <p className="p-2 text-caption text-fg-subtle">
          Add this moment to a cue to see where each result leads.
        </p>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {outcomes.map((o) => (
            <li key={String(o.value)} className="px-2 py-1.5 text-caption">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 font-medium text-fg">{o.label}</span>
                <ArrowRight size={12} className="shrink-0 text-fg-icon" aria-hidden />
                {o.standby ? (
                  <span className="min-w-0 truncate text-fg">
                    {o.standby.scene} · cue {o.standby.number} “{o.standby.name}”
                  </span>
                ) : (
                  <span className="text-warn">the show ends here</span>
                )}
              </div>
              <div className="text-fg-subtle">
                {o.ran.length ? `Runs ${o.ran.map((r) => `“${r}”`).join(', ')}` : 'No rule runs'}
                {o.changes.map((c) => ` · ${c.name}: ${c.before || 'empty'} → ${c.after}`).join('')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
