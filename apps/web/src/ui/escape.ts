/**
 * In the operator view Esc is PANIC and nothing else (UX_PRINCIPLES.md › Safety invariants), so
 * dialogs and popovers there ignore it and close by other means. The operator route turns this
 * on while it is mounted; everywhere else Esc closes the topmost overlay first.
 */
let escapeIsPanic = false;

export function setEscapeIsPanic(on: boolean): void {
  escapeIsPanic = on;
}

export function isEscapePanic(): boolean {
  return escapeIsPanic;
}
