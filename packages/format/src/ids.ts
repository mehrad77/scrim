/** Short random id with a readable prefix, e.g. `cue_k3f9x2ab`. */
export function uid(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (const b of bytes) s += (b % 36).toString(36);
  return `${prefix}_${s}`;
}
