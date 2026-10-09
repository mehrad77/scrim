import type { Show, VarValue } from '@scrim/format';

/**
 * What people call the values a moment writes, by the id stored in the state value: a vote's
 * options and a prop's variants. Empty for values that no vote or prop moment fills.
 */
export function optionLabels(show: Pick<Show, 'moments'>, varId: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!varId) return out;
  for (const m of show.moments) {
    if (m.resultVarId !== varId && m.tallyVarId !== varId) continue;
    if (m.type === 'vote') for (const o of m.options) out[o.id] = o.label;
    if (m.type === 'prop') for (const v of m.variants) out[v.id] = v.label;
  }
  return out;
}

/** A value as lines people read: one per list entry or tally option, with labels for ids. */
export function valueLines(
  value: VarValue | null | undefined,
  labels: Record<string, string> = {},
): string[] {
  if (value === null || value === undefined) return [];
  const label = (s: string) => (Object.hasOwn(labels, s) ? labels[s]! : s);
  if (Array.isArray(value)) return value.map(label);
  if (typeof value === 'object') return Object.entries(value).map(([k, n]) => `${label(k)}: ${n}`);
  if (typeof value === 'number')
    return [Number.isInteger(value) ? String(value) : value.toFixed(1)];
  return [label(value)];
}

export function formatValue(
  value: VarValue | null | undefined,
  labels: Record<string, string> = {},
): string {
  return valueLines(value, labels).join(', ');
}

/** A state value as people read it: "The red door", never the option id behind it. */
export function formatVar(
  show: Pick<Show, 'moments'>,
  varId: string,
  value: VarValue | null | undefined,
): string {
  return formatValue(value, optionLabels(show, varId));
}
