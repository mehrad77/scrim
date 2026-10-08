/**
 * Motion tokens for `motion` (DESIGN_SYSTEM.md › Motion). Durations and easings live in CSS; these
 * springs are for the few things CSS can't do: layout settles, exits and gestures. Editor only:
 * output windows, render/** and the operator never import motion (enforced by ESLint).
 */
export const spring = {
  /** Switches, segmented highlights. */
  snap: { type: 'spring', visualDuration: 0.14, bounce: 0.1 },
  /** Popovers, panel content, reorder settle, list add and remove. */
  settle: { type: 'spring', visualDuration: 0.2, bounce: 0.1 },
  /** Large areas. */
  glide: { type: 'spring', visualDuration: 0.3, bounce: 0.1 },
  /** Audience page only. */
  pop: { type: 'spring', visualDuration: 0.35, bounce: 0.25 },
} as const;

/** Whether <html data-motion> asks for the reduced profile (OS, preference or Show mode). */
export function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced';
}
