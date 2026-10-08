import { cueOrder, uid, type Rule, type Show } from '@scrim/format';
import { Hand, Plus, Radio, Trash2, Vote, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { createResultVars, newMoment, uniqueName } from '../../lib/moments.js';
import { useEditor } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { formDialog } from '../../ui/dialog.js';
import { Field, NumberInput, Select, TextInput } from '../../ui/Field.js';
import { toast } from '../../ui/toast.js';

/**
 * Recipes (UX principle 7) ask a few questions, then create ordinary moments, values, triggers
 * and rules. Everything they make stays editable; there is no "recipe object" afterwards.
 */
export interface Recipe {
  id: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  run: () => Promise<void>;
}

export const RECIPES: Recipe[] = [
  {
    id: 'vote',
    title: 'Ask the audience',
    blurb: 'A vote on every phone; each option goes to its own scene.',
    icon: Vote,
    run: askTheAudience,
  },
  {
    id: 'counter',
    title: 'Performer button → counter',
    blurb: 'A button on a phone, pedal or key that adds to a number.',
    icon: Radio,
    run: performerCounter,
  },
  {
    id: 'taps',
    title: 'Tap race → goal',
    blurb: 'Everyone taps; reaching the goal goes one way, missing it another.',
    icon: Hand,
    run: tapRace,
  },
];

const show = () => useEditor.getState().show!;
const update = (fn: (d: Show) => void) => useEditor.getState().update(fn);
const selectedCue = () => useEditor.getState().selection.cueId;

function rule(name: string, when: Rule['when'], partial: Partial<Rule> = {}): Rule {
  return { id: uid('rul'), name, enabled: true, when, if: [], then: [], ...partial };
}

function Actions({
  onCancel,
  ok,
  disabled,
}: {
  onCancel: () => void;
  ok: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button onClick={onCancel}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={disabled}>
        {ok}
      </Button>
    </div>
  );
}

function SceneSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Stay on the next cue</option>
      {show().scenes.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}

function CueSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select aria-label="Opened by cue" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No cue yet; I'll add it to one later</option>
      {cueOrder(show()).map((c, i) => (
        <option key={c.id} value={c.id}>
          {i + 1}. {c.name}
        </option>
      ))}
    </Select>
  );
}

function Form({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

// ---- ask the audience ----

interface VoteAnswers {
  question: string;
  options: { label: string; sceneId: string }[];
  cueId: string;
  seconds: number;
}

function VoteForm({ done }: { done: (v: VoteAnswers | null) => void }) {
  const scenes = show().scenes;
  const [a, setA] = useState<VoteAnswers>({
    question: 'Which door do we open?',
    options: [
      { label: 'The red door', sceneId: scenes[1]?.id ?? '' },
      { label: 'The green door', sceneId: scenes[2]?.id ?? '' },
    ],
    cueId: selectedCue() ?? '',
    seconds: 20,
  });
  const setOption = (i: number, patch: Partial<VoteAnswers['options'][number]>) =>
    setA({ ...a, options: a.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <Form onSubmit={() => done(a)}>
      <Field label="What phones ask">
        <TextInput
          autoFocus
          value={a.question}
          onChange={(e) => setA({ ...a, question: e.target.value })}
        />
      </Field>
      <Field label="Options, and where each one goes">
        <div className="flex flex-col gap-1">
          {a.options.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
              <TextInput
                aria-label={`Option ${i + 1}`}
                value={o.label}
                onChange={(e) => setOption(i, { label: e.target.value })}
              />
              <SceneSelect
                label={`Where “${o.label}” goes`}
                value={o.sceneId}
                onChange={(sceneId) => setOption(i, { sceneId })}
              />
              <IconButton
                label="Remove option"
                icon={<Trash2 size={12} />}
                disabled={a.options.length <= 2}
                onClick={() => setA({ ...a, options: a.options.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          {a.options.length < 6 && (
            <Button
              size="sm"
              className="w-fit"
              icon={<Plus size={12} />}
              onClick={() =>
                setA({
                  ...a,
                  options: [...a.options, { label: `Option ${a.options.length + 1}`, sceneId: '' }],
                })
              }
            >
              Option
            </Button>
          )}
        </div>
      </Field>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <Field label="Opened by">
          <CueSelect value={a.cueId} onChange={(cueId) => setA({ ...a, cueId })} />
        </Field>
        <Field label="Closes after">
          <NumberInput
            value={a.seconds}
            min={0}
            suffix="s"
            onCommit={(seconds) => setA({ ...a, seconds })}
          />
        </Field>
      </div>
      <Actions
        ok="Create vote"
        onCancel={() => done(null)}
        disabled={a.options.some((o) => !o.label.trim())}
      />
    </Form>
  );
}

async function askTheAudience(): Promise<void> {
  const a = await formDialog<VoteAnswers>(
    'Ask the audience',
    (done) => <VoteForm done={done} />,
    true,
  );
  if (!a) return;
  update((d) => {
    const m = newMoment('vote', d);
    m.name = a.question.length > 28 ? 'Audience vote' : a.question.replace(/\?$/, '');
    m.prompt = a.question;
    m.durationSec = a.seconds;
    m.options = a.options.map((o, i) => ({
      id: String.fromCharCode(97 + i),
      label: o.label.trim(),
    }));
    m.defaultResult = m.options[0]!.id;
    createResultVars(d, m);
    d.moments.push(m);
    a.options.forEach((o, i) => {
      if (!o.sceneId) return;
      d.rules.push(
        rule(
          `${o.label.trim()} wins`,
          { type: 'momentClosed', momentId: m.id },
          {
            if: [{ varId: m.resultVarId!, op: 'eq', value: m.options[i]!.id }],
            then: [{ type: 'jumpScene', sceneId: o.sceneId, fire: false }],
          },
        ),
      );
    });
    d.cues.find((c) => c.id === a.cueId)?.actions.push({ type: 'openMoment', momentId: m.id });
  });
  toast('Vote created: a moment, its result value and a rule per option', 'good');
}

// ---- performer button → counter ----

interface CounterAnswers {
  button: string;
  value: string;
  step: number;
}

function CounterForm({ done }: { done: (v: CounterAnswers | null) => void }) {
  const [a, setA] = useState<CounterAnswers>({ button: 'Bell', value: 'bells', step: 1 });
  return (
    <Form onSubmit={() => done(a)}>
      <Field label="Button name (performers see it)">
        <TextInput
          autoFocus
          value={a.button}
          onChange={(e) => setA({ ...a, button: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <Field label="Count into the value">
          <TextInput
            className="font-mono"
            value={a.value}
            onChange={(e) => setA({ ...a, value: e.target.value })}
          />
        </Field>
        <Field label="Each press adds">
          <NumberInput value={a.step} onCommit={(step) => setA({ ...a, step })} />
        </Field>
      </div>
      <p className="text-caption text-fg-subtle">
        Show the count on stage with a text layer that says {'{{'}
        {a.value || 'value'}
        {'}}'}.
      </p>
      <Actions ok="Create button" onCancel={() => done(null)} disabled={!a.button.trim()} />
    </Form>
  );
}

async function performerCounter(): Promise<void> {
  const a = await formDialog<CounterAnswers>('Performer button → counter', (done) => (
    <CounterForm done={done} />
  ));
  if (!a) return;
  update((d) => {
    const triggerId = uid('trg');
    d.triggers.push({ id: triggerId, name: a.button.trim(), color: '#d97706' });
    const varId = uid('var');
    d.vars.push({ id: varId, name: uniqueName(d, a.value || 'count'), type: 'number', initial: 0 });
    d.rules.push(
      rule(
        `${a.button.trim()} counts`,
        { type: 'trigger', triggerId },
        {
          then: [{ type: 'addVar', varId, amount: a.step }],
        },
      ),
    );
  });
  toast('Button created: a trigger, a value and the rule that counts', 'good');
}

// ---- tap race → goal ----

interface TapAnswers {
  prompt: string;
  goal: number;
  hit: string;
  miss: string;
  cueId: string;
  seconds: number;
}

function TapForm({ done }: { done: (v: TapAnswers | null) => void }) {
  const [a, setA] = useState<TapAnswers>({
    prompt: 'Tap to wake the giant!',
    goal: 500,
    hit: '',
    miss: '',
    cueId: selectedCue() ?? '',
    seconds: 15,
  });
  return (
    <Form onSubmit={() => done(a)}>
      <Field label="What phones ask">
        <TextInput
          autoFocus
          value={a.prompt}
          onChange={(e) => setA({ ...a, prompt: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-[8rem_1fr_1fr] gap-2">
        <Field label="Goal (taps)">
          <NumberInput value={a.goal} min={1} onCommit={(goal) => setA({ ...a, goal })} />
        </Field>
        <Field label="Reached: go to">
          <SceneSelect
            label="Where reaching the goal goes"
            value={a.hit}
            onChange={(hit) => setA({ ...a, hit })}
          />
        </Field>
        <Field label="Missed: go to">
          <SceneSelect
            label="Where missing the goal goes"
            value={a.miss}
            onChange={(miss) => setA({ ...a, miss })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <Field label="Opened by">
          <CueSelect value={a.cueId} onChange={(cueId) => setA({ ...a, cueId })} />
        </Field>
        <Field label="Closes after">
          <NumberInput
            value={a.seconds}
            min={1}
            suffix="s"
            onCommit={(seconds) => setA({ ...a, seconds })}
          />
        </Field>
      </div>
      <Actions ok="Create tap race" onCancel={() => done(null)} />
    </Form>
  );
}

async function tapRace(): Promise<void> {
  const a = await formDialog<TapAnswers>(
    'Tap race → goal',
    (done) => <TapForm done={done} />,
    true,
  );
  if (!a) return;
  update((d) => {
    const m = newMoment('tap', d);
    m.prompt = a.prompt;
    m.durationSec = a.seconds;
    createResultVars(d, m);
    d.moments.push(m);
    const when = { type: 'momentClosed' as const, momentId: m.id };
    if (a.hit)
      d.rules.push(
        rule('Goal reached', when, {
          if: [{ varId: m.resultVarId!, op: 'gte', value: a.goal }],
          then: [{ type: 'jumpScene', sceneId: a.hit, fire: false }],
        }),
      );
    if (a.miss)
      d.rules.push(
        rule('Goal missed', when, {
          if: [{ varId: m.resultVarId!, op: 'lt', value: a.goal }],
          then: [{ type: 'jumpScene', sceneId: a.miss, fire: false }],
        }),
      );
    d.cues.find((c) => c.id === a.cueId)?.actions.push({ type: 'openMoment', momentId: m.id });
  });
  toast('Tap race created: a moment, its count and the rules for the goal', 'good');
}

/** The recipe cards for empty states. */
export function RecipeCards() {
  return (
    <div className="grid gap-2">
      {RECIPES.map((r) => (
        <button
          key={r.id}
          onClick={() => void r.run()}
          className="flex items-start gap-3 rounded-control border border-line-subtle bg-control p-3 text-left outline-none hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          <r.icon size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
          <span>
            <span className="block text-ui font-medium text-fg">{r.title}</span>
            <span className="block text-caption text-fg-muted">{r.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
