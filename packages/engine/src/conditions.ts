import type { Condition, Show, VarValue } from '@scrim/format';
import type { ConditionCheck } from './types.js';

export function formatValue(value: VarValue | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, n]) => `${k}: ${n}`)
      .join(', ');
  }
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return value;
}

function scalar(value: VarValue | undefined): string | number {
  if (value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (Array.isArray(value)) return value.length;
  return Object.values(value).reduce((a, b) => a + b, 0);
}

export function evaluate(cond: Condition, vars: Record<string, VarValue>): boolean {
  const value = vars[cond.varId];
  const left = scalar(value);
  const right = cond.value;
  switch (cond.op) {
    case 'eq':
      return String(left) === String(right);
    case 'neq':
      return String(left) !== String(right);
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    case 'contains':
      if (Array.isArray(value)) return value.includes(String(right));
      if (value && typeof value === 'object') return (value[String(right)] ?? 0) > 0;
      return String(left).includes(String(right));
  }
}

export function evaluateAll(conds: Condition[], vars: Record<string, VarValue>): boolean {
  return conds.every((c) => evaluate(c, vars));
}

/** Evaluate every condition and keep what each one saw, for traces and the "why" view. */
export function explain(conds: Condition[], vars: Record<string, VarValue>): ConditionCheck[] {
  return conds.map((c) => ({
    varId: c.varId,
    op: c.op,
    expected: c.value,
    actual: formatValue(vars[c.varId]),
    ok: evaluate(c, vars),
  }));
}

/** Replace {{varName}} placeholders with current values. */
export function interpolate(
  text: string,
  show: Pick<Show, 'vars'>,
  vars: Record<string, VarValue>,
): string {
  if (!text.includes('{{')) return text;
  return text.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (whole, name: string) => {
    const def = show.vars.find((v) => v.name === name);
    return def ? formatValue(vars[def.id]) : whole;
  });
}
