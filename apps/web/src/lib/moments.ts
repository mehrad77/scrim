import {
  uid,
  type Moment,
  type MomentType,
  type Show,
  type Var,
  type VarValue,
} from '@scrim/format';

/** Moment kinds, and the state values each one writes into. Shared by the editor and recipes. */

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1') || 'value';

export function uniqueName(show: Show, base: string): string {
  let name = slug(base);
  let i = 2;
  while (show.vars.some((v) => v.name === name)) name = `${slug(base)}_${i++}`;
  return name;
}

export function initialFor(type: Var['type']): VarValue {
  return type === 'number' ? 0 : type === 'tally' ? {} : type === 'list' ? [] : '';
}

export const MOMENT_TYPES: { type: MomentType; label: string; hint: string }[] = [
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

export function newMoment(type: MomentType, show: Show): Moment {
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
export function createResultVars(show: Show, m: Moment): void {
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
export function syncResultVars(show: Show, m: Moment): void {
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
