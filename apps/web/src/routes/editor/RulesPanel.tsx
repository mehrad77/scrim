import {
  cueOrder,
  layerTree,
  uid,
  type Condition,
  type Rule,
  type RuleWhen,
  type Show,
} from '@scrim/format';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { summarizeActions } from '../../lib/cueSummary.js';
import { layerPath } from '../../lib/frames.js';
import {
  flatActions,
  OP_TEXT,
  unhandledOptions,
  valueLabel,
  whenKey,
  whenText,
  type LogicIssue,
} from '../../lib/logic.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommitInput, Select, Toggle } from '../../ui/Field.js';
import { MenuButton } from '../../ui/Menu.js';
import { Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';
import { ActionList } from './ActionEditor.js';
import { RECIPES, RecipeCards } from './recipes.js';

const groupId = (key: string) => `rules-${key.replace(/[^a-z0-9]/gi, '-')}`;

/**
 * Rules as sentences of chips, grouped by what sets them off (DESIGN_SYSTEM "Rule sentence").
 * A collapsed row shows only its sentence; opening it edits the chips and the actions, and
 * "More options" holds the rest.
 */
export function RulesPanel({
  issues,
  onPickMoment,
}: {
  issues: LogicIssue[];
  onPickMoment: (id: string) => void;
}) {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string, force?: boolean) =>
    setOpen((s) => {
      const next = new Set(s);
      if (force ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  const addRule = (when: RuleWhen, cond: Condition[] = []) => {
    const r: Rule = {
      id: uid('rul'),
      name: 'New rule',
      enabled: true,
      when,
      if: cond,
      then: [],
    };
    update((d) => {
      // Keep a group's rows together: insert after the group's last rule.
      const last = d.rules.map((x) => whenKey(x.when)).lastIndexOf(whenKey(when));
      d.rules.splice(last < 0 ? d.rules.length : last + 1, 0, r);
    });
    toggle(r.id, true);
  };
  const blank = (): RuleWhen =>
    show.moments[0]
      ? { type: 'momentClosed', momentId: show.moments[0].id }
      : { type: 'trigger', triggerId: show.triggers[0]?.id ?? '' };

  const groups = new Map<string, Rule[]>();
  for (const r of show.rules)
    groups.set(whenKey(r.when), [...(groups.get(whenKey(r.when)) ?? []), r]);
  const mine = issues.filter((i) => i.area === 'interaction');

  const reveal = (issue: LogicIssue) => {
    if (issue.momentId) onPickMoment(issue.momentId);
    if (issue.ruleId) {
      toggle(issue.ruleId, true);
      requestAnimationFrame(() =>
        document.getElementById(`rule-${issue.ruleId}`)?.scrollIntoView({ block: 'nearest' }),
      );
    }
  };

  return (
    <Panel
      title="Rules"
      className="h-full"
      bodyClassName="flex flex-col"
      actions={
        <MenuButton
          label="Add a rule or recipe"
          icon={<Plus size={14} />}
          items={[
            { id: 'blank', label: 'Blank rule', onAction: () => addRule(blank()) },
            'separator',
            ...RECIPES.map((r) => ({
              id: r.id,
              label: `${r.title}…`,
              icon: <r.icon size={14} />,
              onAction: () => void r.run(),
            })),
          ]}
        >
          Add
        </MenuButton>
      }
    >
      <Overview show={show} groups={groups} onPickMoment={onPickMoment} />
      {mine.length > 0 && <LogicCheckList issues={mine} onReveal={reveal} />}
      <div className="flex flex-col gap-4 p-3">
        {show.rules.length === 0 && (
          <div className="mx-auto flex max-w-md flex-col gap-3 py-4">
            <p className="text-ui text-fg-muted">
              <span className="font-medium text-fg">No rules yet.</span> A rule reads like a
              sentence: when the door vote closes, and door is the red door, go to the Cellar. Start
              from a recipe, or add a blank rule.
            </p>
            <RecipeCards />
            <Button className="w-fit" icon={<Plus size={13} />} onClick={() => addRule(blank())}>
              Blank rule
            </Button>
          </div>
        )}
        {[...groups].map(([key, rules]) => (
          <RuleGroup
            key={key}
            show={show}
            rules={rules}
            issues={mine}
            open={open}
            onToggle={toggle}
            onAdd={addRule}
          />
        ))}
      </div>
    </Panel>
  );
}

// ---- overview ----

/** Moment → result → rules → scenes, one card per trigger, so the logic reads at a glance. */
function Overview({
  show,
  groups,
  onPickMoment,
}: {
  show: Show;
  groups: Map<string, Rule[]>;
  onPickMoment: (id: string) => void;
}) {
  if (!groups.size) return null;
  const scene = (id: string) => show.scenes.find((s) => s.id === id)?.name;
  return (
    <div
      aria-label="Overview"
      className="flex shrink-0 gap-2 overflow-x-auto border-b border-line-subtle px-3 py-2"
    >
      {[...groups].map(([key, rules]) => {
        const when = rules[0]!.when;
        const result =
          when.type === 'momentClosed'
            ? show.vars.find(
                (v) => v.id === show.moments.find((m) => m.id === when.momentId)?.resultVarId,
              )?.name
            : undefined;
        const acts = rules.filter((r) => r.enabled).flatMap((r) => flatActions(r.then));
        const scenes = [
          ...new Set(
            acts.flatMap((a) => (a.type === 'jumpScene' ? [scene(a.sceneId) ?? '?'] : [])),
          ),
        ];
        const values = [
          ...new Set(
            acts.flatMap((a) =>
              a.type === 'setVar' || a.type === 'addVar'
                ? [show.vars.find((v) => v.id === a.varId)?.name ?? '?']
                : [],
            ),
          ),
        ];
        const outcome = [...scenes, ...values].join(' | ') || summarizeActions(show, acts);
        return (
          <button
            key={key}
            onClick={() => {
              if (when.type === 'momentClosed') onPickMoment(when.momentId);
              document.getElementById(groupId(key))?.scrollIntoView({ block: 'start' });
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-control border border-line-subtle bg-control px-2 py-1 text-caption text-fg-muted outline-none hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span className="font-medium text-fg">
              {whenText(show, when).replace(/ (closes|is pressed|changes|fires|finishes)$/, '')}
            </span>
            {result && (
              <>
                <span aria-hidden>→</span>
                <span className="font-mono">{result}</span>
              </>
            )}
            <span aria-hidden>→</span>
            <span>
              {rules.length} rule{rules.length > 1 ? 's' : ''}
            </span>
            <span aria-hidden>→</span>
            <span className="max-w-48 truncate text-fg">{outcome}</span>
          </button>
        );
      })}
    </div>
  );
}

function LogicCheckList({
  issues,
  onReveal,
}: {
  issues: LogicIssue[];
  onReveal: (i: LogicIssue) => void;
}) {
  return (
    <details className="group shrink-0 border-b border-line-subtle px-3 py-2" open>
      <summary className="flex cursor-default list-none items-center gap-1.5 text-caption text-warn [&::-webkit-details-marker]:hidden">
        <ChevronRight size={12} className="group-open:rotate-90" aria-hidden />
        <TriangleAlert size={13} aria-hidden />
        Logic check: {issues.length} thing{issues.length > 1 ? 's' : ''} to look at
      </summary>
      <ul className="mt-1 flex flex-col">
        {issues.map((i) => (
          <li key={i.id}>
            <button
              onClick={() => onReveal(i)}
              disabled={!i.ruleId && !i.momentId}
              className="w-full rounded-control px-2 py-0.5 text-left text-caption text-fg-muted enabled:hover:bg-control-hover enabled:hover:text-fg"
            >
              {i.text}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ---- groups and rows ----

function RuleGroup({
  show,
  rules,
  issues,
  open,
  onToggle,
  onAdd,
}: {
  show: Show;
  rules: Rule[];
  issues: LogicIssue[];
  open: Set<string>;
  onToggle: (id: string, force?: boolean) => void;
  onAdd: (when: RuleWhen, cond?: Condition[]) => void;
}) {
  const update = useEditor((s) => s.update);
  const when = rules[0]!.when;
  const ids = new Set(rules.map((r) => r.id));
  const moment =
    when.type === 'momentClosed' ? show.moments.find((m) => m.id === when.momentId) : undefined;
  const unhandled = moment ? unhandledOptions(show, moment.id) : [];
  return (
    <section
      id={groupId(whenKey(when))}
      aria-label={`When ${whenText(show, when)}`}
      className="scroll-mt-2"
    >
      <header className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="label-caps w-10 text-fg-subtle">When</span>
        <WhenChips
          show={show}
          when={when}
          onChange={(w) =>
            update((d) => {
              for (const r of d.rules) if (ids.has(r.id)) r.when = w;
            })
          }
        />
        <IconButton
          label="Add a row to this group"
          icon={<Plus size={13} />}
          onClick={() => onAdd(when)}
        />
      </header>
      {rules.length > 1 && (
        <p className="mb-1 ml-11 text-caption text-fg-subtle">
          Every row that matches runs, top to bottom.
        </p>
      )}
      <ol className="flex flex-col gap-1">
        {rules.map((r, i) => (
          <RuleRow
            key={r.id}
            show={show}
            rule={r}
            n={i + 1}
            first={i === 0}
            last={i === rules.length - 1}
            siblings={rules}
            problems={issues.filter((x) => x.ruleId === r.id)}
            isOpen={open.has(r.id)}
            onToggle={() => onToggle(r.id)}
          />
        ))}
        {moment?.resultVarId &&
          unhandled.map((o) => (
            <li
              key={o.id}
              className="ml-11 flex items-center gap-2 rounded-control border border-dashed border-line-control px-2 py-1 text-caption"
            >
              <TriangleAlert size={13} className="shrink-0 text-warn" aria-hidden />
              <span className="text-fg-muted">
                and {show.vars.find((v) => v.id === moment.resultVarId)?.name} is{' '}
                <span className="text-fg">{o.label}</span>: unhandled, nothing happens
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                icon={<Plus size={12} />}
                onClick={() => onAdd(when, [{ varId: moment.resultVarId!, op: 'eq', value: o.id }])}
              >
                Handle it
              </Button>
            </li>
          ))}
      </ol>
    </section>
  );
}

function RuleRow({
  show,
  rule: r,
  n,
  first,
  last,
  siblings,
  problems,
  isOpen,
  onToggle,
}: {
  show: Show;
  rule: Rule;
  n: number;
  first: boolean;
  last: boolean;
  siblings: Rule[];
  problems: LogicIssue[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const update = useEditor((s) => s.update);
  const [more, setMore] = useState(false);
  const set = (fn: (x: Rule) => void) =>
    update((d) => {
      const x = d.rules.find((y) => y.id === r.id);
      if (x) fn(x);
    });
  /** Swap with the neighbouring row of the same group, which may not be adjacent in the show. */
  const move = (dir: -1 | 1) => {
    const other = siblings[siblings.findIndex((x) => x.id === r.id) + dir];
    if (!other) return;
    update((d) => {
      const a = d.rules.findIndex((x) => x.id === r.id);
      const b = d.rules.findIndex((x) => x.id === other.id);
      [d.rules[a], d.rules[b]] = [d.rules[b]!, d.rules[a]!];
    });
  };
  const sentence = r.if.length
    ? r.if
        .map(
          (c) =>
            `${show.vars.find((v) => v.id === c.varId)?.name ?? 'a value'} ${OP_TEXT[c.op]} ${valueLabel(show, c.varId, c.value)}`,
        )
        .join(' and ')
    : 'always';
  return (
    <li
      id={`rule-${r.id}`}
      className={cn(
        'rounded-control border bg-control',
        isOpen ? 'border-line-strong' : 'border-line-subtle',
        !r.enabled && 'opacity-60',
      )}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-2 px-2 py-1.5 text-left outline-none hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="mt-px w-6 shrink-0 text-right font-mono text-caption text-fg-subtle tabular-nums">
          {n}
        </span>
        <ChevronRight
          size={13}
          className={cn('mt-0.5 shrink-0 text-fg-icon', isOpen && 'rotate-90')}
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-ui">
          <span className="text-fg-muted">{r.if.length ? 'and ' : ''}</span>
          <span className="text-fg">{sentence}</span>
          <span className="text-fg-muted"> → </span>
          <span className="text-fg">{summarizeActions(show, r.then)}</span>
          <span className="block truncate text-caption text-fg-subtle">
            {r.name}
            {!r.enabled && ' · off'}
          </span>
        </span>
        {problems.length > 0 && (
          <TriangleAlert
            size={14}
            className="mt-0.5 shrink-0 text-warn"
            aria-label="Has problems"
          />
        )}
      </button>
      {problems.length > 0 && (
        <ul className="px-10 pb-1 text-caption text-warn">
          {problems.map((p) => (
            <li key={p.id}>{p.text}</li>
          ))}
        </ul>
      )}
      {isOpen && (
        <div className="flex flex-col gap-2 border-t border-line-subtle p-2 pl-10">
          <ConditionChips
            show={show}
            conditions={r.if}
            onChange={(c) => set((x) => void (x.if = c))}
          />
          <div className="flex gap-2">
            <span className="label-caps mt-2 w-10 shrink-0 text-fg-subtle">Then</span>
            <div className="min-w-0 flex-1">
              <ActionList
                show={show}
                actions={r.then}
                onChange={(then) => set((x) => void (x.then = then))}
              />
            </div>
          </div>
          <button
            onClick={() => setMore(!more)}
            aria-expanded={more}
            className="flex w-fit items-center gap-1 text-caption text-fg-muted outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
          >
            <SlidersHorizontal size={12} aria-hidden /> More options
          </button>
          {more && (
            <div className="flex flex-wrap items-center gap-2">
              <CommitInput
                aria-label="Rule name"
                className="w-56"
                value={r.name}
                onCommit={(name) => set((x) => void (x.name = name))}
              />
              <Toggle
                checked={r.enabled}
                onChange={(v) => set((x) => void (x.enabled = v))}
                label="On"
              />
              <span className="flex">
                <IconButton
                  label="Move up"
                  icon={<ArrowUp size={12} />}
                  disabled={first}
                  onClick={() => move(-1)}
                />
                <IconButton
                  label="Move down"
                  icon={<ArrowDown size={12} />}
                  disabled={last}
                  onClick={() => move(1)}
                />
              </span>
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={12} />}
                onClick={() => {
                  const before = structuredClone(show.rules);
                  update((d) => void (d.rules = d.rules.filter((x) => x.id !== r.id)));
                  toast(`Deleted rule “${r.name}”`, 'info', {
                    label: 'Undo',
                    run: () => update((d) => void (d.rules = before)),
                  });
                }}
              >
                Delete rule
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ---- chips ----

const WHEN_KINDS: { type: RuleWhen['type']; noun: string; verb: string }[] = [
  { type: 'momentClosed', noun: 'moment', verb: 'closes' },
  { type: 'trigger', noun: 'trigger', verb: 'is pressed' },
  { type: 'varChanged', noun: 'value', verb: 'changes' },
  { type: 'cueFired', noun: 'cue', verb: 'fires' },
  { type: 'mediaEnded', noun: 'media', verb: 'finishes' },
];

function WhenChips({
  show,
  when,
  onChange,
}: {
  show: Show;
  when: RuleWhen;
  onChange: (w: RuleWhen) => void;
}) {
  const kind = WHEN_KINDS.find((k) => k.type === when.type)!;
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
  const target = (() => {
    switch (when.type) {
      case 'trigger':
        return (
          <Select
            variant="chip"
            aria-label="Trigger"
            value={when.triggerId}
            onChange={(e) => onChange({ ...when, triggerId: e.target.value })}
          >
            {show.triggers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        );
      case 'momentClosed':
        return (
          <Select
            variant="chip"
            aria-label="Moment"
            value={when.momentId}
            onChange={(e) => onChange({ ...when, momentId: e.target.value })}
          >
            {show.moments.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        );
      case 'varChanged':
        return (
          <Select
            variant="chip"
            aria-label="Value"
            value={when.varId}
            onChange={(e) => onChange({ ...when, varId: e.target.value })}
          >
            {show.vars.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        );
      case 'cueFired':
        return (
          <Select
            variant="chip"
            aria-label="Cue"
            value={when.cueId}
            onChange={(e) => onChange({ ...when, cueId: e.target.value })}
          >
            {cueOrder(show).map((c, i) => (
              <option key={c.id} value={c.id}>
                {i + 1}. {c.name}
              </option>
            ))}
          </Select>
        );
      case 'mediaEnded':
        return (
          <Select
            variant="chip"
            aria-label="Media layer"
            value={when.layerId}
            onChange={(e) => onChange({ ...when, layerId: e.target.value })}
          >
            {show.layers
              .filter((l) => l.kind === 'video' || l.kind === 'audio')
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {layerPath(layerTree(show.layers), l.id)}
                </option>
              ))}
          </Select>
        );
    }
  })();
  return (
    <>
      <Select
        variant="chip"
        aria-label="What sets this group off"
        value={when.type}
        onChange={(e) => change(e.target.value as RuleWhen['type'])}
      >
        {WHEN_KINDS.map((k) => (
          <option key={k.type} value={k.type}>
            the {k.noun}
          </option>
        ))}
      </Select>
      {target}
      <span className="text-ui text-fg-muted">{kind.verb}</span>
    </>
  );
}

/** "and [door] [is] [The red door]": conditions as chips, with labels instead of keys. */
export function ConditionChips({
  show,
  conditions,
  onChange,
}: {
  show: Show;
  conditions: Condition[];
  onChange: (c: Condition[]) => void;
}) {
  const set = (i: number, c: Condition) => onChange(conditions.map((x, j) => (j === i ? c : x)));
  return (
    <div className="flex flex-col gap-1">
      {conditions.map((c, i) => {
        const def = show.vars.find((v) => v.id === c.varId);
        const options =
          def?.options?.length && (c.op === 'eq' || c.op === 'neq' || c.op === 'contains')
            ? def.options
            : null;
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps w-10 text-fg-subtle">{i === 0 ? 'If' : 'And'}</span>
            <Select
              variant="chip"
              aria-label="Value to check"
              value={c.varId}
              onChange={(e) => set(i, { ...c, varId: e.target.value })}
            >
              {show.vars.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
            <Select
              variant="chip"
              aria-label="Comparison"
              value={c.op}
              onChange={(e) => set(i, { ...c, op: e.target.value as Condition['op'] })}
            >
              {(Object.keys(OP_TEXT) as Condition['op'][]).map((op) => (
                <option key={op} value={op}>
                  {OP_TEXT[op]}
                </option>
              ))}
            </Select>
            {options ? (
              <Select
                variant="chip"
                aria-label="Compared with"
                value={String(c.value)}
                onChange={(e) => set(i, { ...c, value: e.target.value })}
              >
                {options.map((o) => (
                  <option key={o} value={o}>
                    {valueLabel(show, c.varId, o)}
                  </option>
                ))}
              </Select>
            ) : (
              <CommitInput
                aria-label="Compared with"
                className="w-28"
                value={String(c.value)}
                onCommit={(v) =>
                  set(i, {
                    ...c,
                    value:
                      v !== '' && !Number.isNaN(Number(v)) && def?.type !== 'text' ? Number(v) : v,
                  })
                }
              />
            )}
            <IconButton
              label="Remove condition"
              icon={<X size={12} />}
              onClick={() => onChange(conditions.filter((_, j) => j !== i))}
            />
          </div>
        );
      })}
      <button
        className="ml-11 flex w-fit items-center gap-1 text-caption text-fg-muted outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        onClick={() =>
          onChange([...conditions, { varId: show.vars[0]?.id ?? '', op: 'eq', value: '' }])
        }
      >
        <Plus size={12} /> {conditions.length ? 'and…' : 'only if…'}
      </button>
    </div>
  );
}
