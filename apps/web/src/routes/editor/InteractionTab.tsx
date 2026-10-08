import {
  cueOrder,
  uid,
  type Moment,
  type MomentType,
  type Rule,
  type RuleWhen,
  type Show,
  type Var,
  type VarValue,
} from '@scrim/format';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { removeMoment, removeTrigger, removeVar } from '../../lib/refs.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, Field, NumberInput, Select, TextArea, Toggle } from '../../ui/Field.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';
import { ActionList, Conditions } from './ActionEditor.js';

export function InteractionTab() {
  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)_minmax(0,1.3fr)] gap-2 p-2">
      <div className="flex min-h-0 flex-col gap-2">
        <VarsPanel />
        <TriggersPanel />
      </div>
      <MomentsPanel />
      <RulesPanel />
    </div>
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1') || 'value';

function uniqueName(show: Show, base: string): string {
  let name = slug(base);
  let i = 2;
  while (show.vars.some((v) => v.name === name)) name = `${slug(base)}_${i++}`;
  return name;
}

function initialFor(type: Var['type']): VarValue {
  return type === 'number' ? 0 : type === 'tally' ? {} : type === 'list' ? [] : '';
}

// ---- state values ----

function VarsPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
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
          <div key={v.id} className="rounded-md border border-line-subtle p-2">
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
            className="h-8 w-9 shrink-0 rounded border border-line-subtle bg-panel"
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

const MOMENT_TYPES: { type: MomentType; label: string; hint: string }[] = [
  { type: 'vote', label: 'Vote', hint: '2–6 options; the winner and the tally are stored.' },
  { type: 'tap', label: 'Tap / shake', hint: 'A big button; the total count is stored.' },
  {
    type: 'slider',
    label: 'Slider',
    hint: 'A scale; the average is stored, the spread in a tally.',
  },
  {
    type: 'text',
    label: 'Text / name',
    hint: 'Short text; approved entries are stored as a list.',
  },
  {
    type: 'prop',
    label: 'Personal prop',
    hint: 'Each phone shows one variant (a clue, a role); the split is stored.',
  },
];

function newMoment(type: MomentType, show: Show): Moment {
  const n = show.moments.filter((m) => m.type === type).length + 1;
  return {
    id: uid('mom'),
    name: `${MOMENT_TYPES.find((t) => t.type === type)!.label} ${n}`,
    type,
    prompt:
      type === 'vote'
        ? 'What should happen next?'
        : type === 'tap'
          ? 'Tap as fast as you can!'
          : type === 'slider'
            ? 'How scared are you?'
            : type === 'text'
              ? 'Tell us your name'
              : 'Your secret role',
    options:
      type === 'vote'
        ? [
            { id: 'a', label: 'Option A' },
            { id: 'b', label: 'Option B' },
          ]
        : [],
    min: 0,
    max: 10,
    variants:
      type === 'prop'
        ? [
            {
              id: uid('var').slice(4),
              label: 'Variant A',
              content: 'You are the detective.',
              weight: 1,
            },
            { id: uid('var').slice(4), label: 'Variant B', content: 'You saw nothing.', weight: 3 },
          ]
        : [],
    durationSec: type === 'text' ? 0 : 20,
    resultVarId: null,
    tallyVarId: null,
    defaultResult: type === 'vote' ? 'a' : type === 'text' ? '' : 0,
    moderated: true,
  };
}

/** Create the state values a moment writes into, named after it. */
function createResultVars(show: Show, m: Moment): void {
  const base = slug(m.name);
  const add = (suffix: string, type: Var['type'], extra: Partial<Var> = {}) => {
    const v: Var = {
      id: uid('var'),
      name: uniqueName(show, `${base}_${suffix}`),
      type,
      initial: initialFor(type),
      ...extra,
    };
    show.vars.push(v);
    return v.id;
  };
  switch (m.type) {
    case 'vote':
      m.resultVarId ??= add('winner', 'choice', { options: m.options.map((o) => o.id) });
      m.tallyVarId ??= add('tally', 'tally', {
        options: m.options.map((o) => o.id),
        initial: Object.fromEntries(m.options.map((o) => [o.id, 0])),
      });
      break;
    case 'tap':
      m.resultVarId ??= add('taps', 'number');
      break;
    case 'slider':
      m.resultVarId ??= add('average', 'number');
      m.tallyVarId ??= add('spread', 'tally');
      break;
    case 'text':
      m.resultVarId ??= add('entries', 'list');
      break;
    case 'prop':
      m.tallyVarId ??= add('split', 'tally', { options: m.variants.map((v) => v.id) });
      m.resultVarId ??= add('phones', 'number');
      break;
  }
}

/** Keep a moment's choice and tally values offering exactly its options. */
function syncResultVars(show: Show, m: Moment): void {
  const keys =
    m.type === 'vote'
      ? m.options.map((o) => o.id)
      : m.type === 'prop'
        ? m.variants.map((v) => v.id)
        : null;
  if (!keys) return;
  for (const v of show.vars) {
    if (v.id === m.resultVarId && v.type === 'choice') v.options = [...keys];
    if (v.id === m.tallyVarId && v.type === 'tally') {
      v.options = [...keys];
      v.initial = Object.fromEntries(keys.map((k) => [k, 0]));
    }
  }
  if (m.type === 'vote' && !keys.includes(String(m.defaultResult))) m.defaultResult = keys[0] ?? '';
}

function MomentsPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const [selected, setSelected] = useState<string | null>(show.moments[0]?.id ?? null);
  const moment = show.moments.find((m) => m.id === selected);
  return (
    <Panel
      title="Audience moments"
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
              'rounded-md border px-2 py-1 text-caption',
              m.id === selected
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
              <div key={v.id} className="rounded border border-line-subtle p-2">
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

// ---- rules ----

function RulesPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const setRule = (id: string, fn: (r: Rule) => void) =>
    update((d) => {
      const r = d.rules.find((x) => x.id === id);
      if (r) fn(r);
    });
  return (
    <Panel
      title="Rules"
      bodyClassName="p-2"
      actions={
        <Button
          size="sm"
          icon={<Plus size={13} />}
          onClick={() =>
            update(
              (d) =>
                void d.rules.push({
                  id: uid('rul'),
                  name: 'New rule',
                  enabled: true,
                  when: d.moments[0]
                    ? { type: 'momentClosed', momentId: d.moments[0].id }
                    : { type: 'trigger', triggerId: d.triggers[0]?.id ?? '' },
                  if: [],
                  then: [],
                }),
            )
          }
        >
          Rule
        </Button>
      }
    >
      {show.rules.length === 0 && (
        <Empty>
          Rules are “when … if … then …”. Example: when the door vote closes, if <code>door</code>{' '}
          is <code>left</code>, go to the scene “Cellar”.
        </Empty>
      )}
      <div className="flex flex-col gap-3">
        {show.rules.map((r) => (
          <div
            key={r.id}
            className={cn(
              'rounded-lg border border-line-subtle bg-control p-3',
              !r.enabled && 'opacity-50',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <CommitInput
                className="font-medium"
                value={r.name}
                onCommit={(name) => setRule(r.id, (x) => void (x.name = name))}
              />
              <Toggle
                checked={r.enabled}
                onChange={(v) => setRule(r.id, (x) => void (x.enabled = v))}
                label={<span className="text-caption">On</span>}
              />
              <IconButton
                label="Delete rule"
                icon={<Trash2 size={13} />}
                onClick={() => update((d) => void (d.rules = d.rules.filter((x) => x.id !== r.id)))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-12 text-caption font-medium text-fg-muted">when</span>
                <WhenPicker
                  show={show}
                  when={r.when}
                  onChange={(when) => setRule(r.id, (x) => void (x.when = when))}
                />
              </div>
              <Conditions
                show={show}
                conditions={r.if}
                onChange={(c) => setRule(r.id, (x) => void (x.if = c))}
              />
              <div className="flex gap-2">
                <span className="mt-1.5 w-12 shrink-0 text-caption font-medium text-fg-muted">
                  then
                </span>
                <div className="min-w-0 flex-1">
                  <ActionList
                    show={show}
                    actions={r.then}
                    onChange={(then) => setRule(r.id, (x) => void (x.then = then))}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WhenPicker({
  show,
  when,
  onChange,
}: {
  show: Show;
  when: RuleWhen;
  onChange: (w: RuleWhen) => void;
}) {
  const type = when.type;
  const change = (t: RuleWhen['type']) => {
    switch (t) {
      case 'trigger':
        return onChange({ type: t, triggerId: show.triggers[0]?.id ?? '' });
      case 'momentClosed':
        return onChange({ type: t, momentId: show.moments[0]?.id ?? '' });
      case 'varChanged':
        return onChange({ type: t, varId: show.vars[0]?.id ?? '' });
      case 'cueFired':
        return onChange({ type: t, cueId: show.cues[0]?.id ?? '' });
      case 'mediaEnded':
        return onChange({
          type: t,
          layerId: show.layers.find((l) => l.kind === 'video' || l.kind === 'audio')?.id ?? '',
        });
    }
  };
  return (
    <>
      <Select
        className="w-56"
        value={type}
        onChange={(e) => change(e.target.value as RuleWhen['type'])}
      >
        <option value="trigger">trigger fires</option>
        <option value="momentClosed">audience moment closes</option>
        <option value="varChanged">state value changes</option>
        <option value="cueFired">cue fires</option>
        <option value="mediaEnded">media finishes</option>
      </Select>
      {when.type === 'trigger' && (
        <Select
          className="w-44"
          value={when.triggerId}
          onChange={(e) => onChange({ ...when, triggerId: e.target.value })}
        >
          <option value="">Trigger…</option>
          {show.triggers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      )}
      {when.type === 'momentClosed' && (
        <Select
          className="w-44"
          value={when.momentId}
          onChange={(e) => onChange({ ...when, momentId: e.target.value })}
        >
          <option value="">Moment…</option>
          {show.moments.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      )}
      {when.type === 'varChanged' && (
        <Select
          className="w-44"
          value={when.varId}
          onChange={(e) => onChange({ ...when, varId: e.target.value })}
        >
          <option value="">State value…</option>
          {show.vars.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      )}
      {when.type === 'cueFired' && (
        <Select
          className="w-44"
          value={when.cueId}
          onChange={(e) => onChange({ ...when, cueId: e.target.value })}
        >
          <option value="">Cue…</option>
          {cueOrder(show).map((c, i) => (
            <option key={c.id} value={c.id}>
              {i + 1}. {c.name}
            </option>
          ))}
        </Select>
      )}
      {when.type === 'mediaEnded' && (
        <Select
          className="w-44"
          value={when.layerId}
          onChange={(e) => onChange({ ...when, layerId: e.target.value })}
        >
          <option value="">Media layer…</option>
          {show.layers
            .filter((l) => l.kind === 'video' || l.kind === 'audio')
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </Select>
      )}
    </>
  );
}
