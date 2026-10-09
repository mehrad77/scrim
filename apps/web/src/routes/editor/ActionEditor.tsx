import {
  cueOrder,
  layerTree,
  type Action,
  type ActionType,
  type Condition,
  type Show,
} from '@scrim/format';
import { ArrowDown, ArrowUp, GitBranch, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { layerPath } from '../../lib/frames.js';
import { sectionsOf } from '../../lib/jumps.js';
import { OP_TEXT, valueLabel } from '../../lib/logic.js';
import { IconButton } from '../../ui/Button.js';
import { CommitInput, NumberInput, Select, Toggle } from '../../ui/Field.js';
import { SectionInput } from './SectionInput.js';

const ACTION_LABELS: Record<ActionType, string> = {
  show: 'Show / fade in',
  hide: 'Hide / fade out',
  fade: 'Fade to opacity',
  play: 'Play media',
  pause: 'Pause media',
  seek: 'Jump media to time',
  setText: 'Change text',
  counter: 'Timer / counter',
  setVar: 'Set state value',
  addVar: 'Add to state value',
  jumpScene: 'Go to scene',
  goToCue: 'Go to cue',
  jumpSection: 'Go to section',
  openMoment: 'Open audience moment',
  closeMoment: 'Close audience moment',
  stopAll: 'Stop everything',
  branch: 'If… then… else',
};

const GROUPS: { label: string; types: ActionType[] }[] = [
  { label: 'Layers', types: ['show', 'hide', 'fade', 'setText'] },
  { label: 'Media & timers', types: ['play', 'pause', 'seek', 'counter'] },
  { label: 'Show flow', types: ['jumpScene', 'goToCue', 'jumpSection', 'branch', 'stopAll'] },
  { label: 'State & audience', types: ['setVar', 'addVar', 'openMoment', 'closeMoment'] },
];

export function defaultAction(type: ActionType, show: Show): Action {
  const layer = show.layers[0]?.id ?? '';
  const media = show.layers.find((l) => l.kind === 'video' || l.kind === 'audio')?.id ?? layer;
  const fade = show.defaultFade ?? { duration: 1, easing: 'easeInOut' as const };
  switch (type) {
    case 'show':
    case 'hide':
      return { type, layerId: layer, ...fade };
    case 'fade':
      return { type, layerId: layer, opacity: 0.5, ...fade };
    case 'play':
      return { type, layerId: media, restart: true };
    case 'pause':
      return { type, layerId: media };
    case 'seek':
      return { type, layerId: media, time: 0 };
    case 'setText':
      return { type, layerId: show.layers.find((l) => l.kind === 'text')?.id ?? layer, text: '' };
    case 'counter':
      return {
        type,
        layerId: show.layers.find((l) => l.kind === 'counter')?.id ?? layer,
        op: 'start',
      };
    case 'setVar':
      return { type, varId: show.vars[0]?.id ?? '', value: '' };
    case 'addVar':
      return {
        type,
        varId: show.vars.find((v) => v.type === 'number')?.id ?? show.vars[0]?.id ?? '',
        amount: 1,
      };
    case 'jumpScene':
      return { type, sceneId: show.scenes[0]?.id ?? '', fire: false };
    case 'goToCue':
      return { type, cueId: show.cues[0]?.id ?? '', fire: false };
    case 'jumpSection':
      return { type, section: sectionsOf(show)[0] ?? 'Chorus', fire: false };
    case 'openMoment':
    case 'closeMoment':
      return { type, momentId: show.moments[0]?.id ?? '' };
    case 'stopAll':
      return { type, duration: 2 };
    case 'branch':
      return {
        type,
        if: [{ varId: show.vars[0]?.id ?? '', op: 'eq', value: '' }],
        then: [],
        else: [],
      };
  }
}

export function AddActionMenu({
  show,
  onAdd,
  label = 'Add action',
}: {
  show: Show;
  onAdd: (a: Action) => void;
  label?: string;
}) {
  return (
    <Select
      value=""
      aria-label={label}
      className="w-48"
      onChange={(e) => {
        if (e.target.value) onAdd(defaultAction(e.target.value as ActionType, show));
      }}
    >
      <option value="">+ {label}…</option>
      {GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.types.map((t) => (
            <option key={t} value={t}>
              {ACTION_LABELS[t]}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** Edits a list of actions in place; `onChange` receives the new list. */
export function ActionList({
  show,
  actions,
  onChange,
  depth = 0,
}: {
  show: Show;
  actions: Action[];
  onChange: (a: Action[]) => void;
  depth?: number;
}) {
  const set = (i: number, a: Action) => onChange(actions.map((x, j) => (j === i ? a : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...actions];
    const [item] = next.splice(i, 1);
    next.splice(i + d, 0, item!);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {actions.map((a, i) => (
        <div
          key={i}
          className={cn(
            'group rounded-control border border-line-subtle bg-control p-2',
            a.type === 'branch' && 'border-line-strong',
          )}
        >
          <div className="flex items-start gap-2">
            <span className="mt-1.5 w-32 shrink-0 text-caption font-medium text-fg-muted">
              {ACTION_LABELS[a.type]}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <ActionFields show={show} action={a} onChange={(x) => set(i, x)} depth={depth} />
            </div>
            <div className="flex shrink-0 opacity-40 group-hover:opacity-100">
              <IconButton
                label="Move up"
                icon={<ArrowUp size={12} />}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              />
              <IconButton
                label="Move down"
                icon={<ArrowDown size={12} />}
                disabled={i === actions.length - 1}
                onClick={() => move(i, 1)}
              />
              <IconButton
                label="Remove action"
                icon={<Trash2 size={12} />}
                onClick={() => onChange(actions.filter((_, j) => j !== i))}
              />
            </div>
          </div>
        </div>
      ))}
      <div>
        <AddActionMenu show={show} onAdd={(a) => onChange([...actions, a])} />
      </div>
    </div>
  );
}

function ActionFields({
  show,
  action: a,
  onChange,
  depth,
}: {
  show: Show;
  action: Action;
  onChange: (a: Action) => void;
  depth: number;
}) {
  // "Lower third › Name", so layers with the same name in different frames can be told apart.
  const tree = layerTree(show.layers);
  const layerPick = (filter?: (k: string) => boolean) =>
    'layerId' in a && (
      <Pick
        value={a.layerId}
        onChange={(layerId) => onChange({ ...a, layerId } as Action)}
        placeholder="Layer"
      >
        {show.layers
          .filter((l) => !filter || filter(l.kind))
          .map((l) => (
            <option key={l.id} value={l.id}>
              {layerPath(tree, l.id)}
              {show.outputs.length > 1 && l.outputId
                ? ` (${show.outputs.find((o) => o.id === l.outputId)?.name})`
                : ''}
            </option>
          ))}
      </Pick>
    );
  // When the action starts after its cue fires (the cue dock's bar offset).
  const delayField = 'layerId' in a && (
    <>
      <span className="text-caption text-fg-subtle">after</span>
      <NumberInput
        className="w-20"
        aria-label="Delay in seconds"
        value={'delay' in a ? (a.delay ?? 0) : 0}
        min={0}
        step={0.1}
        suffix="s"
        onCommit={(delay) => onChange({ ...a, delay: delay || undefined } as Action)}
      />
    </>
  );
  const fadeFields = 'duration' in a && 'easing' in a && (
    <>
      <span className="text-caption text-fg-subtle">over</span>
      <NumberInput
        className="w-20"
        value={a.duration}
        min={0}
        step={0.1}
        suffix="s"
        onCommit={(duration) => onChange({ ...a, duration } as Action)}
      />
      <Select
        className="w-28"
        value={a.easing}
        onChange={(e) => onChange({ ...a, easing: e.target.value } as Action)}
      >
        <option value="linear">Linear</option>
        <option value="easeIn">Ease in</option>
        <option value="easeOut">Ease out</option>
        <option value="easeInOut">Smooth</option>
      </Select>
      {delayField}
    </>
  );

  switch (a.type) {
    case 'show':
    case 'hide':
      return (
        <>
          {layerPick()}
          {fadeFields}
        </>
      );
    case 'fade':
      return (
        <>
          {layerPick()}
          <span className="text-caption text-fg-subtle">to</span>
          <NumberInput
            className="w-20"
            value={Math.round(a.opacity * 100)}
            min={0}
            max={100}
            suffix="%"
            onCommit={(v) => onChange({ ...a, opacity: v / 100 })}
          />
          {fadeFields}
        </>
      );
    case 'play':
      return (
        <>
          {layerPick((k) => k === 'video' || k === 'audio')}
          <Toggle
            checked={a.restart}
            onChange={(restart) => onChange({ ...a, restart })}
            label={<span className="text-caption">from the start</span>}
          />
          {delayField}
        </>
      );
    case 'pause':
      return (
        <>
          {layerPick((k) => k === 'video' || k === 'audio')}
          {delayField}
        </>
      );
    case 'seek':
      return (
        <>
          {layerPick((k) => k === 'video' || k === 'audio')}
          <span className="text-caption text-fg-subtle">to</span>
          <NumberInput
            className="w-24"
            value={a.time}
            min={0}
            step={0.1}
            suffix="s"
            onCommit={(time) => onChange({ ...a, time })}
          />
          {delayField}
        </>
      );
    case 'setText':
      return (
        <>
          {layerPick((k) => k === 'text')}
          <CommitInput
            className="min-w-40 flex-1"
            value={a.text}
            placeholder="New text, may use {{name}}"
            onCommit={(text) => onChange({ ...a, text })}
          />
          {delayField}
        </>
      );
    case 'counter':
      return (
        <>
          {layerPick((k) => k === 'counter')}
          <Select
            className="w-28"
            value={a.op}
            onChange={(e) => onChange({ ...a, op: e.target.value as 'start' })}
          >
            <option value="start">Start</option>
            <option value="pause">Pause</option>
            <option value="reset">Reset</option>
            <option value="add">Add</option>
          </Select>
          {(a.op === 'reset' || a.op === 'add') && (
            <NumberInput
              className="w-24"
              value={a.value ?? (a.op === 'add' ? 1 : counterStart(show, a.layerId))}
              onCommit={(value) => onChange({ ...a, value })}
            />
          )}
          {delayField}
        </>
      );
    case 'setVar': {
      const def = show.vars.find((v) => v.id === a.varId);
      return (
        <>
          <VarPick show={show} value={a.varId} onChange={(varId) => onChange({ ...a, varId })} />
          <span className="text-caption text-fg-subtle">to</span>
          {def?.options?.length ? (
            <Select
              className="w-36"
              value={String(a.value)}
              onChange={(e) => onChange({ ...a, value: e.target.value })}
            >
              {def.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          ) : def?.type === 'number' ? (
            <NumberInput
              className="w-24"
              value={Number(a.value) || 0}
              onCommit={(value) => onChange({ ...a, value })}
            />
          ) : (
            <CommitInput
              className="w-40"
              value={String(a.value)}
              onCommit={(value) => onChange({ ...a, value })}
            />
          )}
        </>
      );
    }
    case 'addVar':
      return (
        <>
          <VarPick show={show} value={a.varId} onChange={(varId) => onChange({ ...a, varId })} />
          <NumberInput
            className="w-24"
            value={a.amount}
            onCommit={(amount) => onChange({ ...a, amount })}
          />
        </>
      );
    case 'jumpScene':
      return (
        <>
          <Pick
            value={a.sceneId}
            onChange={(sceneId) => onChange({ ...a, sceneId })}
            placeholder="Scene"
          >
            {show.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Pick>
          <Toggle
            checked={a.fire}
            onChange={(fire) => onChange({ ...a, fire })}
            label={<span className="text-caption">fire it now (otherwise standby)</span>}
          />
        </>
      );
    case 'goToCue':
      return (
        <>
          <Pick value={a.cueId} onChange={(cueId) => onChange({ ...a, cueId })} placeholder="Cue">
            {cueOrder(show).map((c, i) => (
              <option key={c.id} value={c.id}>
                {i + 1}. {c.name}
              </option>
            ))}
          </Pick>
          <Toggle
            checked={a.fire}
            onChange={(fire) => onChange({ ...a, fire })}
            label={<span className="text-caption">fire it now</span>}
          />
        </>
      );
    case 'openMoment':
    case 'closeMoment':
      return (
        <Pick
          value={a.momentId}
          onChange={(momentId) => onChange({ ...a, momentId })}
          placeholder="Audience moment"
        >
          {show.moments.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Pick>
      );
    case 'jumpSection':
      return (
        <>
          <SectionInput
            show={show}
            className="w-36"
            value={a.section}
            onCommit={(section) => onChange({ ...a, section })}
          />
          <span className="text-caption text-fg-subtle">in this scene</span>
          <Toggle
            checked={a.fire}
            onChange={(fire) => onChange({ ...a, fire })}
            label={<span className="text-caption">fire it now</span>}
          />
        </>
      );
    case 'stopAll':
      return (
        <>
          <span className="text-caption text-fg-subtle">fade every layer and sound out over</span>
          <NumberInput
            className="w-20"
            value={a.duration}
            min={0}
            step={0.1}
            suffix="s"
            onCommit={(duration) => onChange({ ...a, duration })}
          />
        </>
      );
    case 'branch':
      return (
        <div className="flex w-full flex-col gap-2">
          <Conditions
            show={show}
            conditions={a.if}
            onChange={(cond) => onChange({ ...a, if: cond })}
          />
          <Labeled
            label={
              <>
                <GitBranch size={12} /> then
              </>
            }
          >
            <ActionList
              show={show}
              actions={a.then}
              onChange={(then) => onChange({ ...a, then })}
              depth={depth + 1}
            />
          </Labeled>
          <Labeled label="else">
            <ActionList
              show={show}
              actions={a.else}
              onChange={(els) => onChange({ ...a, else: els })}
              depth={depth + 1}
            />
          </Labeled>
        </div>
      );
  }
}

function counterStart(show: Show, layerId: string): number {
  const layer = show.layers.find((l) => l.id === layerId);
  return layer?.kind === 'counter' ? layer.start : 0;
}

function Labeled({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-1.5 flex w-12 shrink-0 items-center gap-1 text-caption font-medium text-fg-muted">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Pick({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <Select
      className={cn('w-44', !value && 'border-dashed')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}…</option>
      {children}
    </Select>
  );
}

export function VarPick({
  show,
  value,
  onChange,
}: {
  show: Show;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Pick value={value} onChange={onChange} placeholder="State value">
      {show.vars.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </Pick>
  );
}

const OPS = (Object.keys(OP_TEXT) as Condition['op'][]).map((op) => ({ op, label: OP_TEXT[op] }));

export function Conditions({
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
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-12 text-caption font-medium text-fg-muted">
              {i === 0 ? 'if' : 'and'}
            </span>
            <VarPick show={show} value={c.varId} onChange={(varId) => set(i, { ...c, varId })} />
            <Select
              className="w-32"
              value={c.op}
              onChange={(e) => set(i, { ...c, op: e.target.value as Condition['op'] })}
            >
              {OPS.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </Select>
            {def?.options?.length && (c.op === 'eq' || c.op === 'neq' || c.op === 'contains') ? (
              <Select
                className="w-36"
                value={String(c.value)}
                onChange={(e) => set(i, { ...c, value: e.target.value })}
              >
                <option value="">…</option>
                {def.options.map((o) => (
                  <option key={o} value={o}>
                    {valueLabel(show, c.varId, o)}
                  </option>
                ))}
              </Select>
            ) : (
              <CommitInput
                className="w-32"
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
              icon={<Trash2 size={12} />}
              onClick={() => onChange(conditions.filter((_, j) => j !== i))}
            />
          </div>
        );
      })}
      <button
        className="flex w-fit items-center gap-1 text-caption text-fg-muted hover:text-fg"
        onClick={() =>
          onChange([...conditions, { varId: show.vars[0]?.id ?? '', op: 'eq', value: '' }])
        }
      >
        <Plus size={12} /> condition
      </button>
    </div>
  );
}
